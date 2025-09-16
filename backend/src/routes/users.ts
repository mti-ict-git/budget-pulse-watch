import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { CreateUserRequest, UpdateUserParams, User } from '../models/types';

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all local users
 * @access  Private (Admin only)
 */
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  
  const offset = (Number(page) - 1) * Number(limit);
  
  const result = await UserModel.findAll(Number(page), Number(limit), search as string);
  const users = result.users;
  
  // Remove password hashes from response
  const sanitizedUsers = users.map((user: Omit<User, 'PasswordHash'>) => {
    return user; // Already omitted PasswordHash from UserModel.findAll
  });
  
  return res.json({
    success: true,
    data: sanitizedUsers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: sanitizedUsers.length
    }
  });
}));

/**
 * @route   GET /api/users/:id
 * @desc    Get specific local user
 * @access  Private (Admin only)
 */
router.get('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  const user = await UserModel.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Remove password hash from response
  const { PasswordHash, ...userWithoutPassword } = user;
  
  return res.json({
    success: true,
    data: userWithoutPassword
  });
}));

/**
 * @route   POST /api/users
 * @desc    Create new local user
 * @access  Private (Admin only)
 */
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { Username, Email, Password, FirstName, LastName, Role = 'user', Department } = req.body as CreateUserRequest;
  
  // Validate required fields
  if (!Username || !Email || !Password || !FirstName || !LastName) {
    return res.status(400).json({
      success: false,
      message: 'Username, Email, Password, FirstName, and LastName are required'
    });
  }
  
  // Validate role
  if (Role && !['admin', 'doccon', 'user'].includes(Role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be admin, doccon, or user'
    });
  }
  
  // Check if username already exists
  const usernameExists = await UserModel.usernameExists(Username);
  if (usernameExists) {
    return res.status(409).json({
      success: false,
      message: 'Username already exists'
    });
  }
  
  // Check if email already exists
  const emailExists = await UserModel.emailExists(Email);
  if (emailExists) {
    return res.status(409).json({
      success: false,
      message: 'Email already exists'
    });
  }
  
  // Create user
  const newUser = await UserModel.create({
    Username,
    Email,
    Password,
    FirstName,
    LastName,
    Role,
    Department
  });
  
  // Remove password hash from response
  const { PasswordHash: _, ...userWithoutPassword } = newUser;
  
  return res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: userWithoutPassword
  });
}));

/**
 * @route   PUT /api/users/:id
 * @desc    Update local user
 * @access  Private (Admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  const { Username, Email, FirstName, LastName, Role, Department, Password } = req.body;
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  // Validate role if provided
  if (Role && !['admin', 'doccon', 'user'].includes(Role)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid role. Must be admin, doccon, or user'
    });
  }
  
  // Check if user exists
  const existingUser = await UserModel.findById(userId);
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Check if username is being changed and if it already exists
  if (Username && Username !== existingUser.Username) {
    const usernameExists = await UserModel.usernameExists(Username, userId);
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }
  }
  
  // Check if email is being changed and if it already exists
  if (Email && Email !== existingUser.Email) {
    const emailExists = await UserModel.emailExists(Email, userId);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }
  }
  
  // Prepare update parameters
  const updateParams: UpdateUserParams = {
    UserID: userId,
    Username,
    Email,
    FirstName,
    LastName,
    Role,
    Department
  };
  
  // Hash new password if provided
  if (Password) {
    const saltRounds = 12;
    updateParams.PasswordHash = await bcrypt.hash(Password, saltRounds);
  }
  
  // Update user
  const updatedUser = await UserModel.update(userId, updateParams);
  
  // Remove password hash from response
  const { PasswordHash, ...userWithoutPassword } = updatedUser;
  
  return res.json({
    success: true,
    message: 'User updated successfully',
    data: userWithoutPassword
  });
}));

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete local user
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  // Check if user exists
  const existingUser = await UserModel.findById(userId);
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Prevent deletion of the last admin user
  if (existingUser.Role === 'admin') {
    const adminResult = await UserModel.findAll(1, 1000, '');
    const adminCount = adminResult.users.filter((user: Omit<User, 'PasswordHash'>) => user.Role === 'admin').length;
    
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last admin user'
      });
    }
  }
  
  // Prevent users from deleting themselves
  if (req.user!.UserID === userId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }
  
  // Delete user
  const success = await UserModel.delete(userId);
  
  if (success) {
    return res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } else {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
}));

/**
 * @route   PUT /api/users/:id/toggle-status
 * @desc    Toggle user active status
 * @access  Private (Admin only)
 */
router.put('/:id/toggle-status', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user ID'
    });
  }
  
  // Check if user exists
  const existingUser = await UserModel.findById(userId);
  if (!existingUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Prevent deactivating the last admin user
  if (existingUser.Role === 'admin' && existingUser.IsActive) {
    const adminResult = await UserModel.findAll(1, 1000, '');
    const activeAdminCount = adminResult.users.filter((user: Omit<User, 'PasswordHash'>) => user.Role === 'admin' && user.IsActive).length;
    
    if (activeAdminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate the last active admin user'
      });
    }
  }
  
  // Prevent users from deactivating themselves
  if (req.user!.UserID === userId) {
    return res.status(400).json({
      success: false,
      message: 'Cannot deactivate your own account'
    });
  }
  
  // Toggle status
  const updatedUser = await UserModel.toggleStatus(userId);
  
  // Remove password hash from response
  const { PasswordHash, ...userWithoutPassword } = updatedUser;
  
  return res.json({
    success: true,
    message: `User ${updatedUser.IsActive ? 'activated' : 'deactivated'} successfully`,
    data: userWithoutPassword
  });
}));

/**
 * @route   GET /api/users/statistics
 * @desc    Get user statistics
 * @access  Private (Admin only)
 */
router.get('/stats/overview', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const allUsersResult = await UserModel.findAll(1, 1000, '');
  const allUsers = allUsersResult.users;
  
  const statistics = {
    total: allUsers.length,
    active: allUsers.filter((user: Omit<User, 'PasswordHash'>) => user.IsActive).length,
    inactive: allUsers.filter((user: Omit<User, 'PasswordHash'>) => !user.IsActive).length,
    byRole: {
      admin: allUsers.filter((user: Omit<User, 'PasswordHash'>) => user.Role === 'admin').length,
      doccon: allUsers.filter((user: Omit<User, 'PasswordHash'>) => user.Role === 'doccon').length,
      user: allUsers.filter((user: Omit<User, 'PasswordHash'>) => user.Role === 'user').length
    }
  };
  
  return res.json({
    success: true,
    data: statistics
  });
}));

export default router;