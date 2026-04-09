/**
 * AI Service
 * Handles AI prompt generation via n8n workflow, Firebase storage, and chat sessions
 */

import axios from 'axios';
import { db, collections, getTimestamp } from '../config/firestore.js';
import { AppError } from '../utils/errors.js';

class AiService {
  /**
   * Generate a short title from the first user prompt
   * @param {string} prompt
   * @returns {string}
   */
  generateTitle(prompt) {
    let text = prompt.trim();
    if (!text) return 'New Chat';

    if (text.length <= 40) return text;

    text = text.substring(0, 40);
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > 20) {
      text = text.substring(0, lastSpace);
    }
    return text + '...';
  }

  // ─── Session CRUD ──────────────────────────────────────────────

  /**
   * Create a new chat session
   */
  async createSession(userId, title = 'New Chat') {
    const sessionData = {
      userId,
      title,
      messageCount: 0,
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    const docRef = await db.collection(collections.chatSessions).add(sessionData);
    return { id: docRef.id, ...sessionData };
  }

  /**
   * List user's chat sessions ordered by updatedAt DESC
   */
  async getSessions(userId, limit = 50) {
    const snapshot = await db
      .collection(collections.chatSessions)
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    const sessions = [];
    snapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });
    return sessions;
  }

  /**
   * Get a single session by ID with ownership check
   */
  async getSessionById(sessionId, userId) {
    const doc = await db.collection(collections.chatSessions).doc(sessionId).get();

    if (!doc.exists) {
      throw new AppError('Session not found', 404);
    }

    const session = { id: doc.id, ...doc.data() };

    if (session.userId !== userId) {
      throw new AppError('Unauthorized access to session', 403);
    }

    return session;
  }

  /**
   * Get all messages for a session, ordered chronologically
   */
  async getSessionMessages(sessionId, userId, limit = 100) {
    // Verify ownership first
    await this.getSessionById(sessionId, userId);

    const snapshot = await db
      .collection(collections.aiConversations)
      .where('sessionId', '==', sessionId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    return messages;
  }

  /**
   * Update session metadata (e.g. rename title)
   */
  async updateSession(sessionId, userId, updates) {
    await this.getSessionById(sessionId, userId);

    const allowedFields = { title: updates.title };
    // Strip undefined values
    const cleanUpdates = {};
    for (const [key, value] of Object.entries(allowedFields)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    if (Object.keys(cleanUpdates).length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    cleanUpdates.updatedAt = getTimestamp();

    await db.collection(collections.chatSessions).doc(sessionId).update(cleanUpdates);

    return this.getSessionById(sessionId, userId);
  }

  /**
   * Delete a session and all its messages
   */
  async deleteSession(sessionId, userId) {
    await this.getSessionById(sessionId, userId);

    // Delete all messages in this session (batch, max 500 per batch)
    const messagesSnapshot = await db
      .collection(collections.aiConversations)
      .where('sessionId', '==', sessionId)
      .get();

    const batchSize = 500;
    const docs = messagesSnapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete the session itself
    await db.collection(collections.chatSessions).doc(sessionId).delete();
  }

  // ─── n8n Workflow ──────────────────────────────────────────────

  /**
   * Call n8n webhook to generate AI prompt
   */
  async callN8nWorkflow(prompt, webhookUrl = null) {
    try {
      const url = webhookUrl || process.env.N8N_WEBHOOK_URL;

      if (!url) {
        throw new AppError('n8n webhook URL not configured', 500);
      }

      try {
        new URL(url);
      } catch (error) {
        throw new AppError('Invalid webhook URL format', 400);
      }

      const response = await axios.post(
        url,
        { query: prompt },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000,
          validateStatus: (status) => status < 500,
        }
      );

      if (response.status !== 200) {
        throw new AppError(
          `n8n workflow returned status ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const responseData = response.data;

      let aiResponse;
      if (typeof responseData === 'string') {
        aiResponse = responseData;
      } else if (responseData.content) {
        aiResponse = responseData.content;
      } else if (responseData.response) {
        aiResponse = responseData.response;
      } else if (responseData.output) {
        aiResponse = responseData.output;
      } else if (responseData.result) {
        aiResponse = responseData.result;
      } else if (responseData.message && responseData.message.content) {
        aiResponse = responseData.message.content;
      } else {
        aiResponse = JSON.stringify(responseData);
      }

      return {
        success: true,
        response: aiResponse,
        rawResponse: responseData,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;

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

      throw new AppError(`Failed to call n8n workflow: ${error.message}`, 500);
    }
  }

  // ─── Conversation Storage ──────────────────────────────────────

  /**
   * Save AI conversation to Firebase (now with sessionId)
   */
  async saveConversation(userId, prompt, response, webhookUrl, sessionId, metadata = {}) {
    try {
      const conversationData = {
        userId,
        sessionId,
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

      const docRef = await db.collection(collections.aiConversations).add(conversationData);

      // Update session's updatedAt and messageCount
      const sessionRef = db.collection(collections.chatSessions).doc(sessionId);
      await sessionRef.update({
        updatedAt: getTimestamp(),
        messageCount: (await sessionRef.get()).data().messageCount + 1,
      });

      return { id: docRef.id, ...conversationData };
    } catch (error) {
      console.error('Error saving AI conversation to Firebase:', error);
      throw new AppError('Failed to save conversation to database', 500);
    }
  }

  /**
   * Get user's AI conversation history
   */
  async getConversationHistory(userId, limit = 50) {
    try {
      const snapshot = await db
        .collection(collections.aiConversations)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const conversations = [];
      snapshot.forEach((doc) => {
        conversations.push({ id: doc.id, ...doc.data() });
      });

      return conversations;
    } catch (error) {
      console.error('Error fetching AI conversation history:', error);
      throw new AppError('Failed to fetch conversation history', 500);
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversationById(conversationId, userId) {
    try {
      const doc = await db.collection(collections.aiConversations).doc(conversationId).get();

      if (!doc.exists) {
        throw new AppError('Conversation not found', 404);
      }

      const conversation = { id: doc.id, ...doc.data() };

      if (conversation.userId !== userId) {
        throw new AppError('Unauthorized access to conversation', 403);
      }

      return conversation;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Error fetching conversation:', error);
      throw new AppError('Failed to fetch conversation', 500);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId, userId) {
    try {
      await this.getConversationById(conversationId, userId);
      await db.collection(collections.aiConversations).doc(conversationId).delete();
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Error deleting conversation:', error);
      throw new AppError('Failed to delete conversation', 500);
    }
  }

  // ─── Main Generate Method ──────────────────────────────────────

  /**
   * Generate AI prompt — now session-aware
   * If sessionId is provided, uses it. Otherwise creates a new session.
   */
  async generatePrompt(userId, prompt, webhookUrl = null, sessionId = null) {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new AppError('Prompt is required and must be a non-empty string', 400);
    }

    if (prompt.trim().length > 5000) {
      throw new AppError('Prompt is too long (maximum 5000 characters)', 400);
    }

    // If no sessionId, create a new session with auto-generated title
    let isNewSession = false;
    if (!sessionId) {
      const title = this.generateTitle(prompt);
      const session = await this.createSession(userId, title);
      sessionId = session.id;
      isNewSession = true;
    } else {
      // Verify ownership
      await this.getSessionById(sessionId, userId);
    }

    // Call n8n workflow
    const workflowResult = await this.callN8nWorkflow(prompt, webhookUrl);

    // Save to Firebase with sessionId
    const savedConversation = await this.saveConversation(
      userId,
      prompt,
      workflowResult.response,
      webhookUrl,
      sessionId,
      {
        workflowSuccess: workflowResult.success,
        hasRawResponse: !!workflowResult.rawResponse,
      }
    );

    return {
      conversation: savedConversation,
      response: workflowResult.response,
      sessionId,
      isNewSession,
    };
  }
}

export default new AiService();
