import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { User } from '../models/types';
import { LDAPUserAccessModel, LDAPUserAccess } from '../models/LDAPUserAccess';

// Extend Express Request interface to include user
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    ldapUser?: LDAPUserAccess;
    authType?: 'local' | 'ldap';
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      userId?: number; 
      username: string; 
      authType: 'local' | 'ldap';
    };
    
    if (decoded.authType === 'ldap') {
      // LDAP user authentication
      const ldapUser = await LDAPUserAccessModel.hasAccess(decoded.username);
      
      if (!ldapUser) {
        res.status(401).json({ 
          success: false, 
          message: 'LDAP access revoked or user not found' 
        });
        return;
      }

      // Add LDAP user to request object
      req.ldapUser = ldapUser;
      req.authType = 'ldap';
      
      // Create a user-like object for compatibility
      req.user = {
        UserID: ldapUser.AccessID,
        Username: ldapUser.Username,
        Email: ldapUser.Email,
        FirstName: ldapUser.DisplayName.split(' ')[0] || ldapUser.DisplayName,
        LastName: ldapUser.DisplayName.split(' ').slice(1).join(' ') || '',
        Role: ldapUser.Role,
        Department: ldapUser.Department || '',
        IsActive: ldapUser.IsActive,
        CreatedAt: ldapUser.CreatedAt,
        UpdatedAt: ldapUser.UpdatedAt
      } as User;
    } else {
      // Local user authentication
      const user = await UserModel.findById(decoded.userId!);
      
      if (!user) {
        res.status(401).json({ 
          success: false, 
          message: 'Invalid token - user not found' 
        });
        return;
      }

      // Add local user to request object
      req.user = user;
      req.authType = 'local';
    }
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    } else {
      console.error('Auth middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
    return;
  }

  if (req.user.Role !== 'Admin') {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user has admin or manager role
 */
export const requireManagerOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
    return;
  }

  if (!['Admin', 'Manager'].includes(req.user.Role)) {
    res.status(403).json({ 
      success: false, 
      message: 'Manager or Admin access required' 
    });
    return;
  }

  next();
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { 
        userId?: number; 
        username: string; 
        authType: 'local' | 'ldap';
      };
      
      if (decoded.authType === 'ldap') {
        const ldapUser = await LDAPUserAccessModel.hasAccess(decoded.username);
        
        if (ldapUser) {
          req.ldapUser = ldapUser;
          req.authType = 'ldap';
          
          // Create a user-like object for compatibility
          req.user = {
            UserID: ldapUser.AccessID,
            Username: ldapUser.Username,
            Email: ldapUser.Email,
            FirstName: ldapUser.DisplayName.split(' ')[0] || ldapUser.DisplayName,
            LastName: ldapUser.DisplayName.split(' ').slice(1).join(' ') || '',
            Role: ldapUser.Role,
            Department: ldapUser.Department || '',
            IsActive: ldapUser.IsActive,
            CreatedAt: ldapUser.CreatedAt,
            UpdatedAt: ldapUser.UpdatedAt
          } as User;
        }
      } else {
        const user = await UserModel.findById(decoded.userId!);
        
        if (user) {
          req.user = user;
          req.authType = 'local';
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};