const mongoose = require('mongoose');
require('dotenv').config();
const Upload = require('../models/Upload');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Delete all documents with cloudinaryPublicId (old Cloudinary records)
      const result = await Upload.deleteMany({ cloudinaryPublicId: { $exists: true } });
      console.log(`✓ Deleted ${result.deletedCount} old Cloudinary documents`);
      
      // Verify remaining documents
      const count = await Upload.countDocuments();
      console.log(`Remaining documents: ${count}`);
      
      mongoose.connection.close();
      console.log('Cleanup complete');
    } catch (err) {
      console.error('Error cleaning up documents:', err);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
