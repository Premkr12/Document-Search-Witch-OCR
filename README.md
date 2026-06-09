# Document Search & OCR Insight (MERN Stack)

Welcome to the **Document Search & OCR Insight** repository. This is a production-ready, full-stack MERN (MongoDB, Express, React, Node.js) application featuring dual-engine Optical Character Recognition (OCR) powered by **EasyOCR** and **Tesseract.js**.

---

## Features

- **Double OCR Engines**: Advanced OCR powered by **EasyOCR** (PyTorch Deep Learning CRAFT & CRNN models) for maximum accuracy on tables, mathematical equations, and rotated text. Built-in seamless fallback to **Tesseract.js** for high availability.
- **Scanned PDF Support**: Dynamic text layer extraction. If the PDF is scanned (image-only), it automatically extracts pages to PNG images in-memory, runs OCR page-by-page, and merges the text.
- **Full-Text search**: Search through title and OCR'd document content with fast pagination support.
- **Production-Grade Security**:
  - Helmet headers protection.
  - CORS origin lockdowns.
  - API rate-limiting thresholds (auth endpoints, uploads, general API).
- **Architecture & Reliability**:
  - Global Express error-handling middleware.
  - Winston structured logging (development console logs, production JSON files).
  - Strict environment variables validation on startup.

---

## Prerequisites

Ensure you have the following installed locally:
- **[Node.js](https://nodejs.org/en/download/)** (v18 or higher recommended)
- **[Python 3](https://www.python.org/downloads/)** (v3.8 - v3.14, for EasyOCR processing)
- **[MongoDB Community Server](https://www.mongodb.com/try/download/community)** (Ensure your local MongoDB instance is running)
- **Git**

---

## Installation & Setup

### 1. Root & Inner Node.js Dependencies
Install the root concurrency package and the frontend/backend dependencies:

```bash
# Install root dependencies
npm install

# Install both backend and frontend package dependencies concurrently
npm run install:all
```

*(Alternatively, you can manually `cd` into `backend` and `frontend` folders and run `npm install` in each).*

---

### 2. Python Virtual Environment (For EasyOCR)
To enable the high-accuracy EasyOCR model, you need to set up a Python virtual environment inside the `backend` directory:

```bash
# Navigate to backend
cd backend

# Create a local virtual environment named .venv
python -m venv .venv

# Activate and install EasyOCR dependencies
.venv\Scripts\pip install easyocr
```

> [!NOTE]
> **OpenCV/Pillow Resampling Patch:**
> EasyOCR has a compatibility bug on newer Pillow/OpenCV versions where it passes a Pillow enum (`Image.Resampling.LANCZOS`) to OpenCV's `cv2.resize` function. If you encounter an OpenCV error (`(-215:Assertion failed) !ssize.empty()`), you can fix it by opening `.venv/Lib/site-packages/easyocr/utils.py` and replacing occurrences of `Image.Resampling.LANCZOS` with `cv2.INTER_LANCZOS4`.

---

### 3. Configure Environment Variables
Create a `.env` file in the `backend/` directory:

```bash
# In the backend directory
type nul > .env
```
*(On macOS/Linux, run `touch .env` instead).*

Add the following environment variables to your `backend/.env` file:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/text-scan-insight
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_in_production
CORS_ORIGIN=http://localhost:5173

# OCR Configuration
# Options: 'easyocr' (requires Python virtual env setup) or 'tesseract' (direct WebAssembly)
OCR_ENGINE=easyocr
```

---

## Running the Application

To boot both the frontend and backend servers concurrently under hot-reloading:

```bash
# From the project root directory
npm run dev
```

- **Frontend client** will launch on Vite's dev server port (e.g. `http://localhost:5173`).
- **Backend server** will boot on `http://localhost:5000`.
- Ensure MongoDB is running in the background before launching the servers.
