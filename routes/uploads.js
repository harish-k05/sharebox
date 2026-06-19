const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Upload = require('../models/Upload');
const cloudinary = require('../config/cloudinary');

// Multer Memory Storage Configuration
const storage = multer.memoryStorage();

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

// Initialize Multer with memory storage
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  }
});

// Helper function to upload stream to Cloudinary
const uploadToCloudinary = (buffer, originalName, mimeType) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'auto',
      folder: 'sharebox-uploads',
      public_id: `${Date.now()}-${path.parse(originalName).name}`,
      overwrite: true
    };

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// @route   POST /api/uploads
// @desc    Upload file and note to Cloudinary
router.post('/', (req, res) => {
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
        return res.status(400).json({ error: 'Uploader name is required.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Please select a file to upload.' });
      }

      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Save metadata to MongoDB
      const newUpload = new Upload({
        uploader: uploader.trim(),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        note: note ? note.trim() : '',
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id
      });

      const savedUpload = await newUpload.save();
      res.status(201).json(savedUpload);
    } catch (err) {
      console.error('Upload error:', err);
      if (err.message && err.message.includes('Cloudinary')) {
        res.status(500).json({ error: 'Failed to upload file to cloud storage.' });
      } else {
        res.status(500).json({ error: 'Database saving error.' });
      }
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
// @desc    Download file by ID (redirect to Cloudinary)
router.get('/:id/download', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Redirect to Cloudinary URL
    res.redirect(fileRecord.cloudinaryUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error downloading file.' });
  }
});

// @route   DELETE /api/uploads/:id
// @desc    Delete file from Cloudinary and MongoDB
router.delete('/:id', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File record not found.' });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(fileRecord.cloudinaryPublicId, {
        resource_type: 'auto'
      });
    } catch (cloudinaryErr) {
      console.error('Cloudinary deletion error:', cloudinaryErr);
      // Continue with database deletion even if Cloudinary deletion fails
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
