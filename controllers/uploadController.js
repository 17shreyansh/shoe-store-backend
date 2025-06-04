const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set up storage for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir); // Store uploaded files in the 'uploads' directory
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using the current timestamp and original extension
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// File filter to accept only image files
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|gif/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (JPEG, JPG, PNG, GIF) are allowed!'));
  }
};

// Initialize Multer upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 5 } // 5MB file size limit
});

// @desc    Upload single image
// @route   POST /api/upload
// @access  Private/Admin
exports.uploadImage = (req, res) => {
  // Use the 'upload.single' middleware to handle the file upload
  // 'image' is the name of the field in the form data
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // An unknown error occurred when uploading.
      return res.status(500).json({ error: err.message });
    }

    // No file uploaded or file was processed
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // File uploaded successfully
    // Construct the URL to access the image.
    // Assuming your server is running on http://localhost:5000 and has a static route for /uploads
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ message: 'Image uploaded successfully!', url: imageUrl });
  });
};