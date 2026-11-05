const express = require('express');
const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const logger = require('../config/logger');
const ocr = require('../services/ocr');

const router = express.Router();

// Completed OCR results below this average confidence are flagged for attention
const LOW_CONFIDENCE = 70;

// Fields left out of list responses — they can be large
const SUMMARY_FIELDS = '-textContent -pages -fileUrl';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lowConfidenceFilter = {
  status: 'completed',
  engine: { $ne: 'pdf-text' },
  average_confidence: { $ne: null, $lt: LOW_CONFIDENCE },
};

function statusFilter(status) {
  switch (status) {
    case 'ready': return { status: 'completed' };
    case 'progress': return { status: { $in: ['pending', 'processing'] } };
    case 'attention': return { $or: [{ status: 'error' }, lowConfidenceFilter] };
    default: return {};
  }
}

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  title: { title: 1, createdAt: -1 },
};

// Older documents stored all pages in textContent separated by a marker
function pagesOf(doc) {
  if (doc.pages && doc.pages.length) return doc.pages;
  return (doc.textContent || '').split(/\n*--- Page Break ---\n*/);
}

function snippetAround(text, index, length) {
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, index - 80)));
  const endSpace = text.indexOf(' ', index + length + 110);
  const end = endSpace === -1 ? text.length : endSpace;
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
}

// ── GET / — list the current user's documents (paginated, filterable) ────────
router.get('/', auth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id, ...statusFilter(req.query.status) };
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      filter.title = { $regex: escapeRegex(req.query.q.trim()), $options: 'i' };
    }
    if (typeof req.query.ids === 'string' && req.query.ids) {
      filter._id = { $in: req.query.ids.split(',').slice(0, 100) };
    }

    const [documents, totalCount] = await Promise.all([
      Document.find(filter)
        .select(SUMMARY_FIELDS)
        .sort(SORTS[req.query.sort] || SORTS.newest)
        .skip(skip)
        .limit(limit),
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

// ── GET /stats — counts for the library header and filters ──────────────────
router.get('/stats', auth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [byStatus, lowConfidence] = await Promise.all([
      Document.aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Document.countDocuments({ userId, ...lowConfidenceFilter }),
    ]);

    const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    const completed = counts.completed || 0;
    const processing = counts.processing || 0;
    const pending = counts.pending || 0;
    const error = counts.error || 0;

    res.json({
      total: completed + processing + pending + error,
      completed,
      processing,
      pending,
      error,
      lowConfidence,
      attention: error + lowConfidence,
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /upload — store a file and queue it for reading ─────────────────────
router.post('/upload', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Choose a file to upload.' });
    }

    const originalName = req.file.originalname;
    const dot = originalName.lastIndexOf('.');
    const title = (req.body.title || '').trim() || (dot > 0 ? originalName.substring(0, dot) : originalName);
    const language = ocr.LANGUAGES[req.body.language] ? req.body.language : 'eng';

    const doc = new Document({
      title: title.slice(0, 200),
      fileName: req.file.filename,
      originalName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      language,
      userId: req.user._id,
      status: 'pending',
      processed_pages: 0,
    });

    await doc.save();
    logger.info('Document uploaded', { docId: doc._id, mimeType: doc.mimeType, language });

    ocr.enqueue(doc._id);
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

// ── POST /search — search every page of the user's documents ─────────────────
// IMPORTANT: must be declared before /:id routes to avoid route shadowing.
router.post('/search', auth, async (req, res, next) => {
  try {
    const { query, type, language, since, minConfidence } = req.body;
    const page = Math.max(1, parseInt(req.body.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.body.limit, 10) || 20));

    const terms = typeof query === 'string'
      ? query.trim().split(/\s+/).filter(Boolean).slice(0, 10).map(escapeRegex)
      : [];
    if (!terms.length) {
      return res.json({ results: [], totalCount: 0, totalMatches: 0, page: 1, totalPages: 0 });
    }

    const pattern = terms.join('|');
    const filter = {
      userId: req.user._id,
      status: 'completed',
      $or: [
        { title: { $regex: pattern, $options: 'i' } },
        { textContent: { $regex: pattern, $options: 'i' } },
      ],
    };
    if (type === 'pdf') filter.mimeType = 'application/pdf';
    if (type === 'image') filter.mimeType = { $regex: '^image/' };
    if (typeof language === 'string' && ocr.LANGUAGES[language]) filter.language = language;
    const sinceDays = parseInt(since, 10);
    if (sinceDays > 0) filter.createdAt = { $gte: new Date(Date.now() - sinceDays * 86400000) };
    const minConf = parseInt(minConfidence, 10);
    if (minConf > 0) {
      filter.$and = [{ $or: [{ engine: 'pdf-text' }, { average_confidence: { $gte: minConf } }] }];
    }

    const docs = await Document.find(filter)
      .select('title originalName fileName mimeType language engine average_confidence total_pages createdAt status pages textContent')
      .limit(500)
      .lean();

    const matcher = new RegExp(pattern, 'gi');
    const titleMatcher = new RegExp(pattern, 'i');

    const results = docs.map((doc) => {
      const hits = [];
      let matchCount = 0;
      pagesOf(doc).forEach((text, i) => {
        const flat = (text || '').replace(/\s+/g, ' ');
        const found = [...flat.matchAll(matcher)];
        if (!found.length) return;
        matchCount += found.length;
        hits.push({
          page: i + 1,
          count: found.length,
          snippet: snippetAround(flat, found[0].index, found[0][0].length),
        });
      });
      const { pages, textContent, ...summary } = doc;
      return {
        document: summary,
        matchCount,
        titleMatch: titleMatcher.test(doc.title),
        hits: hits.slice(0, 5),
        pagesWithMatches: hits.length,
      };
    });

    results.sort((a, b) =>
      (b.matchCount + (b.titleMatch ? 1 : 0)) - (a.matchCount + (a.titleMatch ? 1 : 0)) ||
      new Date(b.document.createdAt) - new Date(a.document.createdAt));

    const totalMatches = results.reduce((sum, r) => sum + r.matchCount, 0);
    const start = (page - 1) * limit;

    res.json({
      results: results.slice(start, start + limit),
      totalCount: results.length,
      totalMatches,
      page,
      totalPages: Math.ceil(results.length / limit),
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /:id — fetch a single document with its text ─────────────────────────
router.get('/:id', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const json = doc.toJSON();
    json.pages = pagesOf(doc);
    res.json(json);
  } catch (error) {
    next(error);
  }
});

// ── GET /:id/file — the original file, only for its owner ────────────────────
router.get('/:id/file', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select('fileName mimeType');
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const filePath = path.join(ocr.UPLOAD_DIR, path.basename(doc.fileName));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'The original file is missing.' });
    }
    res.set('Cache-Control', 'private, max-age=300');
    res.type(doc.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

// ── PATCH /:id — rename a document ───────────────────────────────────────────
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ message: 'Enter a title.' });
    }
    if (title.length > 200) {
      return res.status(400).json({ message: 'Titles can be up to 200 characters.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select(SUMMARY_FIELDS);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    doc.title = title;
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// ── DELETE /:id — delete a document and its file ─────────────────────────────
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select('fileName');
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Stop reading it first, so its queue slot is freed straight away
    ocr.cancel(doc._id);
    await fs.promises.rm(path.join(ocr.UPLOAD_DIR, path.basename(doc.fileName)), { force: true });
    await Document.deleteOne({ _id: doc._id });
    logger.info('Document deleted', { docId: doc._id });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
});

// ── POST /:id/process-ocr — read (or re-read) a document ────────────────────
router.post('/:id/process-ocr', auth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id }).select(SUMMARY_FIELDS);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    // Ask the queue rather than trusting the status: a document left as
    // "processing" by a crash or restart can be read again
    if (ocr.isQueued(doc._id)) {
      return res.status(409).json({ message: 'This document is already being read.' });
    }

    // Optionally re-read in a different language
    const language = req.body && req.body.language;
    if (language && ocr.LANGUAGES[language]) doc.language = language;

    doc.status = 'pending';
    doc.processed_pages = 0;
    doc.errorMessage = null;
    await doc.save();

    ocr.enqueue(doc._id);
    res.status(202).json(doc);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
