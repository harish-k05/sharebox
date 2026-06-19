require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Parse Request Bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sharebox';
console.log('Connecting to MongoDB...');

mongoose.connect(dbUri)
  .then(() => {
    console.log('MongoDB Connected Successfully.');
  })
  .catch((err) => {
    console.error('MongoDB Connection Error:', err.message);
    console.log('Ensure your MongoDB Atlas or local MongoDB is running and MONGODB_URI is correctly configured in .env');
  });

// API Routes
const uploadsRouter = require('./routes/uploads');
app.use('/api/uploads', uploadsRouter);

// Catch-all route to serve Frontend index.html for undefined paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configure Port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` ShareBox server running on: http://localhost:${PORT}`);
  console.log(` Mode: Development`);
  console.log(`==================================================`);
});
