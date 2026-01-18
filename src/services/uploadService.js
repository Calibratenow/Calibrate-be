/**
 * Upload Service
 * Handles file uploads to Cloudinary
 */

import cloudinary from '../config/cloudinary.js';
import { ValidationError, InternalServerError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

class UploadService {
  /**
   * Validate image file
   * @param {Object} file - File object from multer
   * @returns {void}
   * @throws {ValidationError} If file is invalid
   */
  validateImageFile(file) {
    if (!file) {
      throw new ValidationError('No file provided');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new ValidationError(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }
  }

  /**
   * Get file extension from MIME type
   * @param {string} mimetype - MIME type
   * @returns {string} File extension
   */
  getFileExtension(mimetype) {
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    return mimeToExt[mimetype] || 'jpg';
  }

  /**
   * Generate unique filename for profile image
   * @param {string} userId - User ID
   * @param {string} mimetype - MIME type
   * @returns {string} Unique filename
   */
  generateProfileImageFilename(userId, mimetype) {
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = this.getFileExtension(mimetype);
    return `profile-images/${userId}-${timestamp}-${uuid}.${extension}`;
  }

  /**
   * Upload image to Cloudinary
   * @param {Object} file - File object from multer
   * @param {string} userId - User ID (optional, for profile images)
   * @returns {Promise<string>} Public download URL
   */
  async uploadImage(file, userId = null) {
    try {
      // Validate file
      this.validateImageFile(file);

      // Generate unique public ID for the image
      const timestamp = Date.now();
      const uuid = uuidv4().substring(0, 8);
      const publicId = userId
        ? `profile-images/${userId}-${timestamp}-${uuid}`
        : `uploads/${timestamp}-${uuid}`;

      // Upload to Cloudinary
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: userId ? 'profile-images' : 'uploads',
            resource_type: 'image',
            transformation: [
              {
                width: 800,
                height: 800,
                crop: 'limit',
                quality: 'auto',
                fetch_format: 'auto',
              },
            ],
            overwrite: false,
            invalidate: true,
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(new InternalServerError('Failed to upload image to Cloudinary'));
              return;
            }

            if (!result || !result.secure_url) {
              reject(new InternalServerError('Invalid response from Cloudinary'));
              return;
            }

            // Return secure URL (HTTPS)
            resolve(result.secure_url);
          }
        );

        // Write buffer to upload stream
        uploadStream.end(file.buffer);
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof InternalServerError) {
        throw error;
      }
      console.error('Error in uploadImage:', error);
      throw new InternalServerError('Failed to upload image');
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} fileUrl - Public URL of the file
   * @returns {Promise<void>}
   */
  async deleteFile(fileUrl) {
    try {
      if (!fileUrl) {
        return;
      }

      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
      const cloudinaryUrlPattern = /\/v\d+\/(.+)\.(jpg|jpeg|png|webp|gif)/i;
      const match = fileUrl.match(cloudinaryUrlPattern);

      if (!match || !match[1]) {
        console.warn('Could not extract public_id from Cloudinary URL:', fileUrl);
        return;
      }

      const publicId = match[1];

      // Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });

      if (result.result === 'ok') {
        console.log('Deleted file from Cloudinary:', publicId);
      } else {
        console.warn('File deletion result:', result.result, 'for:', publicId);
      }
    } catch (error) {
      // Don't throw error - file deletion is not critical
      console.error('Error deleting file from Cloudinary:', error);
    }
  }

  /**
   * Delete old profile image if it exists
   * @param {string} oldPhotoURL - Old photo URL
   * @returns {Promise<void>}
   */
  async deleteOldProfileImage(oldPhotoURL) {
    if (!oldPhotoURL) {
      return;
    }

    // Only delete if it's from Cloudinary (not Google or other external URLs)
    if (oldPhotoURL.includes('res.cloudinary.com') || oldPhotoURL.includes('cloudinary.com')) {
      await this.deleteFile(oldPhotoURL);
    }
  }
}

export default new UploadService();

