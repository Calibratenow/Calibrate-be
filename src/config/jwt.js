/**
 * JWT Configuration
 * Defines token secrets and expiry times
 * 
 * CREDENTIALS NEEDED:
 * Generate strong random secrets (minimum 32 characters) for:
 * - JWT_ACCESS_SECRET
 * - JWT_REFRESH_SECRET
 * 
 * You can generate them using Node.js:
 * node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * 
 * Add them to your .env file
 */

import dotenv from 'dotenv';

dotenv.config();

// Validate JWT secrets
if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
}

if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

export const JWT_CONFIG = {
  // Access token configuration
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: '15m', // 15 minutes
  },
  
  // Refresh token configuration
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d', // 7 days
  },
  
  // Token issuer
  issuer: 'calibrate-now',
  
  // Token audience
  audience: 'calibrate-users',
};

export default JWT_CONFIG;

