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
import hashlib
import requests
from typing import Dict, List, Tuple

API_BASE = os.environ.get("ITGLUE_API_BASE", "https://api.itglue.com/api")

ITGLUE_API_KEY = os.environ["ITGLUE_API_KEY"]
ORG_ID = int(os.environ["ITGLUE_ORG_ID"])
FOLDER_ID = int(os.environ["ITGLUE_DOC_FOLDER_ID"])
SYNC_ROOT = os.environ.get("SYNC_ROOT", ".docs")

REPO = os.environ.get("GITHUB_REPOSITORY", "repo")  # "owner/name"
FAIL_ON_ERROR = os.environ.get("FAIL_ON_ERROR", "true").lower() == "true"

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

MAX_NAME_LEN = 100


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)
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


def short_hash(s: str, n: int = 8) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def safe_document_name(repo: str, rel_path: pathlib.Path) -> str:
    """
    Build a stable, unique, <=100 char document name.

    Format:
      "<repo>: <filename> [<hash>]"
    If needed, truncates the middle part to fit MAX_NAME_LEN.

    Uniqueness:
      hash is derived from "<repo>|<full rel path>" so different paths won't collide.
    """
    rel_str = rel_path.as_posix()
    filename = rel_path.name
    h = short_hash(f"{repo}|{rel_str}", 8)

    base = f"{repo}: {filename} [{h}]"

    if len(base) <= MAX_NAME_LEN:
        return base

    # If filename itself is huge, truncate filename portion
    # Keep suffix (extension) when possible.
    ext = rel_path.suffix
    stem = filename[:-len(ext)] if ext and filename.endswith(ext) else filename

    # Reserve space for "repo: " + " [hash]" + ext
    prefix = f"{repo}: "
    suffix = f" [{h}]"
    reserve = len(prefix) + len(suffix) + len(ext)

    allowed_stem_len = MAX_NAME_LEN - reserve
    if allowed_stem_len < 5:
        # ultra defensive fallback
        return (base[:MAX_NAME_LEN]).rstrip()

    truncated_stem = stem[: allowed_stem_len - 1].rstrip() + "…"
    return f"{prefix}{truncated_stem}{ext}{suffix}"


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
    Create a normal IT Glue Document in the folder.
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
            }
        }
    }

    r = requests.post(url, headers=json_headers(), data=json.dumps(body), timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Create document failed ({r.status_code}): {r.text}")

    payload = r.json()
    return int(payload["data"]["id"])


def list_attachments(document_id: int) -> List[dict]:
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"
    r = requests.get(url, headers=key_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"List attachments failed ({r.status_code}): {r.text}")
    return r.json().get("data", []) or []


def delete_attachments(document_id: int, attachment_ids: List[int]) -> None:
    if not attachment_ids:
        return

    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"
    body = {"data": [{"type": "attachments", "id": str(aid)} for aid in attachment_ids]}

    r = requests.delete(url, headers=json_headers(), data=json.dumps(body), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"Delete attachments failed ({r.status_code}): {r.text}")


def upload_attachment(document_id: int, file_path: pathlib.Path) -> None:
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"

    with file_path.open("rb") as f:
        files = {"data[attributes][attachment]": (file_path.name, f)}
        data = {"data[type]": "attachments"}

        r = requests.post(
            url,
            headers={"x-api-key": ITGLUE_API_KEY, "Accept": "application/vnd.api+json"},
            data=data,
            files=files,
            timeout=300,
        )

        if r.status_code not in (200, 201):
            raise RuntimeError(f"Upload attachment failed ({r.status_code}): {r.text}")


def main() -> None:
    root = pathlib.Path(SYNC_ROOT)
    if not root.exists() or not root.is_dir():
        die(f"SYNC_ROOT does not exist or is not a directory: {root.resolve()}")

    files_to_sync: List[pathlib.Path] = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower() in ALLOWED_EXT:
            files_to_sync.append(p)

    if not files_to_sync:
        log(f"No matching files found under {root}.")
        return

    existing_docs = list_documents_in_folder()

    errors: List[Tuple[str, str]] = []

    for abs_path in sorted(files_to_sync, key=lambda x: x.as_posix()):
        try:
            rel_path = abs_path.relative_to(root)
            doc_name = safe_document_name(REPO, rel_path)

            doc_id = existing_docs.get(doc_name)
            if not doc_id:
                doc_id = create_document(doc_name)
                existing_docs[doc_name] = doc_id
                log(f"Created document: {doc_name} (id={doc_id})")
            else:
                log(f"Found document:   {doc_name} (id={doc_id})")

            # Replace attachments with the latest file
            atts = list_attachments(doc_id)
            old_ids = [int(a["id"]) for a in atts if a.get("id")]
            if old_ids:
                delete_attachments(doc_id, old_ids)

            upload_attachment(doc_id, abs_path)
            log(f"Uploaded: {abs_path.resolve()}")

        except Exception as e:
            msg = f"{abs_path.as_posix()} -> {str(e)}"
            log(f"ERROR (file): {msg}")
            errors.append((abs_path.as_posix(), str(e)))
            continue

    if errors:
        log("\n--- Sync completed with errors ---")
        for fp, err in errors:
            log(f"- {fp}: {err}")

        if FAIL_ON_ERROR:
            die(f"{len(errors)} file(s) failed. Set FAIL_ON_ERROR=false to not fail the job.")

    log("Sync complete.")


if __name__ == "__main__":
    main()
