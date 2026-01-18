/**
 * Authentication Middleware
 * Verifies JWT access tokens and attaches user to request
 */

import tokenService from '../services/tokenService.js';
import userService from '../services/userService.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { ResponseHandler } from '../utils/responseHandler.js';

/**
 * Middleware to verify JWT access token
 * Extracts token from cookies or Authorization header (fallback) and verifies it
 * Attaches user object to req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie (primary) or Authorization header (fallback)
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      }
    }

    if (!token) {
      throw new AuthenticationError('No authorization token provided');
    }

    // Verify token
    const decoded = tokenService.verifyAccessToken(token);

    // Get user from database
    const user = await userService.findUserById(decoded.userId);

    if (!user) {
      throw new AuthorizationError('User not found');
    }

    // Attach user to request object
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return ResponseHandler.error(res, error.message, error.statusCode);
    }
    
    console.error('Authentication middleware error:', error);
    return ResponseHandler.error(res, 'Authentication failed', 401);
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 * Useful for endpoints that have different behavior for authenticated users
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    // Get token from cookie (primary) or Authorization header (fallback)
    let token = req.cookies?.accessToken;

    if (!token) {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return next();
    }

    const decoded = tokenService.verifyAccessToken(token);
    const user = await userService.findUserById(decoded.userId);

    if (user) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};

/**
 * Check if user is authenticated
 * Simpler version that just checks if req.user exists
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return ResponseHandler.error(res, 'Authentication required', 401);
  }
  next();
};

