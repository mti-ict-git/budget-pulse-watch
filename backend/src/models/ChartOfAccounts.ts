import { executeQuery } from '../config/database';
import { ChartOfAccounts, CreateCOARequest, UpdateCOARequest, COAQueryParams, UpdateCOAParams, COAFindAllParams, COABulkImportParams, COAAccountUsage, COAStatistics, COAExistsParams } from './types';

export class ChartOfAccountsModel {
  /**
   * Create a new Chart of Accounts entry
   */
  static async create(coaData: CreateCOARequest): Promise<ChartOfAccounts> {
    const query = `
      INSERT INTO ChartOfAccounts (
        AccountCode, AccountName, AccountType, ParentAccountID, 
        Description, IsActive, Department
      )
      OUTPUT INSERTED.*
      VALUES (
        @AccountCode, @AccountName, @AccountType, @ParentAccountID,
        @Description, @IsActive, @Department
      )
    `;
    
    const params = {
      AccountCode: coaData.AccountCode,
      AccountName: coaData.AccountName,
      AccountType: coaData.AccountType,
      ParentAccountID: coaData.ParentAccountID || null,
      Description: coaData.Description || null,
      IsActive: coaData.IsActive !== undefined ? coaData.IsActive : true,
      Department: coaData.Department || null
    };
    
    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset[0];
  }

  /**
   * Find COA by ID
   */
  static async findById(coaId: number): Promise<ChartOfAccounts | null> {
    const query = `
      SELECT * FROM ChartOfAccounts WHERE COAID = @COAID
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { COAID: coaId });
    return result.recordset[0] || null;
  }

  /**
   * Find COA by account code
   */
  static async findByAccountCode(accountCode: string): Promise<ChartOfAccounts | null> {
    const query = `
      SELECT * FROM ChartOfAccounts WHERE AccountCode = @AccountCode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { AccountCode: accountCode });
    return result.recordset[0] || null;
  }

  /**
   * Update COA
   */
  static async update(coaId: number, updateData: UpdateCOARequest): Promise<ChartOfAccounts> {
    const setClause = [];
    const params: UpdateCOAParams = { COAID: coaId };

    if (updateData.AccountCode) {
      setClause.push('AccountCode = @AccountCode');
      params.AccountCode = updateData.AccountCode;
    }
    if (updateData.AccountName) {
      setClause.push('AccountName = @AccountName');
      params.AccountName = updateData.AccountName;
    }
    if (updateData.AccountType) {
      setClause.push('AccountType = @AccountType');
      params.AccountType = updateData.AccountType;
    }
    if (updateData.ParentAccountID !== undefined) {
      setClause.push('ParentAccountID = @ParentAccountID');
      params.ParentAccountID = updateData.ParentAccountID;
    }
    if (updateData.Description !== undefined) {
      setClause.push('Description = @Description');
      params.Description = updateData.Description;
    }
    if (updateData.IsActive !== undefined) {
      setClause.push('IsActive = @IsActive');
      params.IsActive = updateData.IsActive;
    }
    if (updateData.Department !== undefined) {
      setClause.push('Department = @Department');
      params.Department = updateData.Department;
    }

    setClause.push('UpdatedAt = GETDATE()');

    const query = `
      UPDATE ChartOfAccounts 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE COAID = @COAID
    `;

    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset[0];
  }

  /**
   * Delete COA (soft delete by setting IsActive to false)
   */
  static async delete(coaId: number): Promise<boolean> {
    const query = `
      UPDATE ChartOfAccounts 
      SET IsActive = 0, UpdatedAt = GETDATE()
      WHERE COAID = @COAID
    `;
    const result = await executeQuery(query, { COAID: coaId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Hard delete COA (permanent deletion)
   */
  static async hardDelete(coaId: number): Promise<boolean> {
    const query = `DELETE FROM ChartOfAccounts WHERE COAID = @COAID`;
    const result = await executeQuery(query, { COAID: coaId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get all COAs with filtering and pagination
   */
  static async findAll(queryParams: COAQueryParams): Promise<{ accounts: ChartOfAccounts[], total: number }> {
    const {
      page = 1,
      limit = 10,
      accountType,
      department,
      isActive = true,
      parentAccountId,
      search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: COAFindAllParams = { Offset: offset, Limit: limit };

    if (accountType) {
      whereConditions.push('AccountType = @AccountType');
      params.AccountType = accountType;
    }
    if (department) {
      whereConditions.push('Department = @Department');
      params.Department = department;
    }
    if (isActive !== undefined) {
      whereConditions.push('IsActive = @IsActive');
      params.IsActive = isActive;
    }
    if (parentAccountId !== undefined) {
      if (parentAccountId === null) {
        whereConditions.push('ParentAccountID IS NULL');
      } else {
        whereConditions.push('ParentAccountID = @ParentAccountID');
        params.ParentAccountID = parentAccountId;
      }
    }
    if (search) {
      whereConditions.push('(AccountCode LIKE @Search OR AccountName LIKE @Search OR Description LIKE @Search)');
      params.Search = `%${search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM ChartOfAccounts
      ${whereClause}
      ORDER BY AccountCode
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) as Total 
      FROM ChartOfAccounts
      ${whereClause}
    `;

    const countParams = { ...params };
    delete countParams.Offset;
    delete countParams.Limit;

    const [accountsResult, countResult] = await Promise.all([
      executeQuery<ChartOfAccounts>(query, params),
      executeQuery<{ Total: number }>(countQuery, countParams)
    ]);

    return {
      accounts: accountsResult.recordset,
      total: countResult.recordset[0].Total
    };
  }

  /**
   * Get COA hierarchy (parent-child relationships)
   */
  static async getHierarchy(): Promise<Record<string, unknown>[]> {
    const query = `
      WITH COAHierarchy AS (
        -- Root level accounts (no parent)
        SELECT 
          COAID,
          AccountCode,
          AccountName,
          AccountType,
          ParentAccountID,
          Description,
          IsActive,
          Department,
          0 as Level,
          CAST(AccountCode AS VARCHAR(MAX)) as Path
        FROM ChartOfAccounts
        WHERE ParentAccountID IS NULL AND IsActive = 1
        
        UNION ALL
        
        -- Child accounts
        SELECT 
          c.COAID,
          c.AccountCode,
          c.AccountName,
          c.AccountType,
          c.ParentAccountID,
          c.Description,
          c.IsActive,
          c.Department,
          h.Level + 1,
          h.Path + ' > ' + c.AccountCode
        FROM ChartOfAccounts c
        INNER JOIN COAHierarchy h ON c.ParentAccountID = h.COAID
        WHERE c.IsActive = 1
      )
      SELECT * FROM COAHierarchy
      ORDER BY Path
    `;
    
    const result = await executeQuery(query);
    return result.recordset;
  }

  /**
   * Get child accounts of a parent account
   */
  static async getChildAccounts(parentAccountId: number): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE ParentAccountID = @ParentAccountID AND IsActive = 1
      ORDER BY AccountCode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { ParentAccountID: parentAccountId });
    return result.recordset;
  }

  /**
   * Get root accounts (accounts with no parent)
   */
  static async getRootAccounts(): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE ParentAccountID IS NULL AND IsActive = 1
      ORDER BY AccountCode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query);
    return result.recordset;
  }

  /**
   * Get accounts by type
   */
  static async getAccountsByType(accountType: string): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE AccountType = @AccountType AND IsActive = 1
      ORDER BY AccountCode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { AccountType: accountType });
    return result.recordset;
  }

  /**
   * Get accounts by department
   */
  static async getAccountsByDepartment(department: string): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE Department = @Department AND IsActive = 1
      ORDER BY AccountCode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { Department: department });
    return result.recordset;
  }

  /**
   * Check if account code exists
   */
  static async accountCodeExists(accountCode: string, excludeId?: number): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as Count FROM ChartOfAccounts 
      WHERE AccountCode = @AccountCode
    `;
    const params: COAExistsParams = { AccountCode: accountCode };

    if (excludeId) {
      query += ' AND COAID != @ExcludeID';
      params.ExcludeID = excludeId;
    }
    
    const result = await executeQuery<{ Count: number }>(query, params);
    return result.recordset[0].Count > 0;
  }

  /**
   * Get account usage statistics (how many PRFs and budgets use this account)
   */
  static async getAccountUsage(coaId: number): Promise<COAAccountUsage> {
    const query = `
      SELECT 
        coa.COAID,
        coa.AccountCode,
        coa.AccountName,
        COUNT(DISTINCT p.PRFID) as PRFCount,
        COUNT(DISTINCT b.BudgetID) as BudgetCount,
        SUM(CASE WHEN p.Status IN ('Approved', 'Completed') THEN p.ApprovedAmount ELSE 0 END) as TotalPRFAmount,
        SUM(b.AllocatedAmount) as TotalBudgetAmount
      FROM ChartOfAccounts coa
      LEFT JOIN PRF p ON coa.COAID = p.COAID
      LEFT JOIN Budget b ON coa.COAID = b.COAID
      WHERE coa.COAID = @COAID
      GROUP BY coa.COAID, coa.AccountCode, coa.AccountName
    `;
    
    const result = await executeQuery(query, { COAID: coaId });
    return result.recordset[0];
  }

  /**
   * Bulk import COA data
   */
  static async bulkImport(accounts: CreateCOARequest[]): Promise<ChartOfAccounts[]> {
    const insertValues = accounts.map((_, index) => 
      `(@AccountCode${index}, @AccountName${index}, @AccountType${index}, @ParentAccountID${index}, @Description${index}, @IsActive${index}, @Department${index})`
    ).join(', ');

    const params: COABulkImportParams = {};
    accounts.forEach((account, index) => {
      params[`AccountCode${index}`] = account.AccountCode;
      params[`AccountName${index}`] = account.AccountName;
      params[`AccountType${index}`] = account.AccountType || null;
      params[`ParentAccountID${index}`] = account.ParentAccountID || null;
      params[`Description${index}`] = account.Description || null;
      params[`IsActive${index}`] = account.IsActive !== undefined ? account.IsActive : true;
      params[`Department${index}`] = account.Department || null;
    });

    const query = `
      INSERT INTO ChartOfAccounts (
        AccountCode, AccountName, AccountType, ParentAccountID, 
        Description, IsActive, Department
      )
      OUTPUT INSERTED.*
      VALUES ${insertValues}
    `;

    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset;
  }

  /**
   * Get COA statistics
   */
  static async getStatistics(): Promise<COAStatistics> {
    const query = `
      SELECT 
        COUNT(*) as TotalAccounts,
        COUNT(CASE WHEN IsActive = 1 THEN 1 END) as ActiveAccounts,
        COUNT(CASE WHEN IsActive = 0 THEN 1 END) as InactiveAccounts,
        COUNT(CASE WHEN ParentAccountID IS NULL THEN 1 END) as RootAccounts,
        COUNT(DISTINCT AccountType) as AccountTypes,
        COUNT(DISTINCT Department) as Departments
      FROM ChartOfAccounts
    `;

    const result = await executeQuery(query);
    return result.recordset[0];
  }
}