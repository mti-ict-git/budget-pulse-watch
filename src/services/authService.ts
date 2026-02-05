interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  createdAt: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

class AuthService {
  private baseUrl = '/api/auth';

  /**
   * Login user with username and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      const contentType = response.headers.get('content-type') || '';
      let data: LoginResponse;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text) as LoginResponse;
        } catch {
          return {
            success: false,
            message: `Server error ${response.status}`,
          };
        }
      }

      if (response.ok) {
        // Store authentication data
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch(`${this.baseUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      this.clearAuthData();
    }
  }

  /**
   * Get current authentication token
   */
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  /**
   * Get current user data
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        this.clearAuthData();
      }
    }
    return null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  /**
   * Check if current user is admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Check if current user can manage content (admin or doccon)
   */
  canManageContent(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin' || user?.role === 'doccon';
  }

  /**
   * Check if current user has read-only access
   */
  isReadOnly(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'user';
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(): string {
    const user = this.getCurrentUser();
    if (!user) return 'Unknown';
    
    const displayNames: Record<string, string> = {
      admin: 'Administrator',
      doccon: 'Document Controller',
      user: 'User'
    };
    return displayNames[user.role] || user.role;
  }

  /**
   * Clear authentication data from localStorage
   */
  clearAuthData(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  /**
   * Verify token validity with server
   */
  async verifyToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${this.baseUrl}/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.clearAuthData();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      this.clearAuthData();
      return false;
    }
  }

  /**
   * Get authorization headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token
      ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        };
  }
}

// Export singleton instance
export const authService = new AuthService();
export type { User, LoginRequest, LoginResponse };
