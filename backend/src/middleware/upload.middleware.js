const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Files are saved under backend/uploads no matter which folder the server
// is started from (app.js serves /uploads from the same place)
const UPLOADS_ROOT = path.join(__dirname, "../../uploads");

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine upload directory based on the route
    let uploadDir = "uploads/profiles/";

    if (req.baseUrl && req.baseUrl.includes("/products")) {
      uploadDir = "uploads/products/";
    } else if (req.baseUrl && req.baseUrl.includes("/messages")) {
      // For message attachments (images, audio, documents)
      if (file.mimetype.startsWith("audio/")) {
        uploadDir = "uploads/messages/audio/";
      } else if (file.mimetype.startsWith("image/")) {
        uploadDir = "uploads/messages/images/";
      } else if (file.mimetype.startsWith("video/")) {
        uploadDir = "uploads/messages/videos/";
      } else {
        uploadDir = "uploads/messages/documents/";
      }
    }

    const absoluteDir = path.join(UPLOADS_ROOT, uploadDir.replace(/^uploads\//, ""));
    // Create directory if it doesn't exist
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    cb(null, absoluteDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // For message routes, accept images, audio, video, and documents
  if (req.baseUrl && req.baseUrl.includes("/messages")) {
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
      "audio/mp4",
      "video/mp4",
      "video/webm",
      "video/ogg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed!"), false);
    }
  } else {
    // Accept images only for profiles and products
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size for messages (voice notes, images, etc.)
  },
});

module.exports = upload;
