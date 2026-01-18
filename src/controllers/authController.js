/**
 * Authentication Controller
 * Handles authentication business logic
 */

import userService from '../services/userService.js';
import tokenService from '../services/tokenService.js';
import googleOAuthService from '../services/googleOauth.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { ValidationError, AuthenticationError } from '../utils/errors.js';

class AuthController {
  /**
   * Register new user with email and password
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const { email, password, displayName, photoURL } = req.body;

      // Create user
      const user = await userService.createUser({
        email,
        password,
        displayName,
        photoURL,
        provider: 'email'
      });

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(user.id, user.email);
      const refreshToken = tokenService.generateRefreshToken(user.id);

      // Store refresh token
      await tokenService.storeRefreshToken(user.id, refreshToken);

      // Set tokens as httpOnly cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return success response without tokens (they're in cookies)
      return ResponseHandler.success(
        res,
        {
          user
        },
        'User registered successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login with email and password
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Verify credentials
      const user = await userService.verifyCredentials(email, password);

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(user.id, user.email);
      const refreshToken = tokenService.generateRefreshToken(user.id);

      // Store refresh token
      await tokenService.storeRefreshToken(user.id, refreshToken);

      // Set tokens as httpOnly cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return success response without tokens (they're in cookies)
      return ResponseHandler.success(
        res,
        {
          user
        },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Google OAuth login/register
   * POST /api/auth/google
   */
  async googleAuth(req, res, next) {
    try {
      const { idToken } = req.body;

      // Verify Google ID token
      const googleUser = await googleOAuthService.verifyIdToken(idToken);

      // Check if user exists
      let user = await userService.findUserByEmail(googleUser.email);

      if (!user) {
        // Create new user if doesn't exist
        user = await userService.createUser({
          email: googleUser.email,
          displayName: googleUser.name,
          photoURL: googleUser.picture,
          provider: 'google'
        });
      } else {
        // Verify provider matches
        if (user.provider !== 'google') {
          throw new ValidationError(
            `This email is registered with ${user.provider} sign-in. Please use ${user.provider} to log in.`
          );
        }
      }

      // Generate tokens
      const accessToken = tokenService.generateAccessToken(user.id, user.email);
      const refreshToken = tokenService.generateRefreshToken(user.id);

      // Store refresh token
      await tokenService.storeRefreshToken(user.id, refreshToken);

      // Set tokens as httpOnly cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return success response without tokens (they're in cookies)
      return ResponseHandler.success(
        res,
        {
          user
        },
        user.createdAt === user.updatedAt ? 'Account created successfully' : 'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res, next) {
    try {
      // Get refresh token from cookie
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        throw new AuthenticationError('Refresh token not provided');
      }

      // Verify refresh token
      const decoded = tokenService.verifyRefreshToken(refreshToken);

      // Check if token exists in database
      const storedToken = await tokenService.findStoredRefreshToken(refreshToken);

      if (!storedToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user
      const user = await userService.findUserById(decoded.userId);

      // Generate new access token
      const accessToken = tokenService.generateAccessToken(user.id, user.email);

      // Rotate refresh token (optional - for enhanced security)
      const newRefreshToken = await tokenService.rotateRefreshToken(refreshToken, user.id);

      // Set new tokens as httpOnly cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Return user info without tokens (they're in cookies)
      return ResponseHandler.success(
        res,
        {
          user
        },
        'Token refreshed successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      // Get refresh token from cookie
      const refreshToken = req.cookies?.refreshToken;

      if (refreshToken) {
        // Revoke refresh token
        await tokenService.revokeRefreshToken(refreshToken);
      }

      // Clear both cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      return ResponseHandler.success(
        res,
        null,
        'Logout successful'
      );
    } catch (error) {
      // Even if token revocation fails, clear cookies and return success
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return ResponseHandler.success(
        res,
        null,
        'Logout successful'
      );
    }
  }

  /**
   * Verify access token
   * GET /api/auth/verify
   */
  async verifyToken(req, res, next) {
    try {
      // Token verification is already done by authenticate middleware
      // If we reach here, token is valid
      return ResponseHandler.success(
        res,
        {
          user: req.user,
          valid: true
        },
        'Token is valid'
      );
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();

