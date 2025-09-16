import { executeQuery } from '../config/database';
import { User, CreateUserRequest, LoginRequest, UpdateUserParams, UserQueryParams, UsernameExistsParams, EmailExistsParams } from './types';
import bcrypt from 'bcryptjs';

// Interface for count query results
interface CountResult {
  Total: number;
}

interface ExistsResult {
  Count: number;
}

export class UserModel {
  /**
   * Create a new user
   */
  static async create(userData: CreateUserRequest): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.Password, 10);
    
    const query = `
      INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role, Department)
      OUTPUT INSERTED.*
      VALUES (@Username, @Email, @PasswordHash, @FirstName, @LastName, @Role, @Department)
    `;
    
    const params = {
      Username: userData.Username,
      Email: userData.Email,
      PasswordHash: hashedPassword,
      FirstName: userData.FirstName,
      LastName: userData.LastName,
      Role: userData.Role || 'user',
      Department: userData.Department || null
    };
    
    const result = await executeQuery<User>(query, params);
    return result.recordset[0] as User;
  }

  /**
   * Find user by ID
   */
  static async findById(userId: number): Promise<User | null> {
    const query = `
      SELECT * FROM Users WHERE UserID = @UserID AND IsActive = 1
    `;
    
    const result = await executeQuery<User>(query, { UserID: userId });
    return (result.recordset[0] as User) || null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT * FROM Users WHERE Username = @Username AND IsActive = 1
    `;
    
    const result = await executeQuery<User>(query, { Username: username });
    return (result.recordset[0] as User) || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT * FROM Users WHERE Email = @Email AND IsActive = 1
    `;
    
    const result = await executeQuery<User>(query, { Email: email });
    return (result.recordset[0] as User) || null;
  }

  /**
   * Authenticate user
   */
  static async authenticate(credentials: LoginRequest): Promise<User | null> {
    const user = await this.findByUsername(credentials.Username);
    if (!user) {
      return null;
    }

    if (!user.PasswordHash) {
      return null; // LDAP users don't have local passwords
    }
    
    const isValidPassword = await bcrypt.compare(credentials.Password, user.PasswordHash);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  /**
   * Update user
   */
  static async update(userId: number, updateData: Partial<CreateUserRequest>): Promise<User> {
    const setClause = [];
    const params: UpdateUserParams = { UserID: userId };

    if (updateData.Username) {
      setClause.push('Username = @Username');
      params.Username = updateData.Username;
    }
    if (updateData.Email) {
      setClause.push('Email = @Email');
      params.Email = updateData.Email;
    }
    if (updateData.FirstName) {
      setClause.push('FirstName = @FirstName');
      params.FirstName = updateData.FirstName;
    }
    if (updateData.LastName) {
      setClause.push('LastName = @LastName');
      params.LastName = updateData.LastName;
    }
    if (updateData.Role) {
      setClause.push('Role = @Role');
      params.Role = updateData.Role;
    }
    if (updateData.Department !== undefined) {
      setClause.push('Department = @Department');
      params.Department = updateData.Department;
    }
    if (updateData.Password) {
      setClause.push('PasswordHash = @PasswordHash');
      params.PasswordHash = await bcrypt.hash(updateData.Password, 10);
    }

    setClause.push('UpdatedAt = GETDATE()');

    const query = `
      UPDATE Users 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE UserID = @UserID AND IsActive = 1
    `;

    const result = await executeQuery<User>(query, params);
    return result.recordset[0] as User;
  }

  /**
   * Soft delete user
   */
  static async delete(userId: number): Promise<boolean> {
    const query = `
      UPDATE Users 
      SET IsActive = 0, UpdatedAt = GETDATE()
      WHERE UserID = @UserID
    `;

    const result = await executeQuery(query, { UserID: userId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get all users with pagination
   */
  static async findAll(page: number = 1, limit: number = 10, search?: string): Promise<{ users: Omit<User, 'PasswordHash'>[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE IsActive = 1';
    const params: UserQueryParams = { Offset: offset, Limit: limit };

    if (search) {
      whereClause += ` AND (Username LIKE @Search OR Email LIKE @Search OR FirstName LIKE @Search OR LastName LIKE @Search)`;
      params.Search = `%${search}%`;
    }

    const query = `
      SELECT UserID, Username, Email, FirstName, LastName, Role, Department, IsActive, CreatedAt, UpdatedAt
      FROM Users 
      ${whereClause}
      ORDER BY CreatedAt DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) as Total FROM Users ${whereClause}
    `;

    const [usersResult, countResult] = await Promise.all([
      executeQuery<Omit<User, 'PasswordHash'>>(query, params),
      executeQuery<{ Total: number }>(countQuery, search ? { Search: params.Search } : {})
    ]);

    return {
      users: usersResult.recordset,
      total: (countResult.recordset[0] as CountResult).Total
    };
  }

  /**
   * Check if username exists
   */
  static async usernameExists(username: string, excludeUserId?: number): Promise<boolean> {
    let query = `SELECT COUNT(*) as Count FROM Users WHERE Username = @Username AND IsActive = 1`;
    const params: UsernameExistsParams = { Username: username };

    if (excludeUserId) {
      query += ` AND UserID != @ExcludeUserID`;
      params.ExcludeUserID = excludeUserId;
    }

    const result = await executeQuery<{ Count: number }>(query, params);
    return (result.recordset[0] as ExistsResult).Count > 0;
  }

  /**
   * Check if email exists
   */
  static async emailExists(email: string, excludeUserId?: number): Promise<boolean> {
    let query = `SELECT COUNT(*) as Count FROM Users WHERE Email = @Email AND IsActive = 1`;
    const params: EmailExistsParams = { Email: email };

    if (excludeUserId) {
      query += ` AND UserID != @ExcludeUserID`;
      params.ExcludeUserID = excludeUserId;
    }

    const result = await executeQuery<{ Count: number }>(query, params);
    return (result.recordset[0] as ExistsResult).Count > 0;
  }

  /**
   * Toggle user active status
   */
  static async toggleStatus(userId: number): Promise<User> {
    const query = `
      UPDATE Users 
      SET IsActive = CASE WHEN IsActive = 1 THEN 0 ELSE 1 END, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE UserID = @UserID
    `;
    
    const result = await executeQuery<User>(query, { UserID: userId });
    return result.recordset[0] as User;
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: number): Promise<void> {
    const query = `
      UPDATE Users 
      SET UpdatedAt = GETDATE() 
      WHERE UserID = @UserID
    `;
    
    await executeQuery(query, { UserID: userId });
  }
}