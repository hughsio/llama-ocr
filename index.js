require('dotenv').config();
const express = require("express");
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'));
        }
    }
});

// Store OCR results in memory (in production, use a database)
const ocrResults = new Map();

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Set view engine
app.set("view engine", "ejs");

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

// Get upload history
app.get("/uploads", async (req, res) => {
    try {
        const files = await fs.readdir('uploads');
        const uploads = await Promise.all(files.map(async (filename) => {
            const stats = await fs.stat(path.join('uploads', filename));
            return {
                id: filename,
                filename: filename,
                originalName: filename.split('-').slice(2).join('-'), // Get original filename
                date: stats.mtime,
                result: ocrResults.get(filename) || 'No OCR result available'
            };
        }));
        res.json({ uploads: uploads.sort((a, b) => b.date - a.date) }); // Sort by date, newest first
    } catch (error) {
        console.error('Error getting uploads:', error);
        res.status(500).json({ error: 'Failed to get upload history' });
    }
});

// Delete upload
app.delete("/uploads/:id", async (req, res) => {
    try {
        const filename = req.params.id;
        await fs.unlink(path.join('uploads', filename));
        ocrResults.delete(filename); // Remove OCR result
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.post("/ocr", upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('Please upload an image file');
        }

        const { ocr } = await import("llama-ocr");
        const result = await ocr({
            filePath: req.file.path,
            apiKey: process.env.TOGETHER_API_KEY
        });
        
        // Store the OCR result
        ocrResults.set(req.file.filename, result);

        res.json({ 
            result,
            filename: req.file.filename,
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ 
            error: "Failed to process OCR request",
            details: error.message 
        });
    }
});

// Start server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});
