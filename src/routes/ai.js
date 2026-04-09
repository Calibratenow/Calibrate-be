/**
 * AI Routes
 * Defines AI-related endpoints for n8n workflow integration and chat sessions
 */

import express from 'express';
import aiController from '../controllers/aiController.js';
import { authenticate } from '../middleware/auth.js';
import { sanitizeInput } from '../middleware/validateRequest.js';

const router = express.Router();

// ─── Session Routes ──────────────────────────────────────────────

/**
 * @route   POST /api/ai/sessions
 * @desc    Create a new chat session
 * @access  Protected
 */
router.post(
  '/sessions',
  authenticate,
  sanitizeInput,
  aiController.createSession
);

/**
 * @route   GET /api/ai/sessions
 * @desc    List user's chat sessions
 * @access  Protected
 */
router.get(
  '/sessions',
  authenticate,
  aiController.getSessions
);

/**
 * @route   GET /api/ai/sessions/:sessionId/messages
 * @desc    Get messages for a specific session
 * @access  Protected
 */
router.get(
  '/sessions/:sessionId/messages',
  authenticate,
  aiController.getSessionMessages
);

/**
 * @route   PATCH /api/ai/sessions/:sessionId
 * @desc    Update session (rename title)
 * @access  Protected
 */
router.patch(
  '/sessions/:sessionId',
  authenticate,
  sanitizeInput,
  aiController.updateSession
);

/**
 * @route   DELETE /api/ai/sessions/:sessionId
 * @desc    Delete a session and all its messages
 * @access  Protected
 */
router.delete(
  '/sessions/:sessionId',
  authenticate,
  aiController.deleteSession
);

// ─── Existing Routes ─────────────────────────────────────────────

/**
 * @route   POST /api/ai/generate-prompt
 * @desc    Generate AI prompt via n8n workflow
 * @access  Protected
 * @body    { prompt: string, webhookUrl?: string, sessionId?: string }
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
 */
router.delete(
  '/conversation/:id',
  authenticate,
  aiController.deleteConversation
);

/**
 * @route   GET /api/ai/health
 * @desc    Health check for n8n webhook connectivity
 * @access  Protected
 */
router.get(
  '/health',
  authenticate,
  aiController.checkHealth
);

export default router;
