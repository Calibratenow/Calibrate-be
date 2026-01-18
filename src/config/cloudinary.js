/**
 * Cloudinary Configuration
 * Initializes Cloudinary for image uploads
 * 
 * Supports both CLOUDINARY_URL format and individual credentials
 */

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Cloudinary
try {
  // Use individual environment variables
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary credentials not found. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file'
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true, // Use HTTPS
  });

  console.log('✓ Cloudinary initialized successfully');
} catch (error) {
  console.error('✗ Failed to initialize Cloudinary:', error.message);
  // Don't exit - allow app to start but uploads will fail
}

export default cloudinary;

