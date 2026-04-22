# itglue_sync.py
"""
Sync one IT Glue Document per file found under SYNC_ROOT (default: .docs).

Flow for .md files:  create doc → update content (HTML) → publish → upload attachment
Flow for other files: create doc → upload attachment

Env vars required:
- ITGLUE_API_KEY
- ITGLUE_ORG_ID
- ITGLUE_DOC_FOLDER_ID

"""

import os
import re
import sys
import json
import pathlib
import hashlib
import requests
import markdown

from typing import Dict, List, Tuple
from dotenv import load_dotenv

load_dotenv()

API_BASE = os.environ.get("ITGLUE_API_BASE", "https://api.itglue.com")

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

FILE_TYPE_LABELS = {
    ".pdf":  "PDF Document",
    ".xlsx": "Excel Spreadsheet",
    ".csv":  "CSV Data File",
    ".jpg":  "JPEG Image",
    ".jpeg": "JPEG Image",
    ".png":  "PNG Image",
    ".gif":  "GIF Image",
    ".webp": "WebP Image",
}

FILE_TYPE_DESCRIPTIONS = {
    ".pdf":  "Portable Document Format. Open the attachment to view in a PDF reader.",
    ".xlsx": "Microsoft Excel workbook. Open the attachment to view in Excel or Google Sheets.",
    ".csv":  "Comma-separated values data file. Open the attachment to view in Excel or a text editor.",
    ".jpg":  "Image file. Preview the attachment to view.",
    ".jpeg": "Image file. Preview the attachment to view.",
    ".png":  "Image file. Preview the attachment to view.",
    ".gif":  "Image file. Preview the attachment to view.",
    ".webp": "Image file. Preview the attachment to view.",
}


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
                if doc_name in name_to_id:
                    log(f"WARNING: Duplicate IT Glue document name '{doc_name}' (ids={name_to_id[doc_name]},{doc_id}). Using id={doc_id}.")
                name_to_id[doc_name] = doc_id

        if len(data) < page_size:
            break
        page_number += 1

    return name_to_id


def create_document(doc_name: str) -> int:
    """
    Create a normal IT Glue Document in the folder.
    Create a document in the folder.  POST /organizations/:org/relationships/documents
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


def create_section(document_id: int, resource_type: str, content: str, sort: int, level: int = None) -> None:
    """
    Add a section to a document.  POST /documents/:id/relationships/sections/
    resource_type: "Document::Heading" or "Document::Text"
    """
    url = f"{API_BASE}/documents/{document_id}/relationships/sections/"

    attrs = {
        "resource-type": resource_type,
        "content": content,
        "sort": sort,
    }
    if level is not None:
        attrs["level"] = level

    body = {"data": {"type": "document-sections", "attributes": attrs}}

    r = requests.post(url, headers=json_headers(), data=json.dumps(body), timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Create section failed ({r.status_code}): {r.text}")


def list_sections(document_id: int) -> List[int]:
    """Returns all section IDs for a document."""
    section_ids: List[int] = []
    page_number = 1
    page_size = 100

    while True:
        url = f"{API_BASE}/documents/{document_id}/relationships/sections"
        params = {"page[number]": page_number, "page[size]": page_size}
        r = requests.get(url, headers=key_headers(), params=params, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"List sections failed ({r.status_code}): {r.text}")

        data = r.json().get("data", [])
        if not data:
            break

        for section in data:
            section_ids.append(int(section["id"]))

        if len(data) < page_size:
            break
        page_number += 1

    return section_ids


def delete_section(document_id: int, section_id: int) -> None:
    url = f"{API_BASE}/documents/{document_id}/relationships/sections/{section_id}"
    r = requests.delete(url, headers=key_headers(), timeout=60)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"Delete section failed ({r.status_code}): {r.text}")


def clear_sections(document_id: int) -> None:
    section_ids = list_sections(document_id)
    for sid in section_ids:
        delete_section(document_id, sid)
    if section_ids:
        log(f"  Cleared {len(section_ids)} existing sections")


def list_attachments(document_id: int) -> List[int]:
    """Returns all attachment IDs for a document."""
    attachment_ids: List[int] = []
    page_number = 1
    page_size = 100

    while True:
        url = f"{API_BASE}/documents/{document_id}/relationships/attachments"
        params = {"page[number]": page_number, "page[size]": page_size}
        r = requests.get(url, headers=key_headers(), params=params, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"List attachments failed ({r.status_code}): {r.text}")

        data = r.json().get("data", [])
        if not data:
            break

        for attachment in data:
            attachment_ids.append(int(attachment["id"]))

        if len(data) < page_size:
            break
        page_number += 1

    return attachment_ids


def delete_attachment(document_id: int, attachment_id: int) -> None:
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments/{attachment_id}"
    r = requests.delete(url, headers=key_headers(), timeout=60)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"Delete attachment failed ({r.status_code}): {r.text}")


def clear_attachments(document_id: int) -> None:
    attachment_ids = list_attachments(document_id)
    for aid in attachment_ids:
        delete_attachment(document_id, aid)
    if attachment_ids:
        log(f"  Cleared {len(attachment_ids)} existing attachments")


def sync_md_content(document_id: int, md_text: str) -> None:
    """
    Parse markdown into sections and POST each one to the document.
    Headings → Document::Heading, everything else → Document::Text blocks.
    """
    lines = md_text.split("\n")
    sort_idx = 0
    pending_lines: List[str] = []

    def flush_text() -> None:
        nonlocal sort_idx
        text = "\n".join(pending_lines).strip()
        if text:
            html = markdown.markdown(text, extensions=["tables", "fenced_code"])
            create_section(document_id, "Document::Text", html, sort_idx)
            sort_idx += 1

    for line in lines:
        m = re.match(r"^(#{1,6})\s+(.*)", line)
        if m:
            flush_text()
            pending_lines.clear()
            level = len(m.group(1))
            heading_text = m.group(2).strip()
            create_section(document_id, "Document::Heading", heading_text, sort_idx, level=level)
            sort_idx += 1
        else:
            pending_lines.append(line)

    flush_text()
    log(f"  Created {sort_idx} sections")


def sync_file_template(document_id: int, rel_path: pathlib.Path, repo: str) -> None:
    """
    Create a 2-section template for non-markdown files:
      - Document::Heading "File Overview"
      - Document::Text    metadata table + type description
    """
    ext = rel_path.suffix.lower()
    label = FILE_TYPE_LABELS.get(ext, ext.lstrip(".").upper() + " File")
    description = FILE_TYPE_DESCRIPTIONS.get(ext, "Open the attachment to view this file.")

    html = (
        f"<table>"
        f"<tr><th>Field</th><th>Value</th></tr>"
        f"<tr><td>File</td><td>{rel_path.name}</td></tr>"
        f"<tr><td>Type</td><td>{label}</td></tr>"
        f"<tr><td>Path</td><td>{rel_path.as_posix()}</td></tr>"
        f"<tr><td>Repository</td><td>{repo}</td></tr>"
        f"<tr><td>Synced from</td><td>GitHub Actions — see attachment for latest file</td></tr>"
        f"</table>"
        f"<p>{description}</p>"
    )

    create_section(document_id, "Document::Heading", "File Overview", sort=0, level=2)
    create_section(document_id, "Document::Text", html, sort=1)
    log(f"  Created file template ({label})")


def publish_document(document_id: int) -> None:
    """
    Publish a document.  PATCH /documents/:id/publish
    """
    url = f"{API_BASE}/documents/{document_id}/publish"

    r = requests.patch(url, headers=json_headers(), timeout=60)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Publish failed ({r.status_code}): {r.text}")
    log(f"  Published document {document_id}")


def upload_attachment(document_id: int, file_path: pathlib.Path) -> None:
    """
    Upload a file as an attachment.  POST /documents/:id/relationships/attachments
    """
    url = f"{API_BASE}/documents/{document_id}/relationships/attachments"

    with file_path.open("rb") as f:
        files = {"data[attributes][attachment]": (file_path.name, f)}
        data = {"data[type]": "attachments"}

        r = requests.post(
            url,
            headers=key_headers(),
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
                clear_sections(doc_id)
                clear_attachments(doc_id)

            # Sync content then publish
            if abs_path.suffix.lower() == ".md":
                md_text = abs_path.read_text(encoding="utf-8")
                sync_md_content(doc_id, md_text)
            else:
                sync_file_template(doc_id, rel_path, REPO)
            publish_document(doc_id)

            upload_attachment(doc_id, abs_path)
            log(f"  Uploaded attachment: {abs_path.name}")

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
