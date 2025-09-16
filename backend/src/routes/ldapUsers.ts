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
  const { username, email, displayName, department, role = 'user' } = req.body;

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
    Role: role as 'admin' | 'doccon' | 'user',
    GrantedBy: req.user!.UserID
  });

  return res.status(201).json({
    success: true,
    message: 'Access granted successfully',
    data: newAccess
  });
}));

/**
 * @route   POST /api/ldap-users/grant
 * @desc    Grant access to an LDAP user (simplified - fetches user details from LDAP)
 * @access  Private (Admin only)
 */
router.post('/grant', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username, role = 'user' } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required'
    });
  }

  // Validate role
  if (role && !['admin', 'doccon', 'user'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be admin, doccon, or user'
    });
  }

  console.log(`🔐 [Grant Access] Attempting to grant access to user: "${username}" with role: "${role}"`);

  try {
    // Check if user already has access
    const existingUser = await LDAPUserAccessModel.findByUsername(username);
    if (existingUser) {
      console.log(`⚠️ [Grant Access] User "${username}" already has access`);
      return res.status(409).json({
        success: false,
        message: 'User already has access'
      });
    }

    // Fetch user details from LDAP
    console.log(`🔍 [Grant Access] Fetching user details from LDAP for: "${username}"`);
    const ldapService = new LDAPService();
    const users = await ldapService.searchUsers(username);
    
    if (!users || users.length === 0) {
      console.log(`❌ [Grant Access] User "${username}" not found in LDAP`);
      return res.status(404).json({
        success: false,
        message: 'User not found in Active Directory'
      });
    }
    
    // Find exact match (case-insensitive)
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      console.log(`❌ [Grant Access] Exact match for "${username}" not found in LDAP results`);
      return res.status(404).json({
        success: false,
        message: 'User not found in Active Directory'
      });
    }
    
    console.log(`✅ [Grant Access] Found user in LDAP:`, {
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      department: user.department,
      role: role
    });
    
    // Check if email is already in use
    if (user.email) {
      const emailExists = await LDAPUserAccessModel.emailExists(user.email);
      if (emailExists) {
        console.log(`⚠️ [Grant Access] Email "${user.email}" already in use`);
        return res.status(409).json({
          success: false,
          message: 'Email address is already associated with another user'
        });
      }
    }
    
    // Grant access with LDAP user details and specified role
    const newAccess = await LDAPUserAccessModel.grantAccess({
      Username: user.username,
      Email: user.email || '',
      DisplayName: user.displayName,
      Department: user.department,
      Role: role as 'admin' | 'doccon' | 'user',
      GrantedBy: req.user!.UserID
    });
    
    console.log(`🎉 [Grant Access] Successfully granted access to "${username}" with role "${role}"`);
    
    return res.status(201).json({
      success: true,
      message: `Access granted successfully with ${role} role`,
      data: newAccess
    });
    
  } catch (error) {
    console.error(`❌ [Grant Access] Error granting access to "${username}":`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to grant access to user'
    });
  }
}));

/**
 * @route   GET /api/ldap-users/test-connection
 * @desc    Test LDAP connection
 * @access  Private (Admin only)
 */
router.get('/test-connection', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const ldapService = new LDAPService();
    await ldapService.testConnection();
    
    return res.json({
      success: true,
      message: 'LDAP connection successful'
    });
  } catch (error) {
    console.error('LDAP connection test failed:', error);
    return res.status(500).json({
      success: false,
      message: 'LDAP connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/ldap-users/search
 * @desc    Search LDAP users in Active Directory
 * @access  Private (Admin only)
 */
router.get('/search', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const query = req.query.q as string;
  
  console.log(`🔍 [LDAP Search] Received request for query: "${query}" at ${new Date().toISOString()}`);
  
  if (!query || query.trim().length < 2) {
    console.log('❌ [LDAP Search] Query too short, returning 400');
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long'
    });
  }

  try {
    console.log(`🔄 [LDAP Search] Starting LDAP search for: "${query.trim()}"`);
    const ldapService = new LDAPService();
    const users = await ldapService.searchUsers(query.trim());
    
    console.log(`✅ [LDAP Search] Found ${users?.length || 0} users for query: "${query.trim()}"`);    
    console.log(`📋 [LDAP Search] User data:`, JSON.stringify(users, null, 2));
    
    // Set no-cache headers to prevent browser caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    console.log(`📤 [LDAP Search] Sending response with ${users?.length || 0} users and no-cache headers`);
    
    return res.json({
      success: true,
      data: users || [],
      message: `Found ${users?.length || 0} users`
    });
  } catch (error) {
    console.error('LDAP search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search users in Active Directory',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   PUT /api/ldap-users/:username
 * @desc    Update LDAP user access
 * @access  Private (Admin only)
 */
router.put('/:username', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { role, department, isActive } = req.body;

  // Validate role if provided
  if (role && !['admin', 'doccon', 'user'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be admin, doccon, or user'
    });
  }

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