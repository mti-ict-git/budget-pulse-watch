import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { LDAPUserAccessModel } from '../models/LDAPUserAccess';
import { LDAPService } from '../services/ldapService';

const router = express.Router();

/**
 * @route   GET /api/ldap-users
 * @desc    Get all LDAP users with access
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;

  const result = await LDAPUserAccessModel.findAll(page, limit, search);

  return res.json({
    success: true,
    data: result.users,
    pagination: {
      page,
      limit,
      total: result.total,
      pages: Math.ceil(result.total / limit)
    }
  });
}));

/**
 * @route   POST /api/ldap-users/grant-access
 * @desc    Grant access to an LDAP user
 * @access  Private (Admin only)
 */
router.post('/grant-access', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username, email, displayName, department, role = 'User' } = req.body;

  // Validate input
  if (!username || !email || !displayName) {
    return res.status(400).json({
      success: false,
      message: 'Username, email, and display name are required'
    });
  }

  // Check if user already has access
  const existingAccess = await LDAPUserAccessModel.findByUsername(username);
  if (existingAccess) {
    return res.status(409).json({
      success: false,
      message: 'User already has access'
    });
  }

  // Check if email is already used
  const emailExists = await LDAPUserAccessModel.emailExists(email);
  if (emailExists) {
    return res.status(409).json({
      success: false,
      message: 'Email is already associated with another user'
    });
  }

  // Verify user exists in LDAP
  try {
    const ldapService = new LDAPService();
    const ldapUsers = await ldapService.searchUsers(username);
    
    if (!ldapUsers || ldapUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found in Active Directory'
      });
    }
  } catch (error) {
    console.error('LDAP search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify user in Active Directory'
    });
  }

  // Grant access
  const newAccess = await LDAPUserAccessModel.grantAccess({
    Username: username,
    Email: email,
    DisplayName: displayName,
    Department: department,
    Role: role as 'Admin' | 'Manager' | 'User',
    GrantedBy: req.user!.UserID
  });

  return res.status(201).json({
    success: true,
    message: 'Access granted successfully',
    data: newAccess
  });
}));

/**
 * @route   PUT /api/ldap-users/:username
 * @desc    Update LDAP user access
 * @access  Private (Admin only)
 */
router.put('/:username', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { role, department, isActive } = req.body;

  // Check if user exists
  const existingUser = await LDAPUserAccessModel.findByUsername(username);
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update user access
  const updatedUser = await LDAPUserAccessModel.updateAccess(username, {
    Role: role,
    Department: department,
    IsActive: isActive
  });

  return res.json({
    success: true,
    message: 'User access updated successfully',
    data: updatedUser
  });
}));

/**
 * @route   DELETE /api/ldap-users/:username
 * @desc    Revoke LDAP user access
 * @access  Private (Admin only)
 */
router.delete('/:username', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username } = req.params;

  // Check if user exists
  const existingUser = await LDAPUserAccessModel.findByUsername(username);
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Revoke access
  const success = await LDAPUserAccessModel.revokeAccess(username);

  if (success) {
    return res.json({
      success: true,
      message: 'User access revoked successfully'
    });
  } else {
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke user access'
    });
  }
}));

/**
 * @route   GET /api/ldap-users/:username
 * @desc    Get specific LDAP user
 * @access  Private (Admin only)
 */
router.get('/:username', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username } = req.params;

  const user = await LDAPUserAccessModel.findByUsername(username);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  return res.json({
    success: true,
    data: user
  });
}));

/**
 * @route   GET /api/ldap-users/statistics
 * @desc    Get LDAP user access statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const statistics = await LDAPUserAccessModel.getStatistics();

  return res.json({
    success: true,
    data: statistics
  });
}));

/**
 * @route   POST /api/ldap-users/search-ad
 * @desc    Search for users in Active Directory
 * @access  Private (Admin only)
 */
router.post('/search-ad', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { searchTerm } = req.body;

  if (!searchTerm || searchTerm.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Search term must be at least 3 characters long'
    });
  }

  try {
    const ldapService = new LDAPService();
    const users = await ldapService.searchUsers(searchTerm);

    return res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('LDAP search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search Active Directory'
    });
  }
}));

/**
 * @route   POST /api/ldap-users/test-connection
 * @desc    Test LDAP connection
 * @access  Private (Admin only)
 */
router.post('/test-connection', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const ldapService = new LDAPService();
    const isConnected = await ldapService.testConnection();

    if (isConnected) {
      return res.json({
        success: true,
        message: 'LDAP connection successful'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'LDAP connection failed'
      });
    }
  } catch (error) {
    console.error('LDAP connection test error:', error);
    return res.status(500).json({
      success: false,
      message: 'LDAP connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;