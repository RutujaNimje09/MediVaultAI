# MediVault AI - OCR Service

A standalone Python microservice built with FastAPI, Google Gemini Vision API, and Tesseract OCR to extract text from medical documents (PDF, JPG, JPEG, PNG).

## Features

- **Google Gemini Vision API**: High-accuracy transcription of both printed and handwritten medical documents.
- **Tesseract OCR Fallback**: Offline fallback when Gemini is unavailable, unconfigured, or offline.
- **PyMuPDF (`fitz`) Integration**: Direct digital text extraction for text PDFs; automatic high-resolution rendering (300 DPI) and vision OCR for scanned PDFs.
- **Configurable Models**: Free-tier vision models like `gemini-2.0-flash` or `gemini-1.5-flash`.
- **Safe Operation**: No secrets, medical document text, or image bytes are exposed in HTTP responses or service logs.

> [!IMPORTANT]
> **Data Privacy Notice:** Using the Google Gemini API transmits document contents to Google's generative AI service for processing. In the Google AI Studio free tier, prompt data may be used for model improvement. **Only non-sensitive test documents should be processed on the free tier.**

---

## Configuration

Copy `.env.example` to `.env` inside `ocr_service/` (or configure in the root `.env`):

```env
# OCR Provider: "auto" (default: uses Gemini if key is provided, else Tesseract), "gemini", or "tesseract"
OCR_PROVIDER=auto

# Google Gemini API Key (Obtain from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Model identifier (gemini-2.0-flash is recommended and free-tier capable)
GEMINI_MODEL=gemini-2.0-flash

# Tesseract Executable Path (Windows fallback)
TESSERACT_CMD=D:\Tesseract-OCR\tesseract.exe

# Maximum PDF pages to process with OCR (protection against oversized documents)
MAX_PDF_PAGES=15

# Request timeout in seconds for Gemini API calls
GEMINI_TIMEOUT_SECONDS=25
```

---

## Setup & Running

### 1. Activate Environment & Install Dependencies

From `ocr_service`:

```cmd
venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Test Suite

```cmd
python test_service.py
```

### 3. Start the FastAPI Service

```cmd
uvicorn main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`.

---

## API Endpoints

### `GET /health`
Returns service status, configured provider, and whether Gemini Vision is configured.

**Response:**
```json
{
  "status": "ok",
  "service": "MediVaultAI OCR",
  "gemini_configured": false,
  "gemini_model": "gemini-2.0-flash",
  "ocr_provider": "auto"
}
```

### `POST /ocr`
Accepts a file upload (`file`) and extracts text.

- **Content-Type**: `multipart/form-data`
- **Parameter**: `file` (File)
- **Allowed Types**: `image/jpeg`, `image/png`, `application/pdf`
- **Size Limit**: 10 MB

**Response:**
```json
{
  "success": true,
  "filename": "prescription.png",
  "extracted_text": "Amoxicillin 500mg...",
  "provider": "gemini"
}
```
*(If Tesseract fallback was used, `"provider": "tesseract"` is returned).*
