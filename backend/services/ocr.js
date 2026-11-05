/**
 * Text extraction pipeline.
 *
 * - PDFs: each page's text layer is read with pdf.js. Pages without a
 *   usable text layer (scanned pages) are rendered to PNG and sent to OCR.
 * - Images: auto-oriented and cleaned up with sharp, then sent to OCR.
 *
 * OCR runs on the engine set by OCR_ENGINE (EasyOCR, one Python process per
 * document, or Tesseract.js). Pages it can't read, or reads with less than
 * OCR_RETRY_BELOW confidence, are read again by the other engine. Jobs run
 * through a small in-process queue so a burst of uploads doesn't run every
 * OCR job at once.
 *
 * Nothing is allowed to hang: every engine call has a time limit (a hung
 * Python process or Tesseract worker is killed and the page goes to the other
 * engine), and every document has an overall limit after which it's marked as
 * failed and its queue slot is freed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const Document = require('../models/Document');
const config = require('../config/validateEnv');
const logger = require('../config/logger');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Tesseract language code → EasyOCR language list
const LANGUAGES = {
  eng: ['en'],
  hin: ['hi', 'en'],
  spa: ['es', 'en'],
  fra: ['fr', 'en'],
  deu: ['de', 'en'],
};

// A PDF page with fewer characters than this in its text layer is treated as scanned
const MIN_TEXT_LAYER_CHARS = 20;

// ── Time limits ──────────────────────────────────────────────────────────────

// One engine reading one page
const PAGE_MS = config.OCR_PAGE_TIMEOUT_SECONDS * 1000;
// Starting an engine: loading EasyOCR's model, starting a Tesseract worker, or
// downloading a language's data the first time it's used
const SETUP_MS = 5 * 60 * 1000;
// Shutting down a Tesseract worker
const TERMINATE_MS = 10 * 1000;
// A whole document: each engine may start twice and every page may be read
// twice (first reading + second opinion), plus a minute for everything else
const documentBudget = (pages) => 2 * SETUP_MS + Math.max(1, pages) * 2 * PAGE_MS + 60 * 1000;

// Documents interrupted by a server restart are resumed at most this many times,
// so a file that crashes the server can't put it in a restart loop
const MAX_AUTO_RESUMES = 2;

class OcrTimeoutError extends Error {}
class MissingFileError extends Error {}
class CancelledError extends Error {}

/**
 * Settle with `promise`, unless it takes longer than `ms` or `signal` aborts
 * first. If it settles after we've given up, `onLate` gets its value so late
 * resources (e.g. a worker that finally started) can be cleaned up.
 */
function guard(promise, { ms, what, signal, onLate } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      settle(value);
    };
    const giveUp = (err) => {
      if (settled) return;
      if (onLate) promise.then(onLate, () => {});
      finish(reject, err);
    };
    const onAbort = () => giveUp(signal.reason);

    if (signal && signal.aborted) return giveUp(signal.reason);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    if (ms) timer = setTimeout(() => giveUp(new OcrTimeoutError(`${what} took longer than ${Math.round(ms / 1000)}s`)), ms);
    promise.then((value) => finish(resolve, value), (err) => finish(reject, err));
  });
}

async function terminateWorker(worker) {
  try {
    await guard(worker.terminate(), { ms: TERMINATE_MS, what: 'Closing Tesseract' });
  } catch (err) {
    logger.warn('Could not close a Tesseract worker', { error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function detectRotation(buffer, signal) {
  let worker;
  try {
    worker = await guard(Tesseract.createWorker('osd', 0), {
      ms: SETUP_MS, what: 'Starting orientation detection', signal, onLate: terminateWorker,
    });
    const { data } = await guard(worker.detect(buffer), { ms: PAGE_MS, what: 'Orientation detection', signal });
    if (data && data.orientation_degrees && data.orientation_confidence > 0.5) {
      // OSD reports the angle the text is AT; rotate by (360 - that) to upright it
      return (360 - data.orientation_degrees) % 360;
    }
  } catch (err) {
    if (signal && signal.aborted) throw err;
    logger.warn('Orientation detection failed, continuing without rotation', { error: err.message });
  } finally {
    if (worker) await terminateWorker(worker);
  }
  return 0;
}

async function preprocessImage(input, signal) {
  // Apply EXIF orientation first (phone photos), then fix any remaining rotation
  const oriented = await sharp(input).rotate().toBuffer();
  const rotation = await detectRotation(oriented, signal);
  return sharp(oriented)
    .rotate(rotation)
    .greyscale()
    .sharpen({ sigma: 1.5 })
    .normalise()
    .resize({ width: 3000, withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Run EasyOCR over several images in one Python process, so the model loads once.
 * `onResult` is called as each image finishes: { index, text, confidence } or { index, error }.
 *
 * The process is killed if a page takes longer than PAGE_MS (the first page also
 * gets SETUP_MS for loading the model) or if `signal` aborts.
 */
function runEasyOCR(filePaths, languages, onResult, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(signal.reason);

    const scriptPath = path.join(__dirname, '../scripts/ocr_process.py');
    const proc = spawn(config.PYTHON_PATH, [scriptPath, '--langs', languages.join(','), ...filePaths], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stderr = '';
    let settled = false;
    let timer = null;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (err) {
        proc.kill();
        reject(err);
      } else {
        resolve();
      }
    };
    const arm = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(() => finish(new OcrTimeoutError(`EasyOCR took longer than ${Math.round(ms / 1000)}s on a page`)), ms);
    };
    const onAbort = () => finish(signal.reason);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    arm(SETUP_MS + PAGE_MS);

    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      if (settled || !line.trim()) return;
      try {
        const msg = JSON.parse(line);
        if (typeof msg.index === 'number') {
          arm(PAGE_MS);
          onResult(msg);
        }
      } catch {
        logger.debug('Ignoring non-JSON EasyOCR output', { line });
      }
    });

    proc.on('error', (err) => finish(err));
    proc.on('close', (code) => {
      if (code !== 0) return finish(new Error(`EasyOCR exited with code ${code}: ${stderr.trim().slice(-500)}`));
      finish();
    });
  });
}

/**
 * Read the given pages with EasyOCR. Pages it can't read are left out; if
 * EasyOCR can't run at all (e.g. Python isn't set up, or it hangs) the
 * remaining pages are left out.
 */
async function readWithEasyOCR(images, lang, indexes, onResult, signal) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docusearch-'));
  try {
    const paths = indexes.map((i) => {
      const p = path.join(tmpDir, `page-${i}.png`);
      fs.writeFileSync(p, images[i]);
      return p;
    });
    await runEasyOCR(paths, LANGUAGES[lang], (msg) => {
      const i = indexes[msg.index];
      if (msg.error) {
        logger.warn('EasyOCR could not read a page', { page: i + 1, error: msg.error });
        return;
      }
      onResult(i, { text: msg.text || '', confidence: Number(msg.confidence) || 0, engine: 'easyocr' });
    }, signal);
  } catch (err) {
    if (signal && signal.aborted) throw err;
    logger.warn('EasyOCR failed', { error: err.message });
  } finally {
    // A just-killed Python process may still hold the files for a moment
    await fs.promises.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      .catch((err) => logger.warn('Could not remove EasyOCR temp files', { dir: tmpDir, error: err.message }));
  }
}

/** Read the given pages with Tesseract.js. Throws if Tesseract fails or hangs. */
async function readWithTesseract(images, lang, indexes, onResult, signal) {
  const worker = await guard(Tesseract.createWorker(lang), {
    ms: SETUP_MS, what: 'Starting Tesseract', signal, onLate: terminateWorker,
  });
  try {
    for (const i of indexes) {
      const { data } = await guard(worker.recognize(images[i]), { ms: PAGE_MS, what: `Tesseract on page ${i + 1}`, signal });
      onResult(i, { text: data.text || '', confidence: data.confidence || 0, engine: 'tesseract' });
    }
  } finally {
    // Also stops a recognize() that timed out
    await terminateWorker(worker);
  }
}

const ENGINES = { easyocr: readWithEasyOCR, tesseract: readWithTesseract };

/**
 * OCR a list of PNG buffers. Returns [{ text, confidence, engine }] in input order.
 * `onPage` is called once per finished page.
 *
 * Pages go to the configured engine first. Pages it can't read go to the other
 * engine, and pages it reads with less than OCR_RETRY_BELOW confidence are read
 * again by the other engine, keeping whichever reading is more confident. Each
 * page goes to each engine at most once, so this always ends.
 */
async function recognizeImages(images, language, onPage, signal) {
  const lang = LANGUAGES[language] ? language : 'eng';
  const primary = config.OCR_ENGINE === 'tesseract' ? 'tesseract' : 'easyocr';
  const secondary = primary === 'easyocr' ? 'tesseract' : 'easyocr';
  const results = new Array(images.length);
  const all = images.map((_, i) => i);
  const save = (i, result) => {
    results[i] = result;
    onPage();
  };

  try {
    await ENGINES[primary](images, lang, all, save, signal);
  } catch (err) {
    if (signal && signal.aborted) throw err;
    logger.warn(`${primary} failed`, { error: err.message });
  }

  const unread = all.filter((i) => !results[i]);
  if (unread.length) {
    logger.warn(`${primary} couldn't read some pages, using ${secondary}`, { pages: unread.map((i) => i + 1) });
    await ENGINES[secondary](images, lang, unread, save, signal);
    const stillUnread = all.filter((i) => !results[i]);
    if (stillUnread.length) {
      throw new Error(`Neither OCR engine could read page(s) ${stillUnread.map((i) => i + 1).join(', ')}`);
    }
  }

  const doubtful = all.filter((i) => results[i].engine === primary && results[i].confidence < config.OCR_RETRY_BELOW);
  if (doubtful.length) {
    logger.info(`Low confidence, reading again with ${secondary}`, {
      pages: doubtful.map((i) => ({ page: i + 1, confidence: Math.round(results[i].confidence) })),
    });
    try {
      await ENGINES[secondary](images, lang, doubtful, (i, retry) => {
        const before = results[i];
        const better = retry.confidence > before.confidence;
        if (better) results[i] = retry;
        logger.info('Second reading', {
          page: i + 1,
          [primary]: Math.round(before.confidence),
          [secondary]: Math.round(retry.confidence),
          kept: better ? secondary : primary,
        });
      }, signal);
    } catch (err) {
      if (signal && signal.aborted) throw err;
      // A second opinion is optional; keep the first reading
      logger.warn(`Second reading with ${secondary} failed`, { error: err.message });
    }
  }

  return results;
}

/** The engine that read a document: one name, or "mixed" if pages differ. */
function engineOf(results) {
  const engines = new Set(results.map((r) => r.engine));
  return engines.size === 1 ? results[0].engine : 'mixed';
}

// pdfjs-dist is ESM-only, so it's loaded on first use
let pdfjs;
const loadPdfjs = () => (pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs'));

/** Read each page's text layer. Returns an array of strings, one per page. */
async function readPdfTextLayer(buffer) {
  const { getDocument } = await loadPdfjs();
  // pdf.js may take ownership of the bytes it's given, so pass a copy
  const pdf = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (typeof item.str === 'string') text += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(text.trim());
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.destroy();
  }
}

// ── Extraction ───────────────────────────────────────────────────────────────

async function extract(doc, onProgress, signal) {
  const filePath = path.join(UPLOAD_DIR, path.basename(doc.fileName || ''));
  if (!doc.fileName || !fs.existsSync(filePath)) {
    throw new MissingFileError(`Original file is missing: ${filePath}`);
  }
  let done = 0;
  const tick = () => onProgress(++done);

  if (doc.mimeType.startsWith('image/')) {
    await onProgress(0, 1);
    const image = await preprocessImage(filePath, signal);
    const [result] = await recognizeImages([image], doc.language, tick, signal);
    return { pages: [result.text.trim()], engine: result.engine, confidence: Math.round(result.confidence) };
  }

  if (doc.mimeType === 'application/pdf') {
    const pages = await readPdfTextLayer(fs.readFileSync(filePath));
    const scanned = pages
      .map((text, i) => (text.replace(/\s/g, '').length < MIN_TEXT_LAYER_CHARS ? i : null))
      .filter((i) => i !== null);

    await onProgress(pages.length - scanned.length, pages.length);
    done = pages.length - scanned.length;

    if (!scanned.length) {
      return { pages, engine: 'pdf-text', confidence: null };
    }

    const { pdfToPng } = require('pdf-to-png-converter');
    const rendered = await pdfToPng(filePath, {
      viewportScale: 2,
      pagesToProcess: scanned.map((i) => i + 1),
    });
    const images = rendered.map((p) => p.content);
    const results = await recognizeImages(images, doc.language, tick, signal);

    let confidenceSum = 0;
    results.forEach((r, k) => {
      pages[scanned[k]] = r.text.trim();
      confidenceSum += r.confidence;
    });
    return {
      pages,
      engine: engineOf(results),
      confidence: Math.round(confidenceSum / results.length),
    };
  }

  throw new Error(`Unsupported file type: ${doc.mimeType}`);
}

const ERROR_MESSAGES = {
  missing: "The original file is missing from the server, so it can't be read. Delete this document and upload the file again.",
  timeout: 'Reading took too long and was stopped. Try Read again; if it keeps happening, upload a clearer or smaller copy.',
  failed: "This file couldn't be read. Check that it opens on your computer, then try again.",
  interrupted: 'Reading was interrupted several times, so it was stopped. Try Read again, or upload a clearer or smaller copy.',
};

async function processDocument(job) {
  const { docId, signal } = job;
  const doc = await Document.findById(docId);
  if (!doc) return; // deleted while waiting in the queue

  await Document.updateOne({ _id: doc._id }, { $set: { status: 'processing', processed_pages: 0, errorMessage: null } });
  logger.info('Reading document', { docId: doc._id, mimeType: doc.mimeType, language: doc.language });

  const onProgress = (processed, total) => {
    // A job that ran out of time may still be finishing in the background; ignore it
    if (signal.aborted) return Promise.resolve();
    const update = { processed_pages: processed };
    if (total !== undefined) {
      update.total_pages = total;
      job.setPages(total);
    }
    return Document.updateOne({ _id: doc._id }, { $set: update }).exec()
      .catch((err) => logger.warn('Could not save reading progress', { docId: doc._id, error: err.message }));
  };

  try {
    // guard() stops waiting the moment the document runs out of time, even if
    // something inside extract() doesn't notice
    const { pages, engine, confidence } = await guard(extract(doc, onProgress, signal), { signal });
    await Document.updateOne({ _id: doc._id }, {
      $set: {
        status: 'completed',
        pages,
        textContent: pages.join('\n\n'),
        engine,
        average_confidence: confidence,
        total_pages: pages.length,
        processed_pages: pages.length,
        errorMessage: null,
        autoResumes: 0,
      },
    });
    logger.info('Document read', { docId: doc._id, pages: pages.length, engine, confidence });
  } catch (err) {
    if (err instanceof CancelledError) {
      logger.info('Stopped reading a deleted document', { docId: doc._id });
      return;
    }
    const kind = err instanceof MissingFileError ? 'missing' : err instanceof OcrTimeoutError ? 'timeout' : 'failed';
    logger.error('Reading document failed', { docId: doc._id, reason: kind, error: err.message, stack: kind === 'failed' ? err.stack : undefined });
    await Document.updateOne({ _id: doc._id }, {
      $set: { status: 'error', average_confidence: null, errorMessage: ERROR_MESSAGES[kind], autoResumes: 0 },
    });
  }
}

// ── Queue ────────────────────────────────────────────────────────────────────

const waiting = []; // document ids waiting for a free slot
const running = new Map(); // document id → job

function startJob(docId) {
  const controller = new AbortController();
  const startedAt = Date.now();
  let timer = null;
  const job = {
    docId,
    signal: controller.signal,
    cancel: () => controller.abort(new CancelledError('Document deleted')),
    // The time limit grows once the page count is known
    setPages(pages) {
      clearTimeout(timer);
      const budget = documentBudget(pages);
      timer = setTimeout(() => {
        logger.warn('Document ran out of time, stopping it', { docId, pages, minutes: Math.round(budget / 60000) });
        controller.abort(new OcrTimeoutError(`Reading took longer than ${Math.round(budget / 60000)} minutes`));
      }, Math.max(0, startedAt + budget - Date.now()));
    },
  };
  running.set(docId, job);
  job.setPages(1);

  processDocument(job)
    .catch((err) => logger.error('Unexpected OCR queue error', { docId, error: err.message }))
    .finally(() => {
      clearTimeout(timer);
      // Stop anything still running for this document (e.g. after a time-out)
      if (!controller.signal.aborted) controller.abort(new Error('Document finished'));
      running.delete(docId);
      pump();
    });
}

function pump() {
  while (running.size < config.OCR_CONCURRENCY && waiting.length) {
    startJob(waiting.shift());
  }
}

/** Queue a document for reading. Its status should already be 'pending'. */
function enqueue(docId) {
  const id = String(docId);
  if (!waiting.includes(id) && !running.has(id)) waiting.push(id);
  pump();
}

/** Whether a document is waiting in the queue or being read right now. */
function isQueued(docId) {
  const id = String(docId);
  return waiting.includes(id) || running.has(id);
}

/** Stop reading a document (e.g. because it's being deleted). */
function cancel(docId) {
  const id = String(docId);
  const index = waiting.indexOf(id);
  if (index !== -1) waiting.splice(index, 1);
  const job = running.get(id);
  if (job) job.cancel();
}

/** Re-queue documents that were waiting or mid-read when the server last stopped. */
async function resumeInterrupted() {
  const stuck = await Document.find({ status: { $in: ['pending', 'processing'] } })
    .select('_id status autoResumes')
    .sort({ createdAt: 1 })
    .lean();
  if (!stuck.length) return;
  logger.info('Resuming interrupted documents', { count: stuck.length });

  for (const doc of stuck) {
    if (doc.status === 'processing') {
      // It was being read when the server stopped — maybe because of this file
      if ((doc.autoResumes || 0) >= MAX_AUTO_RESUMES) {
        logger.warn('Not resuming a document that was interrupted too many times', { docId: doc._id });
        await Document.updateOne({ _id: doc._id }, {
          $set: { status: 'error', errorMessage: ERROR_MESSAGES.interrupted, autoResumes: 0 },
        });
        continue;
      }
      await Document.updateOne({ _id: doc._id }, { $set: { status: 'pending' }, $inc: { autoResumes: 1 } });
    }
    enqueue(doc._id);
  }
}

module.exports = {
  LANGUAGES,
  UPLOAD_DIR,
  enqueue,
  isQueued,
  cancel,
  resumeInterrupted,
};
