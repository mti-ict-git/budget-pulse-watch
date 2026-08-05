import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { answerPrfQuestion, ChatMessageInput } from '../services/prfChatService';

const router = express.Router();

router.post('/messages', authenticateToken, async (req: Request, res: Response) => {
  try {
    const rawMessages: unknown = req.body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 20) {
      return res.status(400).json({ success: false, message: 'messages must contain between 1 and 20 entries' });
    }
    const valid = rawMessages.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return (value.role === 'user' || value.role === 'assistant') && typeof value.content === 'string' && value.content.trim().length > 0 && value.content.length <= 4000;
    });
    if (!valid || (rawMessages[rawMessages.length - 1] as Record<string, unknown>).role !== 'user') {
      return res.status(400).json({ success: false, message: 'Invalid message history; the last message must be from the user' });
    }
    const messages = rawMessages as ChatMessageInput[];
    const identity = `${req.authType || 'api'}:${req.user?.Username || req.user?.UserID || 'unknown'}`;
    const data = await answerPrfQuestion(messages, identity);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[PRF Chat] Failed to answer question:', error);
    const message = error instanceof Error ? error.message : 'Failed to answer question';
    const configurationError = /API key is not configured/i.test(message);
    return res.status(configurationError ? 503 : 500).json({ success: false, message });
  }
});

export default router;
