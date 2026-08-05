import base64
import os

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown", ".docx"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS
MIME_BY_EXTENSION = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}
MAX_TEXT_CHARS = 20_000
_LEGACY_HINTS = {
    ".doc": "Legacy .doc files are not supported — open it in Word and save as .docx.",
}


class UnsupportedFileError(ValueError):
    """The file's extension is not one we can extract."""


def extension_of(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def kind_for(filename: str) -> str:
    from src.models.attachment_model import KIND_DOCUMENT, KIND_IMAGE

    ext = extension_of(filename)
    if ext in IMAGE_EXTENSIONS:
        return KIND_IMAGE
    if ext in DOCUMENT_EXTENSIONS:
        return KIND_DOCUMENT

    hint = _LEGACY_HINTS.get(ext)
    if hint:
        raise UnsupportedFileError(hint)
    raise UnsupportedFileError(
        f"Unsupported file type '{ext or filename}'. "
        f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
    )


def mime_type_for(filename: str, fallback: str | None = None) -> str:
    return MIME_BY_EXTENSION.get(extension_of(filename)) or fallback or "image/png"


def extract_text(file_path: str, filename: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file {file_path} does not exist.")

    ext = extension_of(filename)
    if ext == ".pdf":
        text = _extract_pdf(file_path)
    elif ext == ".docx":
        text = _extract_docx(file_path)
    elif ext in {".txt", ".md", ".markdown"}:
        text = _extract_plain_text(file_path)
    elif ext in IMAGE_EXTENSIONS:
        text = _extract_image_ocr(file_path)
    else:
        raise UnsupportedFileError(f"Unsupported file type '{ext}'")

    return _truncate(text.strip())


def read_base64(file_path: str) -> str:
    """The file's bytes as base64, for sending an image to a vision model."""
    with open(file_path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


# ── Per-format extractors ────────────────────────────────────────────────


def _extract_pdf(file_path: str) -> str:
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    pages = []
    for number, page in enumerate(reader.pages, start=1):
        content = (page.extract_text() or "").strip()
        if content:
            pages.append(f"[page {number}]\n{content}")
    return "\n\n".join(pages)


def _extract_docx(file_path: str) -> str:
    import docx2txt

    return docx2txt.process(file_path) or ""


def _extract_plain_text(file_path: str) -> str:
    with open(file_path, "rb") as f:
        raw = f.read()
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _extract_image_ocr(file_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return ""

    try:
        with Image.open(file_path) as image:
            return pytesseract.image_to_string(image) or ""
    except Exception:  # noqa: BLE001 - tesseract missing, or an image it can't read
        return ""


def _truncate(text: str) -> str:
    if len(text) <= MAX_TEXT_CHARS:
        return text
    return text[:MAX_TEXT_CHARS] + "\n\n[… truncated, the file was too long]"
