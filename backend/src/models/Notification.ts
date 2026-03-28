import { executeQuery } from '../config/database';
import { Notification, CreateNotificationRequest } from './types';

export class NotificationModel {
  /**
   * Create a new notification
   */
  static async create(data: CreateNotificationRequest): Promise<Notification> {
    const query = `
      INSERT INTO Notifications (UserID, Title, Message, ReferenceType, ReferenceID)
      OUTPUT INSERTED.*
      VALUES (@UserID, @Title, @Message, @ReferenceType, @ReferenceID)
    `;

    const params = {
      UserID: data.UserID,
      Title: data.Title,
      Message: data.Message,
      ReferenceType: data.ReferenceType,
      ReferenceID: data.ReferenceID || null
    };

    const result = await executeQuery<Notification>(query, params);
    return result.recordset[0];
  }

  /**
   * Get unread notifications for a user
   */
  static async getUnreadByUserId(userId: number): Promise<Notification[]> {
    const query = `
      SELECT * FROM Notifications 
      WHERE UserID = @UserID AND IsRead = 0
      ORDER BY CreatedAt DESC
    `;
    
    const result = await executeQuery<Notification>(query, { UserID: userId });
    return result.recordset;
  }

  /**
   * Get all notifications for a user (with pagination)
   */
  static async getAllByUserId(userId: number, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const query = `
      SELECT * FROM Notifications 
      WHERE UserID = @UserID
      ORDER BY CreatedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;
    
    const result = await executeQuery<Notification>(query, { 
      UserID: userId,
      Limit: limit,
      Offset: offset
    });
    return result.recordset;
  }

  static async getByIdForUser(notificationId: number, userId: number): Promise<Notification | null> {
    const query = `
      SELECT TOP 1 *
      FROM Notifications
      WHERE NotificationID = @NotificationID AND UserID = @UserID
    `;
    const result = await executeQuery<Notification>(query, { NotificationID: notificationId, UserID: userId });
    return result.recordset[0] ?? null;
  }

  /**
   * Mark a specific notification as read
   */
  static async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const query = `
      UPDATE Notifications
      SET IsRead = 1
      WHERE NotificationID = @NotificationID AND UserID = @UserID
    `;
    
    const result = await executeQuery(query, { 
      NotificationID: notificationId,
      UserID: userId
    });
    
    return result.rowsAffected[0] > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: number): Promise<number> {
    const query = `
      UPDATE Notifications
      SET IsRead = 1
      WHERE UserID = @UserID AND IsRead = 0
    `;
    
    const result = await executeQuery(query, { UserID: userId });
    return result.rowsAffected[0];
  }
}
