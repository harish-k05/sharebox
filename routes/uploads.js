const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Upload = require('../models/Upload');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique name: timestamp-random-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer File Filter - PDF & DOCX only
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.docx'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed!'), false);
  }
};

// Initialize Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// @route   POST /api/uploads
// @desc    Upload file and note
router.post('/', (req, res) => {
  // Use multer upload middleware
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds the 10MB limit.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    try {
      const { uploader, note } = req.body;

      if (!uploader || uploader.trim() === '') {
        // Clean up file if it was uploaded
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Uploader name is required.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Please select a file to upload.' });
      }

      const newUpload = new Upload({
        uploader: uploader.trim(),
        originalName: req.file.originalname,
        savedName: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        note: note ? note.trim() : ''
      });

      const savedUpload = await newUpload.save();
      res.status(201).json(savedUpload);
    } catch (dbErr) {
      // Clean up uploaded file if DB save fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (fsErr) {
          console.error('Failed to delete file after DB error:', fsErr);
        }
      }
      console.error(dbErr);
      res.status(500).json({ error: 'Database saving error.' });
    }
  });
});

// @route   GET /api/uploads
// @desc    Get all uploads with search and sort
router.get('/', async (req, res) => {
  try {
    const { search, sort } = req.query;
    let query = {};

    // Apply search filter (match name or originalName)
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { originalName: searchRegex },
          { uploader: searchRegex },
          { note: searchRegex }
        ]
      };
    }

    // Set sorting options
    let sortOptions = { uploadDate: -1 }; // Default to newest first
    if (sort === 'oldest') {
      sortOptions = { uploadDate: 1 };
    } else if (sort === 'alphabetical') {
      sortOptions = { originalName: 1 };
    }

    const uploads = await Upload.find(query).sort(sortOptions);
    res.json(uploads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error retrieving files.' });
  }
});

// @route   GET /api/uploads/:id/download
// @desc    Download file by ID
router.get('/:id/download', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.id || req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(fileRecord.filePath)) {
      return res.status(404).json({ error: 'File not found on server disk.' });
    }

    // Download file and specify its original filename to the browser
    res.download(fileRecord.filePath, fileRecord.originalName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error downloading file.' });
  }
});

// @route   DELETE /api/uploads/:id
// @desc    Delete file and note by ID
router.delete('/:id', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.id || req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File record not found.' });
    }

    // Attempt to delete file from filesystem
    try {
      if (fs.existsSync(fileRecord.filePath)) {
        fs.unlinkSync(fileRecord.filePath);
      }
    } catch (fsErr) {
      console.error(`Error deleting physical file at ${fileRecord.filePath}:`, fsErr);
      // We still proceed to remove the metadata from the database
    }

    // Delete record from Database
    await Upload.findByIdAndDelete(fileRecord._id);

    res.json({ message: 'File and note deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting file.' });
  }
});

module.exports = router;
