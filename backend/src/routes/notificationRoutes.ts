import { Router, Request, Response } from 'express';
import { NotificationModel } from '../models/Notification';
import { authenticateToken } from '../middleware/auth';
import { executeQuery } from '../config/database';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/notifications
 * @desc Get all notifications for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.UserID;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = unreadOnly 
      ? await NotificationModel.getUnreadByUserId(userId)
      : await NotificationModel.getAllByUserId(userId, limit, offset);

    return res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/notifications/:id/detail
 * @desc Get notification detail + closest PRF audit log entry (Pronto)
 */
router.get('/:id/detail', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.UserID;
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const notification = await NotificationModel.getByIdForUser(notificationId, userId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    type AuditRow = {
      AuditID: number;
      ChangedAt: Date;
      OldValues: string | null;
      NewValues: string | null;
    };

    let audit: AuditRow | null = null;
    if (notification.ReferenceType === 'PRF' && typeof notification.ReferenceID === 'number') {
      const query = `
        SELECT TOP 1
          a.AuditID,
          a.ChangedAt,
          a.OldValues,
          a.NewValues
        FROM AuditLog a
        WHERE a.TableName = 'PRF'
          AND a.RecordID = @PRFID
          AND a.Action = 'UPDATE'
          AND a.NewValues LIKE '%"source":"pronto"%'
          AND a.ChangedAt BETWEEN DATEADD(minute, -15, @CreatedAt) AND DATEADD(minute, 15, @CreatedAt)
        ORDER BY ABS(DATEDIFF(second, a.ChangedAt, @CreatedAt)) ASC, a.AuditID DESC
      `;
      const result = await executeQuery<AuditRow>(query, {
        PRFID: notification.ReferenceID,
        CreatedAt: notification.CreatedAt
      });
      audit = result.recordset[0] ?? null;
    }

    return res.json({
      success: true,
      data: {
        notification,
        audit
      }
    });
  } catch (error) {
    console.error('Error fetching notification detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notification detail',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a specific notification as read
 */
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.UserID;
    const notificationId = parseInt(req.params.id);

    if (isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const success = await NotificationModel.markAsRead(notificationId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or already read'
      });
    }

    return res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read for the authenticated user
 */
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.UserID;
    const count = await NotificationModel.markAllAsRead(userId);

    return res.json({
      success: true,
      message: `Marked ${count} notifications as read`,
      data: { updatedCount: count }
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
