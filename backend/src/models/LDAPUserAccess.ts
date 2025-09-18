import { executeQuery } from '../config/database';

export interface LDAPUserAccess {
  AccessID: number;
  Username: string;
  Email: string;
  DisplayName: string;
  Department?: string;
  Role: 'admin' | 'doccon' | 'user';
  IsActive: boolean;
  GrantedBy: number;
  GrantedAt: Date;
  LastLogin?: Date;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CreateLDAPAccessRequest {
  Username: string;
  Email: string;
  DisplayName: string;
  Department?: string;
  Role: 'admin' | 'doccon' | 'user';
  GrantedBy: number;
}

export interface UpdateLDAPAccessRequest {
  Role?: 'admin' | 'doccon' | 'user';
  Department?: string;
  IsActive?: boolean;
}

export class LDAPUserAccessModel {
  /**
   * Grant access to an LDAP user
   */
  static async grantAccess(accessData: CreateLDAPAccessRequest): Promise<LDAPUserAccess> {
    const query = `
      INSERT INTO LDAPUserAccess (Username, Email, DisplayName, Department, Role, IsActive, GrantedBy)
      OUTPUT INSERTED.*
      VALUES (@Username, @Email, @DisplayName, @Department, @Role, 1, @GrantedBy)
    `;
    
    const params = {
      Username: accessData.Username,
      Email: accessData.Email,
      DisplayName: accessData.DisplayName,
      Department: accessData.Department || null,
      Role: accessData.Role,
      GrantedBy: accessData.GrantedBy
    };
    
    const result = await executeQuery<LDAPUserAccess>(query, params);
    return result.recordset[0] as LDAPUserAccess;
  }

  /**
   * Check if user has access
   */
  static async hasAccess(username: string): Promise<LDAPUserAccess | null> {
    const query = `
      SELECT * FROM LDAPUserAccess 
      WHERE Username = @Username AND IsActive = 1
    `;
    
    const result = await executeQuery<LDAPUserAccess>(query, { Username: username });
    return (result.recordset[0] as LDAPUserAccess) || null;
  }

  /**
   * Check if user has access by email
   */
  static async hasAccessByEmail(email: string): Promise<LDAPUserAccess | null> {
    const query = `
      SELECT * FROM LDAPUserAccess 
      WHERE Email = @Email AND IsActive = 1
    `;
    
    const result = await executeQuery<LDAPUserAccess>(query, { Email: email });
    return (result.recordset[0] as LDAPUserAccess) || null;
  }

  /**
   * Update user access
   */
  static async updateAccess(username: string, updateData: UpdateLDAPAccessRequest): Promise<LDAPUserAccess> {
    const setParts: string[] = [];
    const params: Record<string, unknown> = { Username: username };
    
    if (updateData.Role !== undefined) {
      setParts.push('Role = @Role');
      params.Role = updateData.Role;
    }
    
    if (updateData.Department !== undefined) {
      setParts.push('Department = @Department');
      params.Department = updateData.Department;
    }
    
    if (updateData.IsActive !== undefined) {
      setParts.push('IsActive = @IsActive');
      params.IsActive = updateData.IsActive;
    }
    
    setParts.push('UpdatedAt = GETDATE()');
    
    const query = `
      UPDATE LDAPUserAccess 
      SET ${setParts.join(', ')}
      OUTPUT INSERTED.*
      WHERE Username = @Username
    `;
    
    const result = await executeQuery<LDAPUserAccess>(query, params);
    return result.recordset[0] as LDAPUserAccess;
  }

  /**
   * Revoke user access
   */
  static async revokeAccess(username: string): Promise<boolean> {
    const query = `
      UPDATE LDAPUserAccess 
      SET IsActive = 0, UpdatedAt = GETDATE()
      WHERE Username = @Username
    `;
    
    const result = await executeQuery(query, { Username: username });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Update last login time
   */
  static async updateLastLogin(username: string): Promise<void> {
    const query = `
      UPDATE LDAPUserAccess 
      SET LastLogin = GETDATE(), UpdatedAt = GETDATE()
      WHERE Username = @Username AND IsActive = 1
    `;
    
    await executeQuery(query, { Username: username });
  }

  /**
   * Get all users with access
   */
  static async findAll(page: number = 1, limit: number = 10, search?: string): Promise<{ users: LDAPUserAccess[], total: number }> {
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params: Record<string, unknown> = {
      Offset: offset,
      Limit: limit
    };
    
    if (search) {
      whereClause += ` AND (Username LIKE @Search OR DisplayName LIKE @Search OR Email LIKE @Search OR Department LIKE @Search)`;
      params.Search = `%${search}%`;
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as Total FROM LDAPUserAccess ${whereClause}
    `;
    
    const countResult = await executeQuery<{ Total: number }>(countQuery, params);
    const total = countResult.recordset[0].Total;
    
    // Get users
    const query = `
      SELECT * FROM LDAPUserAccess 
      ${whereClause}
      ORDER BY CreatedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;
    
    const result = await executeQuery<LDAPUserAccess>(query, params);
    
    return {
      users: result.recordset as LDAPUserAccess[],
      total
    };
  }

  /**
   * Get user by username
   */
  static async findByUsername(username: string): Promise<LDAPUserAccess | null> {
    const query = `
      SELECT * FROM LDAPUserAccess WHERE Username = @Username
    `;
    
    const result = await executeQuery<LDAPUserAccess>(query, { Username: username });
    return (result.recordset[0] as LDAPUserAccess) || null;
  }

  /**
   * Check if email already has access
   */
  static async emailExists(email: string, excludeUsername?: string): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as Count FROM LDAPUserAccess WHERE Email = @Email
    `;
    
    const params: Record<string, unknown> = { Email: email };
    
    if (excludeUsername) {
      query += ` AND Username != @ExcludeUsername`;
      params.ExcludeUsername = excludeUsername;
    }
    
    const result = await executeQuery<{ Count: number }>(query, params);
    return result.recordset[0].Count > 0;
  }

  /**
   * Get access statistics
   */
  static async getStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    adminUsers: number;
    docconUsers: number;
    regularUsers: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as TotalUsers,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as ActiveUsers,
        SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) as InactiveUsers,
        SUM(CASE WHEN Role = 'admin' AND IsActive = 1 THEN 1 ELSE 0 END) as AdminUsers,
        SUM(CASE WHEN Role = 'doccon' AND IsActive = 1 THEN 1 ELSE 0 END) as DocconUsers,
        SUM(CASE WHEN Role = 'user' AND IsActive = 1 THEN 1 ELSE 0 END) as RegularUsers
      FROM LDAPUserAccess
    `;
    
    const result = await executeQuery<{
      TotalUsers: number;
      ActiveUsers: number;
      InactiveUsers: number;
      AdminUsers: number;
      DocconUsers: number;
      RegularUsers: number;
    }>(query);
    
    const stats = result.recordset[0];
    
    return {
      totalUsers: stats.TotalUsers,
      activeUsers: stats.ActiveUsers,
      inactiveUsers: stats.InactiveUsers,
      adminUsers: stats.AdminUsers,
      docconUsers: stats.DocconUsers,
      regularUsers: stats.RegularUsers
    };
  }
}

export default LDAPUserAccessModel;