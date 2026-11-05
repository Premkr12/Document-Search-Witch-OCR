const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  // Name on disk (generated); the file is served through GET /api/documents/:id/file
  fileName: {
    type: String,
    required: true
  },
  // Name of the file the user uploaded
  originalName: {
    type: String,
    default: null
  },
  // Legacy absolute URL from older uploads — no longer written or returned
  fileUrl: {
    type: String
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: null
  },
  // Tesseract language code used for OCR
  language: {
    type: String,
    default: 'eng'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'error'],
    default: 'pending'
  },
  errorMessage: {
    type: String,
    default: null
  },
  textContent: {
    type: String,
    default: ''
  },
  // Extracted text, one entry per page
  pages: {
    type: [String],
    default: []
  },
  // 'pdf-text' when every page had a text layer, otherwise the OCR engine used
  engine: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  average_confidence: {
    type: Number,
    default: null
  },
  total_pages: {
    type: Number,
    default: null
  },
  processed_pages: {
    type: Number,
    default: null
  },
  // Times reading was restarted automatically after a server restart cut it short
  autoResumes: {
    type: Number,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  toJSON: {
    transform: (_doc, ret) => {
      delete ret.fileUrl;
      delete ret.autoResumes;
      delete ret.__v;
      return ret;
    }
  }
});

documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Document', documentSchema);
