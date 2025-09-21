import { executeQuery } from '../config/database';
import { ChartOfAccounts, CreateCOARequest, UpdateCOARequest, COAQueryParams, UpdateCOAParams, COAFindAllParams, COABulkImportParams, COAAccountUsage, COAStatistics, COAExistsParams, BulkUpdateCOARequest, BulkDeleteCOARequest } from './types';

// Interface for count query results
interface CountResult {
  Total: number;
}

interface ExistsResult {
  Count: number;
}

export class ChartOfAccountsModel {
  /**
   * Create a new Chart of Accounts entry
   */
  static async create(coaData: CreateCOARequest): Promise<ChartOfAccounts> {
    const query = `
      INSERT INTO ChartOfAccounts (
        COACode, COAName, Category, ParentCOAID, 
        Description, ExpenseType, Department, IsActive
      )
      OUTPUT INSERTED.*
      VALUES (
        @COACode, @COAName, @Category, @ParentCOAID,
        @Description, @ExpenseType, @Department, @IsActive
      )
    `;
    
    const params = {
      COACode: coaData.COACode,
      COAName: coaData.COAName,
      Category: coaData.Category,
      ParentCOAID: coaData.ParentCOAID || null,
      Description: coaData.Description || null,
      ExpenseType: coaData.ExpenseType || 'OPEX',
      Department: coaData.Department || 'IT',
      IsActive: coaData.IsActive !== undefined ? coaData.IsActive : true
    };
    
    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset[0] as ChartOfAccounts;
  }

  /**
   * Find COA by ID
   */
  static async findById(coaId: number): Promise<ChartOfAccounts | null> {
    const query = `SELECT * FROM ChartOfAccounts WHERE COAID = @COAID`;
    const result = await executeQuery<ChartOfAccounts>(query, { COAID: coaId });
    return (result.recordset[0] as ChartOfAccounts) || null;
  }

  /**
   * Find COA by account code
   */
  static async findByAccountCode(accountCode: string): Promise<ChartOfAccounts | null> {
    const query = `
      SELECT * FROM ChartOfAccounts WHERE COACode = @COACode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { COACode: accountCode });
    return (result.recordset[0] as ChartOfAccounts) || null;
  }

  /**
   * Update COA
   */
  static async update(coaId: number, updateData: UpdateCOARequest): Promise<ChartOfAccounts> {
    const setClause = [];
    const params: UpdateCOAParams = { COAID: coaId };

    if (updateData.COACode) {
      setClause.push('COACode = @COACode');
      params.COACode = updateData.COACode;
    }
    if (updateData.COAName) {
      setClause.push('COAName = @COAName');
      params.COAName = updateData.COAName;
    }
    if (updateData.Category) {
      setClause.push('Category = @Category');
      params.Category = updateData.Category;
    }
    if (updateData.ParentCOAID !== undefined) {
      setClause.push('ParentCOAID = @ParentCOAID');
      params.ParentCOAID = updateData.ParentCOAID;
    }
    if (updateData.Description !== undefined) {
      setClause.push('Description = @Description');
      params.Description = updateData.Description;
    }
    if (updateData.ExpenseType) {
      setClause.push('ExpenseType = @ExpenseType');
      params.ExpenseType = updateData.ExpenseType;
    }
    if (updateData.Department) {
      setClause.push('Department = @Department');
      params.Department = updateData.Department;
    }
    if (updateData.IsActive !== undefined) {
      setClause.push('IsActive = @IsActive');
      params.IsActive = updateData.IsActive;
    }

    const query = `
      UPDATE ChartOfAccounts 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE COAID = @COAID
    `;

    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset[0] as ChartOfAccounts;
  }

  /**
   * Delete COA (soft delete by setting IsActive to false)
   */
  static async delete(coaId: number): Promise<boolean> {
    const query = `
      UPDATE ChartOfAccounts 
      SET IsActive = 0
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
      isActive = true,
      parentCOAID,
      expenseType,
      department,
      search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: COAFindAllParams = { Offset: offset, Limit: limit };

    if (isActive !== undefined) {
      whereConditions.push('IsActive = @IsActive');
      params.IsActive = isActive;
    }
    if (parentCOAID !== undefined) {
      if (parentCOAID === null) {
        whereConditions.push('ParentCOAID IS NULL');
      } else {
        whereConditions.push('ParentCOAID = @ParentCOAID');
        params.ParentCOAID = parentCOAID;
      }
    }
    if (expenseType) {
      whereConditions.push('ExpenseType = @ExpenseType');
      params.ExpenseType = expenseType;
    }
    if (department) {
      whereConditions.push('Department = @Department');
      params.Department = department;
    }
    if (search) {
      whereConditions.push('(COACode LIKE @Search OR COAName LIKE @Search OR Description LIKE @Search)');
      params.Search = `%${search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM ChartOfAccounts
      ${whereClause}
      ORDER BY COACode
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
      total: (countResult.recordset[0] as CountResult).Total
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
          COACode,
          COAName,
          Category,
          ParentCOAID,
          Description,
          IsActive,
          0 as Level,
          CAST(COACode AS VARCHAR(MAX)) as Path
        FROM ChartOfAccounts
        WHERE ParentCOAID IS NULL AND IsActive = 1
        
        UNION ALL
        
        -- Child accounts
        SELECT 
          c.COAID,
          c.COACode,
          c.COAName,
          c.Category,
          c.ParentCOAID,
          c.Description,
          c.IsActive,
          h.Level + 1,
          h.Path + ' > ' + c.COACode
        FROM ChartOfAccounts c
        INNER JOIN COAHierarchy h ON c.ParentCOAID = h.COAID
        WHERE c.IsActive = 1
      )
      SELECT * FROM COAHierarchy
      ORDER BY Path
    `;
    
    const result = await executeQuery(query);
    return result.recordset as Record<string, unknown>[];
  }

  /**
   * Get child accounts of a parent account
   */
  static async getChildAccounts(parentAccountId: number): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE ParentCOAID = @ParentCOAID AND IsActive = 1
      ORDER BY COACode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { ParentCOAID: parentAccountId });
    return result.recordset;
  }

  /**
   * Get root accounts (accounts with no parent)
   */
  static async getRootAccounts(): Promise<ChartOfAccounts[]> {
    const query = `
      SELECT * FROM ChartOfAccounts 
      WHERE ParentCOAID IS NULL AND IsActive = 1
      ORDER BY COACode
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
      WHERE Category = @Category AND IsActive = 1
      ORDER BY COACode
    `;
    
    const result = await executeQuery<ChartOfAccounts>(query, { Category: accountType });
    return result.recordset;
  }



  /**
   * Check if account code exists
   */
  static async accountCodeExists(coaCode: string, excludeId?: number): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as Count FROM ChartOfAccounts 
      WHERE COACode = @COACode
    `;
    const params: COAExistsParams = { COACode: coaCode };

    if (excludeId) {
      query += ' AND COAID != @ExcludeID';
      params.ExcludeID = excludeId;
    }
    
    const result = await executeQuery<{ Count: number }>(query, params);
    return (result.recordset[0] as ExistsResult).Count > 0;
  }

  /**
   * Get account usage statistics (how many PRFs and budgets use this account)
   */
  static async getAccountUsage(coaId: number): Promise<COAAccountUsage> {
    const query = `
      SELECT 
        coa.COAID,
        coa.COACode,
        coa.COAName,
        COUNT(DISTINCT p.PRFID) as PRFCount,
        COUNT(DISTINCT b.BudgetID) as BudgetCount,
        SUM(CASE WHEN p.Status IN ('Approved', 'Completed') THEN COALESCE(p.ApprovedAmount, p.RequestedAmount) ELSE 0 END) as TotalPRFAmount,
        SUM(b.AllocatedAmount) as TotalBudgetAmount
      FROM ChartOfAccounts coa
      LEFT JOIN PRF p ON coa.COAID = p.COAID
      LEFT JOIN Budget b ON coa.COAID = b.COAID
      WHERE coa.COAID = @COAID
      GROUP BY coa.COAID, coa.COACode, coa.COAName
    `;
    
    const result = await executeQuery(query, { COAID: coaId });
    return result.recordset[0] as COAAccountUsage;
  }

  /**
   * Bulk import COA data
   */
  static async bulkImport(accounts: CreateCOARequest[]): Promise<ChartOfAccounts[]> {
    const insertValues = accounts.map((_, index) => 
      `(@COACode${index}, @COAName${index}, @Category${index}, @ParentCOAID${index}, @Description${index}, @IsActive${index})`
    ).join(', ');

    const params: COABulkImportParams = {};
    accounts.forEach((account, index) => {
      params[`COACode${index}`] = account.COACode;
      params[`COAName${index}`] = account.COAName;
      params[`Category${index}`] = account.Category || null;
      params[`ParentCOAID${index}`] = account.ParentCOAID || null;
      params[`Description${index}`] = account.Description || null;
      params[`IsActive${index}`] = account.IsActive !== undefined ? account.IsActive : true;
    });

    const query = `
      INSERT INTO ChartOfAccounts (
        COACode, COAName, Category, ParentCOAID, 
        Description, IsActive
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
        COUNT(CASE WHEN ParentCOAID IS NULL THEN 1 END) as RootAccounts,
        COUNT(DISTINCT Category) as Categories,
        0 as Departments
      FROM ChartOfAccounts
    `;

    const result = await executeQuery(query);
    return result.recordset[0] as COAStatistics;
  }

  /**
   * Bulk update multiple COA records
   */
  static async bulkUpdate(bulkData: BulkUpdateCOARequest): Promise<ChartOfAccounts[]> {
    const { accountIds, updates } = bulkData;
    
    if (accountIds.length === 0) {
      return [];
    }

    // Build dynamic SET clause based on provided updates
    const setClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (updates.Department !== undefined) {
      setClauses.push('Department = @Department');
      params.Department = updates.Department;
    }
    if (updates.ExpenseType !== undefined) {
      setClauses.push('ExpenseType = @ExpenseType');
      params.ExpenseType = updates.ExpenseType;
    }
    if (updates.Category !== undefined) {
      setClauses.push('Category = @Category');
      params.Category = updates.Category;
    }
    if (updates.IsActive !== undefined) {
      setClauses.push('IsActive = @IsActive');
      params.IsActive = updates.IsActive;
    }

    if (setClauses.length === 0) {
      throw new Error('No updates provided');
    }

    // Create placeholders for account IDs
    const idPlaceholders = accountIds.map((_, index) => `@id${index}`).join(', ');
    accountIds.forEach((id, index) => {
      params[`id${index}`] = id;
    });

    const query = `
      UPDATE ChartOfAccounts 
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE COAID IN (${idPlaceholders})
    `;

    // Debug logging
    console.log('Bulk update SQL query:', query);
    console.log('Bulk update parameters:', params);
    console.log('Account IDs:', accountIds);

    const result = await executeQuery<ChartOfAccounts>(query, params);
    return result.recordset;
  }

  /**
   * Bulk delete multiple COA records
   */
  static async bulkDelete(bulkData: BulkDeleteCOARequest): Promise<number> {
    const { accountIds, hard = false } = bulkData;
    
    if (accountIds.length === 0) {
      return 0;
    }

    // Create placeholders for account IDs
    const idPlaceholders = accountIds.map((_, index) => `@id${index}`).join(', ');
    const params: Record<string, unknown> = {};
    accountIds.forEach((id, index) => {
      params[`id${index}`] = id;
    });

    let query: string;
    if (hard) {
      // Hard delete - permanently remove records
      query = `
        DELETE FROM ChartOfAccounts 
        WHERE COAID IN (${idPlaceholders})
      `;
    } else {
      // Soft delete - set IsActive to false
      query = `
        UPDATE ChartOfAccounts 
        SET IsActive = 0
        WHERE COAID IN (${idPlaceholders})
      `;
    }

    const result = await executeQuery(query, params);
    return result.rowsAffected[0] || 0;
  }
}