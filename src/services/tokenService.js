/**
 * Token Service
 * Handles JWT token generation, verification, storage, and rotation
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, collections, getTimestamp } from '../config/firestore.js';
import { JWT_CONFIG } from '../config/jwt.js';
import { AuthenticationError, InternalServerError } from '../utils/errors.js';

class TokenService {
  /**
   * Generate JWT access token
   * @param {string} userId - User ID
   * @param {string} email - User email
   * @returns {string} JWT access token
   */
  generateAccessToken(userId, email) {
    try {
      return jwt.sign(
        {
          userId,
          email,
          type: 'access'
        },
        JWT_CONFIG.accessToken.secret,
        {
          expiresIn: JWT_CONFIG.accessToken.expiresIn,
          issuer: JWT_CONFIG.issuer,
          audience: JWT_CONFIG.audience
        }
      );
    } catch (error) {
      throw new InternalServerError('Failed to generate access token');
    }
  }

  /**
   * Generate JWT refresh token
   * @param {string} userId - User ID
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(userId) {
    try {
      return jwt.sign(
        {
          userId,
          type: 'refresh'
        },
        JWT_CONFIG.refreshToken.secret,
        {
          expiresIn: JWT_CONFIG.refreshToken.expiresIn,
          issuer: JWT_CONFIG.issuer,
          audience: JWT_CONFIG.audience
        }
      );
    } catch (error) {
      throw new InternalServerError('Failed to generate refresh token');
    }
  }

  /**
   * Verify JWT access token
   * @param {string} token - JWT access token
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.accessToken.secret, {
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience
      });

      if (decoded.type !== 'access') {
        throw new AuthenticationError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify JWT refresh token
   * @param {string} token - JWT refresh token
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_CONFIG.refreshToken.secret, {
        issuer: JWT_CONFIG.issuer,
        audience: JWT_CONFIG.audience
      });

      if (decoded.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Refresh token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Hash token using SHA-256
   * @param {string} token - Token to hash
   * @returns {string} Hashed token
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Store refresh token in Firestore
   * @param {string} userId - User ID
   * @param {string} token - Refresh token
   * @returns {Promise<void>}
   */
  async storeRefreshToken(userId, token) {
    try {
      const tokenHash = this.hashToken(token);
      const decoded = jwt.decode(token);
      
      await db.collection(collections.refreshTokens).add({
        tokenHash,
        userId,
        expiresAt: new Date(decoded.exp * 1000), // Convert Unix timestamp to Date
        createdAt: getTimestamp()
      });
    } catch (error) {
      console.error('Error storing refresh token:', error);
      throw new InternalServerError('Failed to store refresh token');
    }
  }

  /**
   * Verify refresh token exists in Firestore
   * @param {string} token - Refresh token
   * @returns {Promise<Object|null>} Token document or null
   */
  async findStoredRefreshToken(token) {
    try {
      const tokenHash = this.hashToken(token);
      
      // Query only by tokenHash to avoid requiring composite index
      // Then check expiration in JavaScript
      const snapshot = await db.collection(collections.refreshTokens)
        .where('tokenHash', '==', tokenHash)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      // Check expiration in code instead of Firestore query
      // This avoids the need for a composite index on tokenHash + expiresAt
      const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      if (expiresAt <= new Date()) {
        // Token is expired, clean it up and return null
        await doc.ref.delete();
        return null;
      }

      return { id: doc.id, ...data };
    } catch (error) {
      console.error('Error finding refresh token:', error);
      throw new InternalServerError('Failed to verify refresh token');
    }
  }

  /**
   * Revoke refresh token (delete from Firestore)
   * @param {string} token - Refresh token
   * @returns {Promise<boolean>} Success status
   */
  async revokeRefreshToken(token) {
    try {
      const tokenHash = this.hashToken(token);
      
      const snapshot = await db.collection(collections.refreshTokens)
        .where('tokenHash', '==', tokenHash)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return false;
      }

      await snapshot.docs[0].ref.delete();
      return true;
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      throw new InternalServerError('Failed to revoke refresh token');
    }
  }

  /**
   * Rotate refresh token (delete old, create new)
   * @param {string} oldToken - Old refresh token
   * @param {string} userId - User ID
   * @returns {Promise<string>} New refresh token
   */
  async rotateRefreshToken(oldToken, userId) {
    try {
      // Verify old token exists
      const storedToken = await this.findStoredRefreshToken(oldToken);
      
      if (!storedToken) {
        throw new AuthenticationError('Refresh token not found or expired');
      }

      // Delete old token
      await this.revokeRefreshToken(oldToken);

      // Generate and store new token
      const newToken = this.generateRefreshToken(userId);
      await this.storeRefreshToken(userId, newToken);

      return newToken;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Error rotating refresh token:', error);
      throw new InternalServerError('Failed to rotate refresh token');
    }
  }

  /**
   * Clean up expired refresh tokens (maintenance task)
   * Should be called periodically (e.g., daily cron job)
   * @returns {Promise<number>} Number of tokens deleted
   */
  async cleanupExpiredTokens() {
    try {
      const snapshot = await db.collection(collections.refreshTokens)
        .where('expiresAt', '<=', new Date())
        .get();

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return snapshot.size;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      return 0;
    }
  }
}

export default new TokenService();

