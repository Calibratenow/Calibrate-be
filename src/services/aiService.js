/**
 * AI Service
 * Handles AI prompt generation via n8n workflow and Firebase storage
 */

import axios from 'axios';
import { db, collections, getTimestamp } from '../config/firestore.js';
import { AppError } from '../utils/errors.js';

class AiService {
  /**
   * Call n8n webhook to generate AI prompt
   * @param {string} prompt - User's prompt requirements
   * @param {string} webhookUrl - Custom webhook URL (optional, falls back to env)
   * @returns {Promise<Object>} n8n response
   */
  async callN8nWorkflow(prompt, webhookUrl = null) {
    try {
      const url = webhookUrl || process.env.N8N_WEBHOOK_URL;
      
      if (!url) {
        throw new AppError('n8n webhook URL not configured', 500);
      }

      // Validate webhook URL format
      try {
        new URL(url);
      } catch (error) {
        throw new AppError('Invalid webhook URL format', 400);
      }

      // Call n8n webhook with timeout
      const response = await axios.post(
        url,
        { query: prompt },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        }
      );

      // Handle non-200 responses
      if (response.status !== 200) {
        throw new AppError(
          `n8n workflow returned status ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      // Extract response data
      const responseData = response.data;
      
      // Handle different response formats
      let aiResponse;
      if (typeof responseData === 'string') {
        aiResponse = responseData;
      } else if (responseData.content) {
        // Primary format from n8n workflow
        aiResponse = responseData.content;
      } else if (responseData.response) {
        aiResponse = responseData.response;
      } else if (responseData.output) {
        aiResponse = responseData.output;
      } else if (responseData.result) {
        aiResponse = responseData.result;
      } else if (responseData.message && responseData.message.content) {
        // Alternative format: { message: { content: "..." } }
        aiResponse = responseData.message.content;
      } else {
        // If response is an object without known fields, stringify it
        aiResponse = JSON.stringify(responseData);
      }

      return {
        success: true,
        response: aiResponse,
        rawResponse: responseData,
      };
    } catch (error) {
      // Handle different error types
      if (error instanceof AppError) {
        throw error;
      }

      if (error.code === 'ECONNREFUSED') {
        throw new AppError('Unable to connect to n8n workflow. Please check if n8n is running.', 503);
      }

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new AppError('n8n workflow request timed out. Please try again.', 504);
      }

      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new AppError(`n8n workflow error: ${message}`, error.response?.status || 500);
      }

      // Unknown error
      throw new AppError(`Failed to call n8n workflow: ${error.message}`, 500);
    }
  }

  /**
   * Save AI conversation to Firebase
   * @param {string} userId - User ID
   * @param {string} prompt - User's prompt
   * @param {string} response - AI's response
   * @param {string} webhookUrl - Webhook URL used
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Saved conversation data
   */
  async saveConversation(userId, prompt, response, webhookUrl, metadata = {}) {
    try {
      const conversationData = {
        userId,
        prompt: prompt.trim(),
        response: response,
        webhookUrl: webhookUrl || process.env.N8N_WEBHOOK_URL || 'default',
        metadata: {
          promptLength: prompt.length,
          responseLength: typeof response === 'string' ? response.length : JSON.stringify(response).length,
          ...metadata,
        },
        createdAt: getTimestamp(),
        timestamp: getTimestamp(),
      };

      // Save to Firestore
      const docRef = await db.collection('ai_conversations').add(conversationData);
      
      return {
        id: docRef.id,
        ...conversationData,
      };
    } catch (error) {
      console.error('Error saving AI conversation to Firebase:', error);
      throw new AppError('Failed to save conversation to database', 500);
    }
  }

  /**
   * Get user's AI conversation history
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of conversations to fetch
   * @returns {Promise<Array>} Array of conversations
   */
  async getConversationHistory(userId, limit = 50) {
    try {
      const snapshot = await db
        .collection('ai_conversations')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const conversations = [];
      snapshot.forEach((doc) => {
        conversations.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return conversations;
    } catch (error) {
      console.error('Error fetching AI conversation history:', error);
      throw new AppError('Failed to fetch conversation history', 500);
    }
  }

  /**
   * Get a specific conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object>} Conversation data
   */
  async getConversationById(conversationId, userId) {
    try {
      const doc = await db.collection('ai_conversations').doc(conversationId).get();

      if (!doc.exists) {
        throw new AppError('Conversation not found', 404);
      }

      const conversation = { id: doc.id, ...doc.data() };

      // Check if user owns this conversation
      if (conversation.userId !== userId) {
        throw new AppError('Unauthorized access to conversation', 403);
      }

      return conversation;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching conversation:', error);
      throw new AppError('Failed to fetch conversation', 500);
    }
  }

  /**
   * Delete a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<void>}
   */
  async deleteConversation(conversationId, userId) {
    try {
      // First verify ownership
      await this.getConversationById(conversationId, userId);

      // Delete the conversation
      await db.collection('ai_conversations').doc(conversationId).delete();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting conversation:', error);
      throw new AppError('Failed to delete conversation', 500);
    }
  }

  /**
   * Generate AI prompt (main method combining webhook call and save)
   * @param {string} userId - User ID
   * @param {string} prompt - User's prompt requirements
   * @param {string} webhookUrl - Custom webhook URL (optional)
   * @returns {Promise<Object>} Generated prompt and saved conversation
   */
  async generatePrompt(userId, prompt, webhookUrl = null) {
    // Validate input
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new AppError('Prompt is required and must be a non-empty string', 400);
    }

    if (prompt.trim().length > 5000) {
      throw new AppError('Prompt is too long (maximum 5000 characters)', 400);
    }

    // Call n8n workflow
    const workflowResult = await this.callN8nWorkflow(prompt, webhookUrl);

    // Save to Firebase
    const savedConversation = await this.saveConversation(
      userId,
      prompt,
      workflowResult.response,
      webhookUrl,
      {
        workflowSuccess: workflowResult.success,
        hasRawResponse: !!workflowResult.rawResponse,
      }
    );

    return {
      conversation: savedConversation,
      response: workflowResult.response,
    };
  }
}

export default new AiService();

