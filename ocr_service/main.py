import os
import io
import base64
import logging
import tempfile
from typing import Tuple, Optional
import requests
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
import fitz  # PyMuPDF
import pytesseract
from dotenv import load_dotenv

# Securely load environment variables strictly from ocr_service's local .env file
# relative to the current service module directory
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_ENV_PATH = os.path.join(SERVICE_DIR, ".env")
if os.path.exists(LOCAL_ENV_PATH):
    load_dotenv(dotenv_path=LOCAL_ENV_PATH, override=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("medivault_ocr")

# Configure Tesseract path
TESSERACT_PATH = os.getenv("TESSERACT_CMD", r"D:\Tesseract-OCR\tesseract.exe")
if os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
OCR_PROVIDER = os.getenv("OCR_PROVIDER", "auto").strip().lower()
GEMINI_TIMEOUT = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "25"))
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "15"))

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"]

TRANSCRIPTION_PROMPT = (
    "Transcribe all visible text from this medical document with highest possible accuracy and fidelity. "
    "Strict requirements:\n"
    "1. Preserve the original reading order, line breaks, section headings, and layout structure.\n"
    "2. Preserve all dates, numerical values, decimal points, ranges, reference intervals, units of measurement, and symbols.\n"
    "3. Transcribe medical terminology, pharmaceutical drug names, dosages, frequencies, routes, and abbreviations exactly as written.\n"
    "4. Do NOT diagnose the patient, infer symptoms, interpret findings, or provide clinical advice.\n"
    "5. Do NOT hallucinate or invent unreadable text. Mark truly illegible or obscured portions as [unclear].\n"
    "6. Return ONLY the transcribed text without conversational commentary, markdown wrappers, or explanations."
)

app = FastAPI(
    title="MediVaultAI OCR Service",
    description="Microservice to extract text from medical documents using Gemini Vision and Tesseract",
    version="1.1.0"
)


def call_gemini_vision(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Sends image bytes directly to Google Gemini REST API using inlineData.
    Authenticates via x-goog-api-key header to prevent exposing the API key in URLs or logs.
    Returns transcribed text string.
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    # Clean mime type
    if mime_type not in ["image/jpeg", "image/png"]:
        mime_type = "image/jpeg"

    # Use header-based authentication to avoid leaking secrets in request URLs or logs
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    encoded_data = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": TRANSCRIPTION_PROMPT},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": encoded_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1
        }
    }

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
    }

    try:
        response = requests.post(
            endpoint,
            headers=headers,
            json=payload,
            timeout=GEMINI_TIMEOUT
        )
    except requests.exceptions.Timeout:
        raise RuntimeError(f"Gemini API request timed out after {GEMINI_TIMEOUT} seconds")
    except requests.exceptions.RequestException as req_err:
        raise RuntimeError(f"Gemini API network error: {type(req_err).__name__}")

    if response.status_code != 200:
        error_detail = "Gemini API request failed"
        try:
            err_json = response.json()
            if "error" in err_json and "message" in err_json["error"]:
                raw_msg = str(err_json["error"]["message"])
                # Sanitize error detail so API key is never reflected/leaked in exceptions or logs
                if GEMINI_API_KEY and GEMINI_API_KEY in raw_msg:
                    raw_msg = raw_msg.replace(GEMINI_API_KEY, "[REDACTED]")
                error_detail = raw_msg
        except Exception:
            pass
        raise RuntimeError(f"Gemini API error (HTTP {response.status_code}): {error_detail}")

    resp_data = response.json()
    candidates = resp_data.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini API returned no text candidates")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or "text" not in parts[0]:
        return ""

    return parts[0]["text"].strip()


def process_image_with_tesseract(image: Image.Image) -> str:
    """Extracts text from a PIL Image using Tesseract OCR."""
    try:
        text = pytesseract.image_to_string(image)
        return text.strip()
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Tesseract OCR engine is not installed or not in the system PATH."
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="OCR processing failed."
        )


def process_image(image: Image.Image, original_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> Tuple[str, str]:
    """
    Processes an image using Gemini Vision if configured/enabled, falling back to Tesseract.
    Returns (extracted_text, provider_used).
    """
    can_use_gemini = (OCR_PROVIDER in ["gemini", "auto"]) and bool(GEMINI_API_KEY)

    if can_use_gemini:
        try:
            # Ensure we have JPEG or PNG bytes for the Gemini call
            if original_bytes:
                img_data = original_bytes
                send_mime = mime_type
            else:
                buffer = io.BytesIO()
                # Convert RGBA to RGB for JPEG compatibility if necessary
                if image.mode in ("RGBA", "P"):
                    image.convert("RGB").save(buffer, format="JPEG", quality=95)
                else:
                    image.save(buffer, format="JPEG", quality=95)
                img_data = buffer.getvalue()
                send_mime = "image/jpeg"

            text = call_gemini_vision(img_data, mime_type=send_mime)
            logger.info("OCR successfully completed using Gemini Vision")
            return text, "gemini"
        except Exception as e:
            logger.warning("Gemini Vision processing failed, falling back to Tesseract. Reason: %s", str(e))
            if OCR_PROVIDER == "gemini":
                # If provider is explicitly set to gemini and failed, try Tesseract fallback but log clearly
                pass

    # Fallback to Tesseract
    logger.info("Processing image with Tesseract OCR engine")
    text = process_image_with_tesseract(image)
    return text, "tesseract"


def process_pdf(file_path: str) -> Tuple[str, str]:
    """
    Extracts text from a PDF.
    Reads embedded text first; if pages have no text (scanned), renders to an image and applies OCR.
    Handles multi-page documents while protecting against oversized inputs.
    Returns (extracted_text, provider_used).
    """
    doc = None
    try:
        doc = fitz.open(file_path)
        page_count = len(doc)
        full_text = ""
        provider_used = "direct_text"
        ocr_invoked = False

        pages_to_process = min(page_count, MAX_PDF_PAGES)

        for page_num in range(pages_to_process):
            page = doc.load_page(page_num)
            text = page.get_text().strip()

            # Fallback to OCR if page has no extractable text
            if not text:
                ocr_invoked = True
                pix = page.get_pixmap(dpi=300)
                img_bytes = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_bytes))

                page_text, page_provider = process_image(img, original_bytes=img_bytes, mime_type="image/png")
                text = page_text
                provider_used = page_provider

            if text:
                full_text += text + "\n\n"

        if not ocr_invoked:
            provider_used = "pdf_embedded_text"

        return full_text.strip(), provider_used
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="PDF processing failed.")
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass


@app.post("/ocr")
async def extract_ocr(file: UploadFile = File(...)):
    """
    Accepts an uploaded file (PDF, JPG, PNG), processes it with OCR (Gemini Vision with Tesseract fallback),
    and returns the extracted text and provider used.
    """
    # 1. Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF, JPG, JPEG, and PNG are allowed."
        )

    # 2. Read file and validate size limit
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 10 MB."
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=400,
            detail="Empty file uploaded."
        )

    # 3. Save to a temporary file for safe processing
    temp_fd, temp_path = tempfile.mkstemp()
    try:
        with os.fdopen(temp_fd, "wb") as f:
            f.write(contents)

        extracted_text = ""
        provider_used = "tesseract"

        # 4. Process document based on content type
        if file.content_type == "application/pdf":
            extracted_text, provider_used = process_pdf(temp_path)
        else:
            try:
                with Image.open(temp_path) as check_img:
                    check_img.verify()

                with Image.open(temp_path) as img:
                    img.load()  # Ensure full image data is loaded into memory
                    extracted_text, provider_used = process_image(
                        img,
                        original_bytes=contents,
                        mime_type=file.content_type
                    )
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid or unreadable image file."
                )

        return {
            "success": True,
            "filename": file.filename,
            "extracted_text": extracted_text,
            "provider": provider_used
        }

    finally:
        # 5. Clean up temporary files safely
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass


@app.get("/health")
def health_check():
    gemini_ready = bool(GEMINI_API_KEY)
    return {
        "status": "ok",
        "service": "MediVaultAI OCR",
        "gemini_configured": gemini_ready,
        "gemini_model": GEMINI_MODEL,
        "ocr_provider": OCR_PROVIDER
    }
