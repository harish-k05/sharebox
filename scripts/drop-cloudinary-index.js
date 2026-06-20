const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Drop the old index
      await mongoose.connection.db.collection('uploads').dropIndex('cloudinaryPublicId_1');
      console.log('✓ Dropped cloudinaryPublicId_1 index');
      
      // List remaining indexes
      const indexes = await mongoose.connection.db.collection('uploads').getIndexes();
      console.log('Remaining indexes:', Object.keys(indexes));
      
      mongoose.connection.close();
      console.log('Migration complete');
    } catch (err) {
      if (err.code === 27) {
        console.log('Index cloudinaryPublicId_1 does not exist - already cleaned');
      } else {
        console.error('Error dropping index:', err);
      }
      mongoose.connection.close();
    }
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
