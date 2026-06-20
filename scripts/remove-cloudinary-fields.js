const mongoose = require('mongoose');
require('dotenv').config();
const Upload = require('../models/Upload');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Remove Cloudinary fields from all documents
      const result = await Upload.updateMany(
        {},
        { 
          $unset: { 
            cloudinaryUrl: 1,
            cloudinaryPublicId: 1,
            cloudinaryResourceType: 1
          }
        }
      );
      console.log(`✓ Updated ${result.modifiedCount} documents`);
      
      mongoose.connection.close();
      console.log('Field removal complete');
    } catch (err) {
      console.error('Error removing fields:', err);
      mongoose.connection.close();
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
