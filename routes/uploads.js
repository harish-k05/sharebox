const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Upload = require('../models/Upload');
const supabase = require('../config/supabase');

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

// Helper function to upload to Supabase Storage
const uploadToSupabase = (buffer, originalName, mimeType) => {
  return new Promise(async (resolve, reject) => {
    try {
      const fileName = path.parse(originalName).name;
      const fileExt = path.extname(originalName);
      const uniqueFileName = `${Date.now()}-${fileName}${fileExt}`;
      const bucketName = process.env.SUPABASE_BUCKET || 'sharebox-files';
      const storagePath = `${uniqueFileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        reject(error);
        return;
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      resolve({
        fileUrl: publicUrl,
        storagePath: storagePath
      });
    } catch (err) {
      reject(err);
    }
  });
};

// @route   POST /api/uploads
// @desc    Upload file and note to Supabase Storage
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

      // Upload to Supabase Storage
      const supabaseResult = await uploadToSupabase(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Log the result for debugging
      console.log('Supabase upload result:', {
        fileUrl: supabaseResult.fileUrl,
        storagePath: supabaseResult.storagePath
      });

   
      // Save metadata to MongoDB
      const newUpload = new Upload({
        uploader: uploader.trim(),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        note: note ? note.trim() : '',
        fileUrl: supabaseResult.fileUrl,
        storagePath: supabaseResult.storagePath
      });

      const savedUpload = await newUpload.save();
      res.status(201).json(savedUpload);
    } catch (err) {
      console.error('Upload error:', err);
      if (err.message && err.message.includes('Supabase')) {
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
// @desc    Download file by ID (redirect to Supabase file URL)
router.get('/:id/download', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Redirect to the stored Supabase file URL
    res.redirect(fileRecord.fileUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error downloading file.' });
  }
});

// @route   DELETE /api/uploads/:id
// @desc    Delete file from Supabase Storage and MongoDB
router.delete('/:id', async (req, res) => {
  try {
    const fileRecord = await Upload.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File record not found.' });
    }

    // Validate that storagePath exists
    if (!fileRecord.storagePath) {
      console.error('Missing storagePath for file:', fileRecord._id);
      return res.status(400).json({
        error: 'Legacy file record missing storage path. Cannot delete from cloud storage. Please contact administrator for manual cleanup.'
      });
    }

    const bucketName = process.env.SUPABASE_BUCKET || 'sharebox-files';

    // Delete from Supabase Storage first
    try {
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([fileRecord.storagePath]);

      if (error) {
        console.error('Supabase deletion error:', error);
        return res.status(500).json({
          error: 'Failed to delete file from cloud storage. Please try again.'
        });
      }
    } catch (supabaseErr) {
      console.error('Supabase deletion error:', supabaseErr);
      // Do not delete from MongoDB if Supabase deletion fails
      return res.status(500).json({
        error: 'Failed to delete file from cloud storage. Please try again.'
      });
    }

    // Only delete from MongoDB after successful Supabase deletion
    await Upload.findByIdAndDelete(fileRecord._id);

    res.json({ message: 'File and note deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting file.' });
  }
});

module.exports = router;
