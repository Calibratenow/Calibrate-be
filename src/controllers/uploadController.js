/**
 * Upload Controller
 * Handles file upload operations
 */

import uploadService from '../services/uploadService.js';
import { ResponseHandler } from '../utils/responseHandler.js';

class UploadController {
  /**
   * Upload profile image (public - for registration)
   * POST /api/upload/profile-image/public
   */
  async uploadProfileImagePublic(req, res, next) {
    try {
      if (!req.file) {
        return ResponseHandler.error(
          res,
          'No image file provided',
          400
        );
      }

      // Upload image without userId (for registration before user exists)
      const photoURL = await uploadService.uploadImage(req.file, null);

      return ResponseHandler.success(
        res,
        { photoURL },
        'Profile image uploaded successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile image (protected - for authenticated users)
   * POST /api/upload/profile-image
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

      const userId = req.userId; // From authenticate middleware

      // Upload image to Firebase Storage
      const photoURL = await uploadService.uploadImage(req.file, userId);

      return ResponseHandler.success(
        res,
        { photoURL },
        'Profile image uploaded successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export default new UploadController();

