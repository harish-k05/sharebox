const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  uploader: {
    type: String,
    required: [true, 'Uploader name is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  fileUrl: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true,
    unique: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Upload', uploadSchema);
