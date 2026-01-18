/**
 * User Service
 * Handles user CRUD operations with Firestore
 */

import bcrypt from 'bcryptjs';
import { db, collections, getTimestamp } from '../config/firestore.js';
import { ConflictError, NotFoundError, InternalServerError, ValidationError } from '../utils/errors.js';

class UserService {
  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Match status
   */
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @param {string} userData.email - User email
   * @param {string} [userData.password] - User password (for email provider)
   * @param {string} [userData.displayName] - User display name
   * @param {string} [userData.photoURL] - User photo URL
   * @param {string} userData.provider - Auth provider ('email' or 'google')
   * @returns {Promise<Object>} Created user
   */
  async createUser(userData) {
    try {
      const { email, password, displayName, photoURL, provider } = userData;

      // Validate required fields
      if (!email || !provider) {
        throw new ValidationError('Email and provider are required');
      }

      // Check if user already exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Prepare user document
      const userDoc = {
        email: email.toLowerCase().trim(),
        displayName: displayName || email.split('@')[0],
        photoURL: photoURL || null,
        provider,
        createdAt: getTimestamp(),
        updatedAt: getTimestamp()
      };

      // Hash password for email provider
      if (provider === 'email') {
        if (!password || password.length < 8) {
          throw new ValidationError('Password must be at least 8 characters');
        }
        userDoc.passwordHash = await this.hashPassword(password);
      }

      // Create user in Firestore
      const userRef = await db.collection(collections.users).add(userDoc);
      
      // Get created user with ID
      const userSnapshot = await userRef.get();
      const user = {
        id: userSnapshot.id,
        ...userSnapshot.data()
      };

      // Remove sensitive data
      delete user.passwordHash;

      return user;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      console.error('Error creating user:', error);
      throw new InternalServerError('Failed to create user');
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null
   */
  async findUserByEmail(email) {
    try {
      const snapshot = await db.collection(collections.users)
        .where('email', '==', email.toLowerCase().trim())
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new InternalServerError('Failed to find user');
    }
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User object
   */
  async findUserById(userId) {
    try {
      const doc = await db.collection(collections.users).doc(userId).get();

      if (!doc.exists) {
        throw new NotFoundError('User not found');
      }

      const user = {
        id: doc.id,
        ...doc.data()
      };

      // Remove sensitive data
      delete user.passwordHash;

      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Error finding user by ID:', error);
      throw new InternalServerError('Failed to find user');
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, updates) {
    try {
      // Validate user exists
      await this.findUserById(userId);

      // Fields that can be updated
      const allowedFields = ['displayName', 'photoURL'];
      const updateData = {};

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      updateData.updatedAt = getTimestamp();

      // Update user document
      await db.collection(collections.users).doc(userId).update(updateData);

      // Get updated user
      return await this.findUserById(userId);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Error updating user:', error);
      throw new InternalServerError('Failed to update user');
    }
  }

  /**
   * Delete user (soft delete - optional implementation)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteUser(userId) {
    try {
      await db.collection(collections.users).doc(userId).delete();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new InternalServerError('Failed to delete user');
    }
  }

  /**
   * Verify user credentials for email/password login
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User object if valid
   */
  async verifyCredentials(email, password) {
    try {
      const user = await this.findUserByEmail(email);

      if (!user) {
        throw new ValidationError('Invalid email or password');
      }

      if (user.provider !== 'email') {
        throw new ValidationError(`This account uses ${user.provider} sign-in`);
      }

      if (!user.passwordHash) {
        throw new InternalServerError('Password hash not found');
      }

      const isValid = await this.comparePassword(password, user.passwordHash);

      if (!isValid) {
        throw new ValidationError('Invalid email or password');
      }

      // Remove sensitive data
      delete user.passwordHash;

      return user;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Error verifying credentials:', error);
      throw new InternalServerError('Failed to verify credentials');
    }
  }
}

export default new UserService();

