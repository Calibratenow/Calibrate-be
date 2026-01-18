/**
 * AI Controller
 * Handles AI-related HTTP requests
 */

import aiService from '../services/aiService.js';
import { ResponseHandler } from '../utils/responseHandler.js';
import { ValidationError } from '../utils/errors.js';

class AiController {
  /**
   * Generate AI prompt via n8n workflow
   * POST /api/ai/generate-prompt
   * @body { prompt: string, webhookUrl?: string }
   */
  async generatePrompt(req, res, next) {
    try {
      const { prompt, webhookUrl } = req.body;
      const userId = req.user.id;

      // Validate input
      if (!prompt) {
        throw new ValidationError('Prompt is required');
      }

      if (typeof prompt !== 'string') {
        throw new ValidationError('Prompt must be a string');
      }

      if (prompt.trim().length === 0) {
        throw new ValidationError('Prompt cannot be empty');
      }

      if (prompt.trim().length > 5000) {
        throw new ValidationError('Prompt is too long (maximum 5000 characters)');
      }

      // Validate custom webhook URL if provided
      if (webhookUrl) {
        if (typeof webhookUrl !== 'string') {
          throw new ValidationError('Webhook URL must be a string');
        }

        try {
          new URL(webhookUrl);
        } catch (error) {
          throw new ValidationError('Invalid webhook URL format');
        }
      }

      // Generate prompt via n8n and save to Firebase
      const result = await aiService.generatePrompt(
        userId,
        prompt.trim(),
        webhookUrl || null
      );

      return ResponseHandler.success(
        res,
        {
          conversationId: result.conversation.id,
          response: result.response,
          prompt: result.conversation.prompt,
          createdAt: result.conversation.createdAt,
        },
        'AI prompt generated successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's AI conversation history
   * GET /api/ai/history
   * @query { limit?: number }
   */
  async getHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 50;

      // Validate limit
      if (limit < 1 || limit > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }

      const conversations = await aiService.getConversationHistory(userId, limit);

      return ResponseHandler.success(
        res,
        {
          conversations,
          count: conversations.length,
        },
        'Conversation history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific conversation
   * GET /api/ai/conversation/:id
   */
  async getConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      if (!id) {
        throw new ValidationError('Conversation ID is required');
      }

      const conversation = await aiService.getConversationById(id, userId);

      return ResponseHandler.success(
        res,
        { conversation },
        'Conversation retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a conversation
   * DELETE /api/ai/conversation/:id
   */
  async deleteConversation(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      if (!id) {
        throw new ValidationError('Conversation ID is required');
      }

      await aiService.deleteConversation(id, userId);

      return ResponseHandler.success(
        res,
        null,
        'Conversation deleted successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check for n8n webhook connectivity
   * GET /api/ai/health
   */
  async checkHealth(req, res, next) {
    try {
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      
      if (!webhookUrl) {
        return ResponseHandler.error(
          res,
          'n8n webhook URL not configured',
          500
        );
      }

      // Simple connectivity test with minimal prompt
      try {
        await aiService.callN8nWorkflow('health check', webhookUrl);
        
        return ResponseHandler.success(
          res,
          {
            status: 'healthy',
            webhookUrl: webhookUrl,
            message: 'n8n workflow is accessible',
          },
          'n8n workflow health check passed'
        );
      } catch (error) {
        return ResponseHandler.error(
          res,
          `n8n workflow health check failed: ${error.message}`,
          503,
          null
        );
      }
    } catch (error) {
      next(error);
    }
  }
}

export default new AiController();

