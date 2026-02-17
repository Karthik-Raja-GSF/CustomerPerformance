# itglue_sync.py
"""
Sync one IT Glue Document per file found under SYNC_ROOT (default: .docs).

Env vars required:
- ITGLUE_API_KEY
- ITGLUE_ORG_ID
- ITGLUE_DOC_FOLDER_ID

"""

import os
import sys
import json
import pathlib
import requests
from typing import Dict, List

API_BASE = os.environ.get("ITGLUE_API_BASE", "https://api.itglue.com/api")

ITGLUE_API_KEY = os.environ["ITGLUE_API_KEY"]
ORG_ID = int(os.environ["ITGLUE_ORG_ID"])
FOLDER_ID = int(os.environ["ITGLUE_DOC_FOLDER_ID"])
SYNC_ROOT = os.environ.get("SYNC_ROOT", ".docs")

REPO = os.environ.get("GITHUB_REPOSITORY", "repo")  # "owner/name"

ALLOWED_EXT = {
    ".md",
    ".pdf",
    ".xlsx",
    ".csv",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
}


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def json_headers() -> Dict[str, str]:
    return {
        "x-api-key": ITGLUE_API_KEY,
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
    }


def key_headers() -> Dict[str, str]:
    return {
        "x-api-key": ITGLUE_API_KEY,
        "Accept": "application/vnd.api+json",
    }


def doc_name_for_file(rel_path: pathlib.Path) -> str:
    # One doc per file, stable and unique (repo + path)
    return f"{REPO}: {rel_path.as_posix()}"


def list_documents_in_folder() -> Dict[str, int]:
    """
    Returns dict: {document_name: document_id}
    """
    name_to_id: Dict[str, int] = {}
    page_number = 1
    page_size = 100

    while True:
        url = f"{API_BASE}/organizations/{ORG_ID}/relationships/documents"
        params = {
            "filter[document_folder_id]": FOLDER_ID,
            "page[number]": page_number,
            "page[size]": page_size,
        }

        r = requests.get(url, headers=key_headers(), params=params, timeout=60)
        if r.status_code != 200:
            die(f"List documents failed ({r.status_code}): {r.text}")

        payload = r.json()
        data = payload.get("data", [])
        if not data:
            break

        for doc in data:
            doc_id = int(doc.get("id"))
            attrs = doc.get("attributes") or {}
            doc_name = attrs.get("name")
            if doc_name:
                name_to_id[doc_name] = doc_id

        if len(data) < page_size:
            break
        page_number += 1

    return name_to_id


def create_document(doc_name: str) -> int:
    """
    Create a normal (non-uploaded) IT Glue Document in the folder.
    Then we attach the file via the attachments endpoint.
    """
    url = f"{API_BASE}/organizations/{ORG_ID}/relationships/documents"

    body = {
        "data": {
            "type": "documents",
            "attributes": {
                "organization_id": ORG_ID,
                "name": doc_name,
                "public": False,
                "restricted": False,
                "document_folder_id": FOLDER_ID,
                # NOTE: do NOT set is_uploaded here
            }
        }
    }

    r = requests.post(url, headers=json_headers(), data=json.dumps(body), timeout=60)
    if r.status_code not in (200, 201):
        die(f"Create document failed ({r.status_code}): {r.text}")

    payload = r.json()
    return int(payload["data"]["id"])


def list_attachments(document_id: int) -> List[dict]:
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"
    r = requests.get(url, headers=key_headers(), timeout=60)
    if r.status_code != 200:
        die(f"List attachments failed ({r.status_code}): {r.text}")
    return r.json().get("data", []) or []


def delete_attachments(document_id: int, attachment_ids: List[int]) -> None:
    """
    Bulk delete attachments from a document.
    """
    if not attachment_ids:
        return

    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"
    body = {
        "data": [{"type": "attachments", "id": str(aid)} for aid in attachment_ids]
    }

    r = requests.delete(url, headers=json_headers(), data=json.dumps(body), timeout=60)
    if r.status_code != 200:
        die(f"Delete attachments failed ({r.status_code}): {r.text}")


def upload_attachment(document_id: int, file_path: pathlib.Path) -> None:
    """
    Multipart upload:
      POST /documents/:id/relationships/attachments

    Keys per IT Glue docs:
      -F "data[type]=attachments"
      -F "data[attributes][attachment]=@file.ext"
    """
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"

    with file_path.open("rb") as f:
        files = {
            "data[attributes][attachment]": (file_path.name, f),
        }
        data = {
            "data[type]": "attachments",
        }

        # Do NOT set Content-Type manually (requests will set multipart boundary)
        r = requests.post(
            url,
            headers={"x-api-key": ITGLUE_API_KEY, "Accept": "application/vnd.api+json"},
            data=data,
            files=files,
            timeout=300,
        )

        if r.status_code not in (200, 201):
            die(f"Upload attachment failed ({r.status_code}): {r.text}")


def main() -> None:
    root = pathlib.Path(SYNC_ROOT)
    if not root.exists() or not root.is_dir():
        die(f"SYNC_ROOT does not exist or is not a directory: {root.resolve()}")

    files_to_sync: List[pathlib.Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in ALLOWED_EXT:
            files_to_sync.append(p)

    if not files_to_sync:
        print(f"No matching files found under {root}.")
        return

    existing_docs = list_documents_in_folder()

    for abs_path in sorted(files_to_sync, key=lambda x: x.as_posix()):
        rel_path = abs_path.relative_to(root)  # names are relative to .docs
        doc_name = doc_name_for_file(rel_path)

        doc_id = existing_docs.get(doc_name)
        if not doc_id:
            doc_id = create_document(doc_name)
            existing_docs[doc_name] = doc_id
            print(f"Created document: {doc_name} (id={doc_id})")
        else:
            print(f"Found document:   {doc_name} (id={doc_id})")

        # Replace attachment(s) with the latest file
        atts = list_attachments(doc_id)
        old_ids = [int(a["id"]) for a in atts if a.get("id")]
        if old_ids:
            delete_attachments(doc_id, old_ids)

        upload_attachment(doc_id, abs_path)
        print(f"Uploaded: {abs_path.resolve()}")

    print("Sync complete.")


if __name__ == "__main__":
    main()
