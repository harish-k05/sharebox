# ShareBox - File & Note Sharing Web Application

ShareBox is a simple, clean, and modern web application that allows friends to upload PDF and DOCX files, write an accompanying note, search uploaded files by name, and download or delete shared documents.

Designed with a premium **glassmorphic dark-mode interface**, it features smooth gradients, micro-interactions, responsive sizing, and drag-and-drop uploads.

---

## Technical Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Mongoose ORM)
- **File Upload Middleware:** Multer
- **Frontend:** Vanilla HTML5 (Semantic elements), CSS3 (Custom properties, HSL colors, Backdrop-filters), JavaScript (ES6+, Fetch API, Event loops, Debouncing)

---

## Folder Structure

```text
sharebox/
├── models/
│   └── Upload.js         # Mongoose schema for document metadata
├── public/
│   ├── css/
│   │   └── style.css     # Premium dark-mode glassmorphic styling
│   ├── js/
│   │   └── app.js        # Form validation, upload handlers, and view refreshes
│   └── index.html        # Responsive frontend board layout
├── routes/
│   └── uploads.js        # Express routing for file processing & file system sync
├── uploads/              # Local storage folder for uploaded documents
├── .env                  # Port & database connections configuration
├── package.json          # Node dependencies and script commands
├── server.js             # Server initialization and MongoDB config
└── README.md             # Project documentation
```

---

## Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (comes packaged with Node.js)
- A **MongoDB database** (either running locally or a MongoDB Atlas cluster)

---

## Setup & Installation

### 1. Extract / Navigate to Workspace
Open your terminal in the root directory of the application:
```bash
cd c:/HP-BACKUP/dowloadable
```

### 2. Install Dependencies
Run the following command to download and install the required node modules:
```bash
npm install
```
This installs:
* `express` (routing engine)
* `mongoose` (database modeler)
* `multer` (multipart/form-data upload agent)
* `dotenv` (environment configuration reader)
* `nodemon` (development environment auto-reloader)

### 3. Database & Port Configuration
A template file `.env` has been created in the root folder. Open `.env` and configure your settings:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/sharebox?retryWrites=true&w=majority
```

> **Note:** If you want to run it on a local MongoDB installation instead of Atlas, use:  
> `MONGODB_URI=mongodb://127.0.0.1:27017/sharebox`

---

## Running the Application

### Development Mode (with Live Reloading)
To launch the server with `nodemon` (reloads the server automatically on code changes), run:
```bash
npm run dev
```

### Production Mode
To launch the server normally, run:
```bash
npm start
```

Once running, open your web browser and navigate to:
```text
http://localhost:5000
```

---

## Key Features Implemented

1. **Uploader Identity:** Users enter their name so friends know who shared the file.
2. **Strict File Filtering:** Only `.pdf` and `.docx` files are accepted (handled both client-side and server-side).
3. **File Size Protection:** Uploads are limited to `10 MB` to prevent disk overflow.
4. **File Type Badges:** Color-coded badges (`📕 PDF` and `📘 DOCX`) make scanning documents simple.
5. **Database & File Synchronization:** Deleting a share removes the database record and deletes the physical file from the server disk.
6. **Smart API Refresh:** No periodic API polling. The frontend fetches the list of files when:
   - The page first loads.
   - An upload completes.
   - An item is deleted.
   - A search term changes (with 300ms debouncing to optimize API performance).
   - The sort selection changes.
7. **Sorting Controls:** Sort items dynamically by *Newest First*, *Oldest First*, or *File Name A-Z*.
