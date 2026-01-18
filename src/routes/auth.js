/**
 * Authentication Routes
 * Defines all authentication-related endpoints
 */

import express from 'express';
import authController from '../controllers/authController.js';
import {
  validateRegister,
  validateLogin,
  validateGoogleAuth,
  validateRefreshToken,
  sanitizeInput
} from '../middleware/validateRequest.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with email and password
 * @access  Public
 * @body    { email, password, displayName? }
 */
router.post(
  '/register',
  sanitizeInput,
  validateRegister,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login with email and password
 * @access  Public
 * @body    { email, password }
 */
router.post(
  '/login',
  sanitizeInput,
  validateLogin,
  authController.login
);

/**
 * @route   POST /api/auth/google
 * @desc    Authenticate with Google OAuth
 * @access  Public
 * @body    { idToken }
 */
router.post(
  '/google',
  sanitizeInput,
  validateGoogleAuth,
  authController.googleAuth
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken } or cookie
 */
router.post(
  '/refresh',
  authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and revoke refresh token
 * @access  Public
 * @body    { refreshToken? } or cookie
 */
router.post(
  '/logout',
  authController.logout
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify access token validity
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/verify',
  authenticate,
  authController.verifyToken
);

export default router;

