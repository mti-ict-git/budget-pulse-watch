import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { LDAPService } from '../services/ldapService';
import { LDAPUserAccessModel } from '../models/LDAPUserAccess';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password, authType = 'auto' } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  let authResult = null;
  let isLDAPAuth = false;

  // Try LDAP authentication first (if auto or ldap)
  if (authType === 'auto' || authType === 'ldap') {
    try {
      const ldapService = new LDAPService();
      const ldapUser = await ldapService.authenticateUser(username, password);
      
      if (ldapUser) {
        // Check if user has access in our system
        const userAccess = await LDAPUserAccessModel.hasAccess(username);
        
        if (!userAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access not granted. Please contact administrator for access.'
          });
        }

        // Update last login
        await LDAPUserAccessModel.updateLastLogin(username);

        // Generate JWT token for LDAP user
        const token = jwt.sign(
          {
            username: userAccess.Username,
            authType: 'ldap'
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        authResult = {
          success: true,
          token,
          user: {
            id: userAccess.AccessID,
            username: userAccess.Username,
            role: userAccess.Role,
            email: userAccess.Email,
            firstName: userAccess.DisplayName.split(' ')[0] || userAccess.DisplayName,
            lastName: userAccess.DisplayName.split(' ').slice(1).join(' ') || '',
            department: userAccess.Department,
            authType: 'ldap',
            createdAt: userAccess.CreatedAt
          }
        };
        isLDAPAuth = true;
      }
    } catch (ldapError) {
      console.log('LDAP authentication failed:', ldapError);
      // Continue to local authentication if LDAP fails and authType is auto
    }
  }

  // Try local authentication if LDAP failed or authType is local
  if (!authResult && (authType === 'auto' || authType === 'local')) {
    try {
      // Find user by username
      const user = await UserModel.findByUsername(username);
      
      if (user) {
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
        
        if (isValidPassword) {
          // Generate JWT token for local user
          const token = jwt.sign(
            {
              userId: user.UserID,
              username: user.Username,
              authType: 'local'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
          );

          // Update last login
          await UserModel.updateLastLogin(user.UserID);

          authResult = {
            success: true,
            token,
            user: {
              id: user.UserID,
              username: user.Username,
              role: user.Role,
              email: user.Email,
              firstName: user.FirstName,
              lastName: user.LastName,
              department: user.Department,
              authType: 'local',
              createdAt: user.CreatedAt
            }
          };
        }
      }
    } catch (localError) {
      console.error('Local authentication error:', localError);
    }
  }

  // Return result or error
  if (authResult) {
    return res.json(authResult);
  } else {
    return res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
}));

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token validity
 * @access  Private
 */
router.get('/verify', authenticateToken, asyncHandler(async (req, res) => {
  // If we reach here, the token is valid (middleware verified it)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'User not found'
    });
  }

  return res.json({
    success: true,
    user: {
      id: req.user.UserID,
      username: req.user.Username,
      role: req.user.Role,
      email: req.user.Email,
      firstName: req.user.FirstName,
      lastName: req.user.LastName,
      department: req.user.Department,
      authType: req.authType || 'local',
      createdAt: req.user.CreatedAt
    }
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'User not found'
    });
  }

  return res.json({
    success: true,
    user: {
      id: req.user.UserID,
      username: req.user.Username,
      role: req.user.Role,
      email: req.user.Email,
      firstName: req.user.FirstName,
      lastName: req.user.LastName,
      department: req.user.Department,
      authType: req.authType || 'local',
      createdAt: req.user.CreatedAt,
      lastLogin: req.authType === 'ldap' ? req.ldapUser?.LastLogin : req.user.UpdatedAt
    }
  });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // In a production environment, you might want to add the token to a blacklist
  // For now, we'll just return success as the client will remove the token
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

export default router;