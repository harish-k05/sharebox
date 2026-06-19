document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const uploadForm = document.getElementById('uploadForm');
  const uploaderInput = document.getElementById('uploaderInput');
  const noteInput = document.getElementById('noteInput');
  const fileInput = document.getElementById('fileInput');
  
  const dropZone = document.getElementById('dropZone');
  const fileDetails = document.getElementById('fileDetails');
  const selectedFileName = document.getElementById('selectedFileName');
  const removeFileBtn = document.getElementById('removeFileBtn');
  
  const submitBtn = document.getElementById('submitBtn');
  const submitSpinner = document.getElementById('submitSpinner');
  
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  
  const fileCount = document.getElementById('fileCount');
  const feedLoading = document.getElementById('feedLoading');
  const filesGrid = document.getElementById('filesGrid');
  const emptyState = document.getElementById('emptyState');

  // State
  let searchTimeout = null;

  // ==========================================================================
  // Drag and Drop Logic
  // ==========================================================================

  // Prevent defaults for all drag events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone on drag hover
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  // Handle click to browse
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file select change
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelection(fileInput.files[0]);
    }
  });

  // Process selected file (Validate type and size)
  function handleFileSelection(file) {
    const allowedExtensions = /(\.pdf|\.docx)$/i;
    const maxSize = 10 * 1024 * 1024; // 10MB

    // Check Extension
    if (!allowedExtensions.exec(file.name)) {
      alert('Invalid file format. Only PDF and DOCX files are allowed.');
      resetFileInput();
      return;
    }

    // Check Size
    if (file.size > maxSize) {
      alert('File size exceeds the 10MB limit. Please upload a smaller file.');
      resetFileInput();
      return;
    }

    // Bind file to input if it came from drag and drop
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Display preview details
    selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    fileDetails.classList.remove('hidden');
    dropZone.classList.add('hidden');
  }

  // Remove selected file click handler
  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileInput();
  });

  function resetFileInput() {
    fileInput.value = '';
    fileDetails.classList.add('hidden');
    dropZone.classList.remove('hidden');
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Helper: Format bytes to human readable sizes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // ==========================================================================
  // API Fetch, Search, Sort & Render
  // ==========================================================================

  // Fetch uploads from API
  async function fetchUploads() {
    // Show loader
    feedLoading.classList.remove('hidden');
    filesGrid.classList.add('hidden');
    emptyState.classList.add('hidden');

    const searchVal = searchInput.value.trim();
    const sortVal = sortSelect.value;
    
    // Construct query parameters
    const params = new URLSearchParams();
    if (searchVal) params.append('search', searchVal);
    if (sortVal) params.append('sort', sortVal);

    try {
      const response = await fetch(`/api/uploads?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file list');
      }

      const uploads = await response.json();
      renderUploads(uploads);
    } catch (err) {
      console.error(err);
      filesGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h4').textContent = 'Error Loading Files';
      emptyState.querySelector('p').textContent = 'Unable to fetch files from the server. Check your connection.';
    } finally {
      feedLoading.classList.add('hidden');
    }
  }

  // Render cards grid
  function renderUploads(uploads) {
    fileCount.textContent = `${uploads.length} File${uploads.length === 1 ? '' : 's'}`;
    filesGrid.innerHTML = '';

    if (uploads.length === 0) {
      filesGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    filesGrid.classList.remove('hidden');

    uploads.forEach((item, index) => {
      const isPdf = item.mimeType === 'application/pdf' || item.originalName.toLowerCase().endsWith('.pdf');
      const badgeClass = isPdf ? 'badge-pdf' : 'badge-docx';
      const badgeText = isPdf ? '📕 PDF' : '📘 DOCX';
      const cardTypeClass = isPdf ? 'type-pdf' : 'type-docx';
      
      const card = document.createElement('div');
      card.className = `file-card glass-panel ${cardTypeClass} animate-fade-in-card`;
      // Stagger animations slightly
      card.style.animationDelay = `${index * 0.05}s`;

      card.innerHTML = `
        <div class="card-header">
          <div class="file-title-group">
            <h4 class="file-title" title="${escapeHTML(item.originalName)}">${escapeHTML(item.originalName)}</h4>
            <div class="uploader-by">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="uploader-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>By <strong>${escapeHTML(item.uploader)}</strong></span>
            </div>
          </div>
          <span class="badge ${badgeClass}">${badgeText}</span>
        </div>
        
        <div class="card-body">
          <div class="note-box ${!item.note ? 'empty-note' : ''}">
            ${item.note ? escapeHTML(item.note) : 'No description attached.'}
          </div>
        </div>

        <div class="card-footer">
          <span class="upload-time" title="${new Date(item.uploadDate).toLocaleString()}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="time-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>${formatRelativeDate(item.uploadDate)}</span>
          </span>
          <div class="card-actions">
            <button class="btn-sm btn-download" data-id="${item._id}" title="Download file">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Get</span>
            </button>
            <button class="btn-sm btn-delete" data-id="${item._id}" title="Delete file">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;

      // Bind Actions
      card.querySelector('.btn-download').addEventListener('click', () => {
        window.location.href = `/api/uploads/${item._id}/download`;
      });

      card.querySelector('.btn-delete').addEventListener('click', async () => {
        if (confirm(`Delete file "${item.originalName}" permanently?`)) {
          await deleteUpload(item._id);
        }
      });

      filesGrid.appendChild(card);
    });
  }

  // Delete Action
  async function deleteUpload(id) {
    try {
      const response = await fetch(`/api/uploads/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete file');
      }

      // Success refresh list
      fetchUploads();
    } catch (err) {
      console.error(err);
      alert(err.message || 'An error occurred while deleting.');
    }
  }

  // ==========================================================================
  // Form Submission
  // ==========================================================================

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const uploader = uploaderInput.value.trim();
    const note = noteInput.value.trim();
    const file = fileInput.files[0];

    if (!uploader) {
      alert('Please enter your name.');
      return;
    }

    if (!file) {
      alert('Please select a file to share.');
      return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append('uploader', uploader);
    formData.append('note', note);
    formData.append('file', file);

    // Update button loading state
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');
    submitBtn.querySelector('span').textContent = 'Uploading...';

    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server rejected file upload.');
      }

      // Success
      resetFileInput();
      noteInput.value = '';
      // Retain uploader name for convenience during multiple uploads
      
      // Refresh list immediately
      fetchUploads();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error occurred during file upload.');
    } finally {
      // Restore button state
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
      submitBtn.querySelector('span').textContent = 'Upload & Share';
    }
  });

  // ==========================================================================
  // Search & Filter Listeners (With Debouncing)
  // ==========================================================================

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      fetchUploads();
    }, 300); // 300ms Debounce
  });

  sortSelect.addEventListener('change', () => {
    fetchUploads();
  });

  // ==========================================================================
  // Helper functions
  // ==========================================================================

  // Escape HTML to prevent XSS
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Format date to human relative time (e.g. Just now, 5 mins ago, Today, etc)
  function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHr < 24) {
      return `${diffHr}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  }

  // Initialize Page Load
  fetchUploads();
});
