/**
 * Firebase Admin SDK Configuration
 * Initializes Firestore database connection
 * 
 * CREDENTIALS NEEDED:
 * 1. Go to Firebase Console: https://console.firebase.google.com/
 * 2. Select your project
 * 3. Go to Project Settings > Service Accounts
 * 4. Click "Generate New Private Key"
 * 5. Download the JSON file
 * 6. Extract the following values to your .env file:
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_CLIENT_EMAIL
 *    - FIREBASE_PRIVATE_KEY (entire key including BEGIN/END lines)
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Service account configuration
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  // Replace escaped newlines with actual newlines
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

// Initialize Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Storage bucket name (default: {projectId}.appspot.com)
    storageBucket: `${serviceAccount.projectId}.appspot.com`,
    // Optional: specify database URL if using multiple projects
    // databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`
  });
  
  console.log('✓ Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('✗ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

// Export Firestore instance
export const db = admin.firestore();

// Firestore settings for optimal performance
db.settings({
  ignoreUndefinedProperties: true, // Ignore undefined properties in documents
});

// Collection references for easy access
export const collections = {
  users: 'users',
  refreshTokens: 'refresh_tokens',
  aiConversations: 'ai_conversations',
  chatSessions: 'chat_sessions',
};

// Helper to get timestamp
export const getTimestamp = () => admin.firestore.FieldValue.serverTimestamp();

export default admin;

