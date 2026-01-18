/**
 * AI Routes
 * Defines AI-related endpoints for n8n workflow integration
 */

import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeInput } from '../middleware/validateRequest.js';

const router = express.Router();

/**
 * @route   POST /api/ai/generate-prompt
 * @desc    Generate AI prompt via n8n workflow
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @body    { prompt: string, webhookUrl?: string }
 */
router.post(
  '/generate-prompt',
  authenticate,
  sanitizeInput,
  aiController.generatePrompt
);

/**
 * @route   GET /api/ai/history
 * @desc    Get user's AI conversation history
 * @access  Protected
 * @header  Authorization: Bearer <token>
 * @query   { limit?: number }
 */
router.get(
  '/history',
  authenticate,
  aiController.getHistory
);

/**
 * @route   GET /api/ai/conversation/:id
 * @desc    Get a specific conversation by ID
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/conversation/:id',
  authenticate,
  aiController.getConversation
);

/**
 * @route   DELETE /api/ai/conversation/:id
 * @desc    Delete a conversation
 * @access  Protected
 * @header  Authorization: Bearer <token>
 */
router.delete(
  '/conversation/:id',
  authenticate,
  aiController.deleteConversation
);

/**
 * @route   GET /api/ai/health
 * @desc    Health check for n8n webhook connectivity
 * @access  Protected (optional: can be made public for monitoring)
 * @header  Authorization: Bearer <token>
 */
router.get(
  '/health',
  authenticate,
  aiController.checkHealth
);

export default router;

