const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const Document = require('../models/Document');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const logger = require('../config/logger');
const config = require('../config/validateEnv');

const router = express.Router();

// Helper to run Python-based EasyOCR child process
function runEasyOCR(filePath) {
  return new Promise((resolve, reject) => {
    // Virtual environment python executable and script path
    const pythonPath = path.join(__dirname, '../.venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../scripts/ocr_process.py');

    logger.info('Spawning EasyOCR process', { filePath, pythonPath, scriptPath });

    const pyProcess = spawn(pythonPath, [scriptPath, filePath], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        logger.error('EasyOCR process failed', { code, stderr: stderrData.trim() });
        return reject(new Error(`EasyOCR process exited with code ${code}: ${stderrData.trim()}`));
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        if (result.error) {
          return reject(new Error(result.error));
        }
        resolve(result.text || '');
      } catch (err) {
        logger.error('Failed to parse EasyOCR stdout as JSON', { stdout: stdoutData, error: err.message });
        reject(new Error(`Invalid JSON output from EasyOCR process: ${err.message}`));
      }
    });

    pyProcess.on('error', (err) => {
      logger.error('Failed to spawn EasyOCR process', { error: err.message });
      reject(err);
    });
  });
}

// ── GET / — list all documents for current user (PAGINATED) ──────────────────
router.get('/', auth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [documents, totalCount] = await Promise.all([
      Document.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Document.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      documents,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /upload — upload a new document ──────────────────────────────────────
router.post('/upload', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const originalName = req.file.originalname;
    const title = req.body.title ||
      originalName.substring(0, originalName.lastIndexOf('.')) ||
      originalName;

    const doc = new Document({
      title,
      fileName: req.file.filename,
      fileUrl,
      mimeType: req.file.mimetype,
      userId: req.user._id,
      status: 'pending'
    });

    await doc.save();
    logger.info('Document uploaded', { docId: doc._id, title, mimeType: doc.mimeType });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

// ── POST /search — full-text search across title and OCR text (PAGINATED) ────
// IMPORTANT: must be declared before /:id routes to avoid route shadowing.
router.post('/search', auth, async (req, res, next) => {
  try {
    const { query, page: rawPage, limit: rawLimit } = req.body;
    if (!query || !query.trim()) {
      return res.json({ documents: [], totalCount: 0, page: 1, totalPages: 0 });
    }

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));
    const skip = (page - 1) * limit;

    // Match any of the query words, case-insensitive, across title + textContent
    const words = query.trim().split(/\s+/).filter(Boolean);
    const regex = new RegExp(words.join('|'), 'i');

    const filter = {
      userId: req.user._id,
      $or: [
        { title: { $regex: regex } },
        { textContent: { $regex: regex } }
      ]
    };

    const [documents, totalCount] = await Promise.all([
      Document.find(filter).skip(skip).limit(limit),
      Document.countDocuments(filter),
    ]);

    res.json({
      documents,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id — fetch a single document ────────────────────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// ── DELETE /:id — delete a document and its file ──────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const filePath = path.join(__dirname, '../uploads', doc.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.deleteOne({ _id: doc._id });
    logger.info('Document deleted', { docId: doc._id });
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ── POST /:id/process-ocr — run OCR / text extraction on the document ────────
router.post('/:id/process-ocr', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    doc.status = 'processing';
    await doc.save();

    // Respond immediately — extraction runs async after response
    res.json({ message: 'OCR processing started', document: doc });

    const filePath = path.join(__dirname, '../uploads', doc.fileName);

    if (doc.mimeType.startsWith('image/')) {
      // ── Image → Sharp preprocessing + Tesseract OCR ────────────────────
      try {
        const sharp = require('sharp');

        // Step 1: Detect orientation using Tesseract OSD
        let rotationAngle = 0;
        try {
          const osd = await Tesseract.detect(filePath);
          if (osd.data && osd.data.orientation_degrees && osd.data.orientation_confidence > 0.5) {
            // OSD reports the angle the text is AT; we rotate by (360 - that) to upright it
            rotationAngle = (360 - osd.data.orientation_degrees) % 360;
            logger.info('Detected image orientation', {
              docId: doc._id,
              detectedAngle: osd.data.orientation_degrees,
              correction: rotationAngle,
              confidence: osd.data.orientation_confidence,
            });
          }
        } catch (osdErr) {
          logger.warn('OSD detection failed, proceeding without rotation', {
            docId: doc._id,
            error: osdErr.message,
          });
        }

        // Step 2: Preprocess image with sharp
        const preprocessed = await sharp(filePath)
          .rotate(rotationAngle)                         // Fix orientation
          .greyscale()                                   // Convert to greyscale
          .sharpen({ sigma: 1.5 })                       // Sharpen text edges
          .normalise()                                   // Stretch contrast
          .resize({ width: 3000, withoutEnlargement: true }) // Ensure high-res
          .png()
          .toBuffer();

        logger.debug('Image preprocessed', { docId: doc._id, bytes: preprocessed.length });

        // Step 3: Run OCR (EasyOCR by default, falling back to Tesseract.js)
        let text = '';
        if (config.OCR_ENGINE === 'easyocr') {
          const tempPreprocessedPath = path.join(__dirname, '../uploads', `temp-preprocessed-${doc._id}.png`);
          try {
            fs.writeFileSync(tempPreprocessedPath, preprocessed);
            text = await runEasyOCR(tempPreprocessedPath);
          } catch (easyOcrErr) {
            logger.warn('EasyOCR failed for image, falling back to Tesseract.js', {
              docId: doc._id,
              error: easyOcrErr.message
            });
            // Fallback to Tesseract.js
            const { data: { text: fallbackText } } = await Tesseract.recognize(preprocessed, 'eng', {
              logger: m => logger.debug(`OCR [${doc.fileName}] (Fallback): ${m.status}`)
            });
            text = fallbackText;
          } finally {
            if (fs.existsSync(tempPreprocessedPath)) {
              fs.unlinkSync(tempPreprocessedPath);
            }
          }
        } else {
          // Direct Tesseract.js
          const { data: { text: tesseractText } } = await Tesseract.recognize(preprocessed, 'eng', {
            logger: m => logger.debug(`OCR [${doc.fileName}]: ${m.status}`)
          });
          text = tesseractText;
        }

        doc.status = 'completed';
        doc.textContent = text;
        await doc.save();
        logger.info(`OCR completed for image`, { docId: doc._id, fileName: doc.fileName });
      } catch (ocrError) {
        logger.error('Image OCR failed', { docId: doc._id, error: ocrError.message });
        doc.status = 'error';
        await doc.save();
      }

    } else if (doc.mimeType === 'application/pdf') {
      // ── PDF → pdf-parse (text layer) with Tesseract fallback (scanned) ─
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);

        // pdf-parse returns whitespace-only text for scanned PDFs
        const extractedText = (pdfData.text || '').trim();

        if (extractedText.length > 0) {
          // PDF had a text layer — use it directly
          doc.status = 'completed';
          doc.textContent = extractedText;
          await doc.save();
          logger.info('PDF text extraction completed (text layer)', {
            docId: doc._id,
            pages: pdfData.numpages,
            chars: extractedText.length,
          });
        } else {
          // Scanned PDF — fall back to pdf-to-png-converter + Tesseract
          logger.info('PDF has no text layer, attempting OCR via pdf-to-png-converter', { docId: doc._id });

          try {
            const { pdfToPng } = require('pdf-to-png-converter');
            const pngPages = await pdfToPng(filePath, {
              viewportScale: 1.5,
            });

            const pages = pngPages.length;
            const ocrTexts = [];

            for (let i = 0; i < pages; i++) {
              const pageImage = pngPages[i];
              let pageText = '';

              if (config.OCR_ENGINE === 'easyocr') {
                const tempPagePath = path.join(__dirname, '../uploads', `temp-page-${doc._id}-${i}.png`);
                try {
                  fs.writeFileSync(tempPagePath, pageImage.content);
                  pageText = await runEasyOCR(tempPagePath);
                } catch (easyOcrErr) {
                  logger.warn(`EasyOCR failed on PDF page ${i+1}, falling back to Tesseract.js`, {
                    docId: doc._id,
                    error: easyOcrErr.message
                  });
                  const { data: { text: fallbackText } } = await Tesseract.recognize(pageImage.content, 'eng', {
                    logger: m => logger.debug(`OCR [${doc.fileName}] Page ${i+1}/${pages} (Fallback): ${m.status}`)
                  });
                  pageText = fallbackText;
                } finally {
                  if (fs.existsSync(tempPagePath)) {
                    fs.unlinkSync(tempPagePath);
                  }
                }
              } else {
                const { data: { text: directText } } = await Tesseract.recognize(pageImage.content, 'eng', {
                  logger: m => logger.debug(`OCR [${doc.fileName}] Page ${i+1}/${pages}: ${m.status}`)
                });
                pageText = directText;
              }

              ocrTexts.push(pageText);
            }

            doc.status = 'completed';
            doc.textContent = ocrTexts.join('\n\n--- Page Break ---\n\n');
            await doc.save();
            logger.info('PDF OCR completed (scanned)', { docId: doc._id, pages });
          } catch (ocrFallbackError) {
            logger.error('PDF OCR fallback failed', { docId: doc._id, error: ocrFallbackError.message });
            doc.status = 'completed';
            doc.textContent = '[This PDF appears to be scanned. OCR processing failed — please verify the file integrity.]';
            await doc.save();
          }
        }
      } catch (pdfError) {
        logger.error('PDF processing failed', { docId: doc._id, error: pdfError.message });
        doc.status = 'error';
        await doc.save();
      }

    } else {
      doc.status = 'error';
      await doc.save();
      logger.warn('Unsupported file type for OCR', { docId: doc._id, mimeType: doc.mimeType });
    }
  } catch (error) {
    logger.error('Error starting OCR', { error: error.message });
    if (!res.headersSent) {
      next(error);
    }
  }
});

module.exports = router;
