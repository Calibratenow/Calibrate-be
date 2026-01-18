/**
 * User Controller
 * Handles user-related operations
 */

import userService from '../services/userService.js';
import uploadService from '../services/uploadService.js';
import { ResponseHandler } from '../utils/responseHandler.js';

class UserController {
  /**
   * Get authenticated user profile
   * GET /api/user/profile
   */
  async getProfile(req, res, next) {
    try {
      // User is already attached to req by authenticate middleware
      return ResponseHandler.success(
        res,
        { user: req.user },
        'Profile retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * PUT /api/user/profile
   */
  async updateProfile(req, res, next) {
    try {
      const { displayName, photoURL } = req.body;
      const userId = req.userId;

      // Prepare updates
      const updates = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (photoURL !== undefined) updates.photoURL = photoURL;

      // Update user
      const updatedUser = await userService.updateUser(userId, updates);

      return ResponseHandler.success(
        res,
        { user: updatedUser },
        'Profile updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile image
   * POST /api/user/profile-image
   */
  async uploadProfileImage(req, res, next) {
    try {
      if (!req.file) {
        return ResponseHandler.error(
          res,
          'No image file provided',
          400
        );
      }

      const userId = req.userId;
      const user = req.user;

      // Delete old profile image if it exists
      if (user.photoURL) {
        await uploadService.deleteOldProfileImage(user.photoURL);
      }

      // Upload new image to Firebase Storage
      const photoURL = await uploadService.uploadImage(req.file, userId);

      // Update user's photoURL
      const updatedUser = await userService.updateUser(userId, { photoURL });

      return ResponseHandler.success(
        res,
        { user: updatedUser },
        'Profile image uploaded successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID (admin only - optional)
   * GET /api/user/:userId
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await userService.findUserById(userId);

      return ResponseHandler.success(
        res,
        { user },
        'User retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();

