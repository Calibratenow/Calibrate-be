/**
 * Upload Routes
 * Defines file upload endpoints
 */

import express from 'express';
import multer from 'multer';
import uploadController from '../controllers/uploadController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Configure multer to store files in memory
// We'll upload directly to Firebase Storage, so we don't need disk storage
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter
});

/**
 * @route   POST /api/upload/profile-image/public
 * @desc    Upload profile image (public - for registration)
 * @access  Public
 * @body    multipart/form-data with 'image' field
 */
router.post(
  '/profile-image/public',
  upload.single('image'),
  uploadController.uploadProfileImagePublic
);

/**
 * @route   POST /api/upload/profile-image
 * @desc    Upload profile image (protected - for authenticated users)
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @body    multipart/form-data with 'image' field
 */
router.post(
  '/profile-image',
  authenticate,
  upload.single('image'),
  uploadController.uploadProfileImage
);

export default router;

