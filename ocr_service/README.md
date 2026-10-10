# MediVault AI - OCR Service

A standalone Python microservice built with FastAPI and Tesseract OCR to extract text from medical documents (PDF, JPG, JPEG, PNG).

## Prerequisites (Windows)

1. **Python 3.9+** installed on your system.
2. **Tesseract OCR Engine** installed.
   - Download the Windows installer from: https://github.com/UB-Mannheim/tesseract/wiki
   - Install it (usually to `C:\Program Files\Tesseract-OCR`).
   - Add the Tesseract directory to your system's PATH environment variable, or configure the path in `main.py`.

## Setup Instructions

1. Open a terminal in this `ocr_service` directory.
2. Create a virtual environment:
   ```cmd
   python -m venv venv
   ```
3. Activate the virtual environment:
   ```cmd
   venv\Scripts\activate
   ```
4. Install the dependencies:
   ```cmd
   pip install -r requirements.txt
   ```

## Running the Service

1. Ensure your virtual environment is active.
2. Start the FastAPI server:
   ```cmd
   uvicorn main:app --reload --port 8000
   ```
3. The service will be available at `http://localhost:8000`.

## API Endpoints

### POST /ocr

Accepts a file upload and returns the extracted text.

- **Content-Type**: `multipart/form-data`
- **Parameter**: `file` (File)
- **Allowed Types**: `image/jpeg`, `image/png`, `application/pdf`
- **Size Limit**: 10 MB

#### Testing with cURL
```cmd
curl -X POST "http://localhost:8000/ocr" -H "accept: application/json" -H "Content-Type: multipart/form-data" -F "file=@C:\path\to\your\document.pdf"
```

You can also use the interactive Swagger UI to test the endpoint by navigating to:
`http://localhost:8000/docs`
