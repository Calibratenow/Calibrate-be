/**
 * Google OAuth Service
 * Handles Google OAuth token verification
 * 
 * CREDENTIALS NEEDED:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Select your project (should be auto-created with Firebase)
 * 3. Go to APIs & Services > Credentials
 * 4. Create OAuth 2.0 Client ID (Web application)
 * 5. Add Authorized JavaScript origins: http://localhost:5173
 * 6. Add Authorized redirect URIs: http://localhost:5173
 * 7. Copy Client ID and Client Secret to .env file
 */

import axios from 'axios';
import { AuthenticationError, InternalServerError } from '../utils/errors.js';

class GoogleOAuthService {
  constructor() {
    this.googleClientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    // Google's token verification endpoint
    this.tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo';
  }

  /**
   * Verify Google ID token
   * @param {string} idToken - Google ID token from frontend
   * @returns {Promise<Object>} User profile data
   */
  async verifyIdToken(idToken) {
    try {
      if (!idToken) {
        throw new AuthenticationError('Google ID token is required');
      }

      // Verify token with Google's tokeninfo endpoint
      const response = await axios.get(this.tokenInfoUrl, {
        params: {
          id_token: idToken
        },
        timeout: 5000 // 5 second timeout
      });

      const tokenInfo = response.data;

      // Verify the token is valid
      if (!tokenInfo.email || !tokenInfo.email_verified) {
        throw new AuthenticationError('Invalid Google token or email not verified');
      }

      // Verify the token is for our application
      if (tokenInfo.aud !== this.googleClientId) {
        throw new AuthenticationError('Token is not for this application');
      }

      // Verify token is not expired
      const now = Math.floor(Date.now() / 1000);
      if (tokenInfo.exp && tokenInfo.exp < now) {
        throw new AuthenticationError('Google token has expired');
      }

      // Return standardized user profile
      return {
        email: tokenInfo.email,
        name: tokenInfo.name || tokenInfo.email.split('@')[0],
        picture: tokenInfo.picture || null,
        emailVerified: tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true,
        provider: 'google'
      };
    } catch (error) {
      // Handle axios errors
      if (error.response) {
        // Google API returned an error
        if (error.response.status === 400) {
          throw new AuthenticationError('Invalid Google token');
        }
        throw new AuthenticationError('Failed to verify Google token');
      }

      // Handle our custom errors
      if (error instanceof AuthenticationError) {
        throw error;
      }

      // Handle network or other errors
      console.error('Google OAuth verification error:', error);
      throw new InternalServerError('Failed to verify Google authentication');
    }
  }

  /**
   * Validate Google OAuth credentials are configured
   * @returns {boolean} Configuration status
   */
  isConfigured() {
    return !!(this.googleClientId && this.googleClientSecret);
  }
}

export default new GoogleOAuthService();

