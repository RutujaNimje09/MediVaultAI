import os
import tempfile
import pytesseract
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
import fitz  # PyMuPDF

# Configure Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'D:\Tesseract-OCR\tesseract.exe'

app = FastAPI(
    title="MediVaultAI OCR Service",
    description="Microservice to extract text from medical documents",
    version="1.0.0"
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"]


def process_image(image: Image.Image) -> str:
    """Extracts text from a PIL Image using Tesseract OCR."""
    try:
        text = pytesseract.image_to_string(image)
        return text.strip()
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Tesseract OCR engine is not installed or not in the system PATH."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR processing failed: {str(e)}"
        )


def process_pdf(file_path: str) -> str:
    """
    Extracts text from a PDF.
    Reads embedded text first; if a page has no text (e.g. scanned), it renders it to an image and applies OCR.
    """
    try:
        doc = fitz.open(file_path)
        full_text = ""

        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text().strip()

            # Fallback to OCR if page has no extractable text
            if not text:
                pix = page.get_pixmap(dpi=300)
                mode = "RGBA" if pix.alpha else "RGB"
                img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
                text = process_image(img)

            full_text += text + "\n\n"

        doc.close()
        return full_text.strip()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF processing failed: {str(e)}")


@app.post("/ocr")
async def extract_ocr(file: UploadFile = File(...)):
    """
    Accepts an uploaded file (PDF, JPG, PNG), processes it with OCR, and returns the extracted text.
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

        # 4. Process the document based on content type
        if file.content_type == "application/pdf":
            extracted_text = process_pdf(temp_path)
        else:
            try:
                img = Image.open(temp_path)
                img.verify() # Verify it's actually an image

                # Re-open because verify() breaks the image state for processing
                img = Image.open(temp_path)
                extracted_text = process_image(img)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid or unreadable image file: {str(e)}"
                )

        return {
            "success": True,
            "filename": file.filename,
            "extracted_text": extracted_text
        }

    finally:
        # 5. Clean up temporary files safely
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "MediVaultAI OCR"}
