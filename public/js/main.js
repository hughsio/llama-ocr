document.addEventListener('DOMContentLoaded', () => {
    const md = window.markdownit();
    const form = document.getElementById('ocrForm');
    const fileInput = document.getElementById('file-input');
    const fileName = document.querySelector('.file-name');
    const fileLabel = document.querySelector('.file-upload-label');
    const loading = document.querySelector('.loading');
    const modal = document.querySelector('.result-modal');
    const overlay = document.querySelector('.modal-overlay');
    const markdownOutput = document.querySelector('.markdown-output');
    const closeButton = document.querySelector('.close-button');
    const copyButton = document.querySelector('.copy-button');
    const successMessage = document.querySelector('.success-message');
    const uploadList = document.querySelector('.upload-list');

    // Load upload history on page load
    loadUploadHistory();

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileName.textContent = e.target.files[0].name;
            fileLabel.textContent = 'File selected';
        } else {
            fileName.textContent = '';
            fileLabel.textContent = 'Click to upload or drag and drop an image';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!fileInput.files[0]) {
            alert('Please select a file first');
            return;
        }

        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        // Show loading state
        loading.classList.add('show');
        overlay.classList.add('show');

        try {
            const response = await fetch('/ocr', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const markdownText = `# OCR Result\n\n${data.result}`;
            markdownOutput.innerHTML = md.render(markdownText);
            modal.classList.add('show');
            
            // Refresh upload history
            await loadUploadHistory();
            
            // Reset form
            form.reset();
            fileName.textContent = '';
            fileLabel.textContent = 'Click to upload or drag and drop an image';
            
        } catch (error) {
            console.error('Error:', error);
            markdownOutput.innerHTML = md.render(`# Error\n\n${error.message}`);
            modal.classList.add('show');
        } finally {
            loading.classList.remove('show');
        }
    });

    closeButton.addEventListener('click', () => {
        modal.classList.remove('show');
        overlay.classList.remove('show');
    });

    copyButton.addEventListener('click', () => {
        const text = markdownOutput.textContent;
        navigator.clipboard.writeText(text).then(() => {
            successMessage.style.display = 'block';
            setTimeout(() => {
                successMessage.style.display = 'none';
            }, 2000);
        });
    });

    async function loadUploadHistory() {
        try {
            const response = await fetch('/uploads');
            const data = await response.json();
            renderUploadHistory(data.uploads);
        } catch (error) {
            console.error('Failed to load upload history:', error);
        }
    }

    function renderUploadHistory(uploads) {
        if (uploads.length === 0) {
            uploadList.innerHTML = '<div class="no-uploads">No uploads yet</div>';
            return;
        }

        uploadList.innerHTML = uploads.map(upload => `
            <div class="upload-item" data-id="${upload.id}">
                <img src="/uploads/${upload.filename}" alt="Uploaded image" class="upload-thumbnail">
                <div class="upload-info">
                    <span class="upload-filename">${upload.originalName}</span>
                    <span class="upload-date">Uploaded: ${new Date(upload.date).toLocaleString()}</span>
                </div>
                <div class="upload-actions">
                    <button class="view-result-btn" data-result="${encodeURIComponent(upload.result)}">View Result</button>
                    <button class="delete-btn">Delete</button>
                </div>
            </div>
        `).join('');

        // Add event listeners for view and delete buttons
        document.querySelectorAll('.view-result-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = decodeURIComponent(btn.dataset.result);
                showResult(result);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Are you sure you want to delete this upload?')) {
                    const uploadItem = e.target.closest('.upload-item');
                    const id = uploadItem.dataset.id;
                    try {
                        await deleteUpload(id);
                        uploadItem.remove();
                        if (document.querySelectorAll('.upload-item').length === 0) {
                            uploadList.innerHTML = '<div class="no-uploads">No uploads yet</div>';
                        }
                    } catch (error) {
                        alert('Failed to delete upload');
                    }
                }
            });
        });
    }

    async function deleteUpload(id) {
        try {
            await fetch(`/uploads/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Failed to delete upload:', error);
            throw error;
        }
    }

    function showResult(result) {
        markdownOutput.innerHTML = md.render(result);
        modal.classList.add('show');
        overlay.classList.add('show');
    }
});