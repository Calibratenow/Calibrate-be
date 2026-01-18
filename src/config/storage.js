/**
 * Firebase Storage Configuration
 * Initializes Firebase Storage bucket for file uploads
 * 
 * Uses the same Firebase Admin SDK instance initialized in firestore.js
 */

import admin from './firestore.js';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

dotenv.config();

// Get the default storage bucket
// Default bucket name: {projectId}.appspot.com
const projectId = process.env.FIREBASE_PROJECT_ID;
const bucketName = projectId ? `${projectId}.appspot.com` : undefined;

let storageBucket;

try {
  if (!bucketName) {
    throw new Error('FIREBASE_PROJECT_ID not set in environment variables');
  }
  
  // Get storage instance and bucket
  const storage = getStorage();
  storageBucket = storage.bucket(bucketName);
  
  console.log(`✓ Firebase Storage initialized successfully (bucket: ${bucketName})`);
} catch (error) {
  console.error('✗ Failed to initialize Firebase Storage:', error.message);
  // Don't exit - storage might not be critical for all operations
}

// Export storage bucket instance
export { storageBucket };

// Helper function to get storage bucket (returns null if not initialized)
export const getStorageBucket = () => {
  try {
    if (!bucketName) {
      console.error('Storage bucket name not configured');
      return null;
    }
    const storage = getStorage();
    return storage.bucket(bucketName);
  } catch (error) {
    console.error('Error getting storage bucket:', error.message);
    return null;
  }
};

export default storageBucket;

