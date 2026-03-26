import { authService } from './authService';

const API_URL = '/api/notifications';

export interface Notification {
  NotificationID: number;
  UserID: number;
  Title: string;
  Message: string;
  ReferenceType: string;
  ReferenceID?: number;
  IsRead: boolean;
  CreatedAt: string;
}

class NotificationService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers = authService.getAuthHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      authService.logout();
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    return response.json();
  }

  async getNotifications(unreadOnly: boolean = false, limit: number = 50, offset: number = 0) {
    try {
      const url = `${API_URL}?unreadOnly=${unreadOnly}&limit=${limit}&offset=${offset}`;
      return await this.fetchWithAuth(url);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: number) {
    try {
      return await this.fetchWithAuth(`${API_URL}/${notificationId}/read`, {
        method: 'PUT',
      });
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  async markAllAsRead() {
    try {
      return await this.fetchWithAuth(`${API_URL}/read-all`, {
        method: 'PUT',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
