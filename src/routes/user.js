/**
 * User Routes
 * Defines user-related endpoints
 */

import express from 'express';
import multer from 'multer';
import userController from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { validateProfileUpdate, sanitizeInput } from '../middleware/validateRequest.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter
});

/**
 * @route   GET /api/user/profile
 * @desc    Get authenticated user's profile
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/profile',
  authenticate,
  userController.getProfile
);

/**
 * @route   PUT /api/user/profile
 * @desc    Update authenticated user's profile
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @body    { displayName?, photoURL? }
 */
router.put(
  '/profile',
  authenticate,
  sanitizeInput,
  validateProfileUpdate,
  userController.updateProfile
);

/**
 * @route   POST /api/user/profile-image
 * @desc    Upload profile image
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @body    multipart/form-data with 'image' field
 */
router.post(
  '/profile-image',
  authenticate,
  upload.single('image'),
  userController.uploadProfileImage
);

/**
 * @route   GET /api/user/:userId
 * @desc    Get user by ID (optional - for admin or public profiles)
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/:userId',
  authenticate,
  userController.getUserById
);

export default router;

