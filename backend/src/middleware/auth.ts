import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { User } from '../models/types';
import { LDAPUserAccessModel, LDAPUserAccess } from '../models/LDAPUserAccess';
import { UserRole, Permission, hasPermission, isAdmin, canManageContent } from '../utils/rolePermissions';

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

  if (!isAdmin(req.user.Role as UserRole)) {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user has admin or doccon role (content management)
 */
export const requireContentManager = (
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

  if (!canManageContent(req.user.Role as UserRole)) {
    res.status(403).json({ 
      success: false, 
      message: 'Content management access required (admin or doccon role)' 
    });
    return;
  }

  next();
};

/**
 * Middleware factory to check specific permissions
 */
export const requirePermission = (permission: Permission) => (
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

  if (!hasPermission(req.user.Role as UserRole, permission)) {
    res.status(403).json({ 
      success: false, 
      message: `Insufficient permissions. Required: ${permission}` 
    });
    return;
  }

  next();
};

/**
 * Middleware factory to check multiple permissions (user must have ALL)
 */
export const requireAllPermissions = (permissions: Permission[]) => (
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

  const userRole = req.user.Role as UserRole;
  const missingPermissions = permissions.filter(permission => !hasPermission(userRole, permission));
  
  if (missingPermissions.length > 0) {
    res.status(403).json({ 
      success: false, 
      message: `Insufficient permissions. Missing: ${missingPermissions.join(', ')}` 
    });
    return;
  }

  next();
};

/**
 * Middleware factory to check multiple permissions (user must have ANY)
 */
export const requireAnyPermission = (permissions: Permission[]) => (
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

  const userRole = req.user.Role as UserRole;
  const hasAnyPermission = permissions.some(permission => hasPermission(userRole, permission));
  
  if (!hasAnyPermission) {
    res.status(403).json({ 
      success: false, 
      message: `Insufficient permissions. Required one of: ${permissions.join(', ')}` 
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