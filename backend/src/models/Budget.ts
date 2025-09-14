import { executeQuery } from '../config/database';
import {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  BudgetQueryParams,
  BudgetSummary,
  BudgetUtilization,
  BudgetUpdateParams,
  BudgetFindAllParams,
  BudgetUtilizationParams,
  BudgetAlert,
  BudgetUtilizationSummary,
  BudgetStatistics
} from './types';

export class BudgetModel {
  /**
   * Create a new budget
   */
  static async create(budgetData: CreateBudgetRequest): Promise<Budget> {
    const query = `
      INSERT INTO Budget (
        COAID, FiscalYear, AllocatedAmount, Description, 
        Department, BudgetType, StartDate, EndDate
      )
      OUTPUT INSERTED.*
      VALUES (
        @COAID, @FiscalYear, @AllocatedAmount, @Description,
        @Department, @BudgetType, @StartDate, @EndDate
      )
    `;
    
    const params = {
      COAID: budgetData.COAID,
      FiscalYear: budgetData.FiscalYear,
      AllocatedAmount: budgetData.AllocatedAmount,
      Description: budgetData.Description || null,
      Department: budgetData.Department,
      BudgetType: budgetData.BudgetType || 'Annual',
      StartDate: budgetData.StartDate,
      EndDate: budgetData.EndDate
    };
    
    const result = await executeQuery<Budget>(query, params);
    return result.recordset[0];
  }

  /**
   * Find budget by ID
   */
  static async findById(budgetId: number): Promise<Budget | null> {
    const query = `
      SELECT * FROM Budget WHERE BudgetID = @BudgetID
    `;
    
    const result = await executeQuery<Budget>(query, { BudgetID: budgetId });
    return result.recordset[0] || null;
  }

  /**
   * Find budget by COA and fiscal year
   */
  static async findByCOAAndYear(coaId: number, fiscalYear: number): Promise<Budget | null> {
    const query = `
      SELECT * FROM Budget 
      WHERE COAID = @COAID AND FiscalYear = @FiscalYear
    `;
    
    const result = await executeQuery<Budget>(query, { COAID: coaId, FiscalYear: fiscalYear });
    return result.recordset[0] || null;
  }

  /**
   * Update budget
   */
  static async update(budgetId: number, updateData: UpdateBudgetRequest): Promise<Budget> {
    const setClause = [];
    const params: BudgetUpdateParams = { BudgetID: budgetId };

    if (updateData.AllocatedAmount !== undefined) {
      setClause.push('AllocatedAmount = @AllocatedAmount');
      params.AllocatedAmount = updateData.AllocatedAmount;
    }
    if (updateData.UtilizedAmount !== undefined) {
      setClause.push('UtilizedAmount = @UtilizedAmount');
      params.UtilizedAmount = updateData.UtilizedAmount;
    }
    if (updateData.Description !== undefined) {
      setClause.push('Description = @Description');
      params.Description = updateData.Description;
    }
    if (updateData.Department) {
      setClause.push('Department = @Department');
      params.Department = updateData.Department;
    }
    if (updateData.BudgetType) {
      setClause.push('BudgetType = @BudgetType');
      params.BudgetType = updateData.BudgetType;
    }
    if (updateData.StartDate) {
      setClause.push('StartDate = @StartDate');
      params.StartDate = updateData.StartDate;
    }
    if (updateData.EndDate) {
      setClause.push('EndDate = @EndDate');
      params.EndDate = updateData.EndDate;
    }
    if (updateData.Status) {
      setClause.push('Status = @Status');
      params.Status = updateData.Status;
    }

    setClause.push('UpdatedAt = GETDATE()');

    const query = `
      UPDATE Budget 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE BudgetID = @BudgetID
    `;

    const result = await executeQuery<Budget>(query, params);
    return result.recordset[0];
  }

  /**
   * Delete budget
   */
  static async delete(budgetId: number): Promise<boolean> {
    const query = `DELETE FROM Budget WHERE BudgetID = @BudgetID`;
    const result = await executeQuery(query, { BudgetID: budgetId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get all budgets with filtering and pagination
   */
  static async findAll(queryParams: BudgetQueryParams): Promise<{ budgets: BudgetSummary[], total: number }> {
    const {
      page = 1,
      limit = 10,
      fiscalYear,
      department,
      budgetType,
      status,
      coaId,
      search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: BudgetFindAllParams = { Offset: offset, Limit: limit };

    if (fiscalYear) {
      whereConditions.push('b.FiscalYear = @FiscalYear');
      params.FiscalYear = fiscalYear;
    }
    if (department) {
      whereConditions.push('b.Department = @Department');
      params.Department = department;
    }
    if (budgetType) {
      whereConditions.push('b.BudgetType = @BudgetType');
      params.BudgetType = budgetType;
    }
    if (status) {
      whereConditions.push('b.Status = @Status');
      params.Status = status;
    }
    if (coaId) {
      whereConditions.push('b.COAID = @COAID');
      params.COAID = coaId;
    }
    if (search) {
      whereConditions.push('(coa.AccountCode LIKE @Search OR coa.AccountName LIKE @Search OR b.Description LIKE @Search)');
      params.Search = `%${search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM vw_BudgetSummary
      ${whereClause}
      ORDER BY FiscalYear DESC, AccountCode
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) as Total 
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      ${whereClause}
    `;

    const countParams = { ...params };
    delete countParams.Offset;
    delete countParams.Limit;

    const [budgetsResult, countResult] = await Promise.all([
      executeQuery<BudgetSummary>(query, params),
      executeQuery<{ Total: number }>(countQuery, countParams)
    ]);

    return {
      budgets: budgetsResult.recordset,
      total: countResult.recordset[0].Total
    };
  }

  /**
   * Get budget utilization for a specific budget
   */
  static async getBudgetUtilization(budgetId: number): Promise<BudgetUtilization | null> {
    const query = `
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.AccountCode,
        coa.AccountName,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        COALESCE(SUM(p.ApprovedAmount), 0) as UtilizedAmount,
        b.AllocatedAmount - COALESCE(SUM(p.ApprovedAmount), 0) as RemainingAmount,
        CASE 
          WHEN b.AllocatedAmount > 0 
          THEN (COALESCE(SUM(p.ApprovedAmount), 0) * 100.0 / b.AllocatedAmount)
          ELSE 0 
        END as UtilizationPercentage,
        COUNT(p.PRFID) as TotalPRFs,
        SUM(CASE WHEN p.Status = 'Pending' THEN 1 ELSE 0 END) as PendingPRFs,
        SUM(CASE WHEN p.Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedPRFs,
        SUM(CASE WHEN p.Status = 'Completed' THEN 1 ELSE 0 END) as CompletedPRFs
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN PRF p ON b.COAID = p.COAID 
        AND p.RequestDate >= b.StartDate 
        AND p.RequestDate <= b.EndDate
        AND p.Status IN ('Approved', 'Completed')
      WHERE b.BudgetID = @BudgetID
      GROUP BY 
        b.BudgetID, b.COAID, coa.AccountCode, coa.AccountName, 
        b.FiscalYear, b.Department, b.AllocatedAmount
    `;
    
    const result = await executeQuery<BudgetUtilization>(query, { BudgetID: budgetId });
    return result.recordset[0] || null;
  }

  /**
   * Get budget utilization by department
   */
  static async getBudgetUtilizationByDepartment(department: string, fiscalYear?: number): Promise<BudgetUtilization[]> {
    const whereConditions = ['b.Department = @Department'];
    const params: BudgetUtilizationParams = { Department: department };

    if (fiscalYear) {
      whereConditions.push('b.FiscalYear = @FiscalYear');
      params.FiscalYear = fiscalYear;
    }

    const query = `
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.AccountCode,
        coa.AccountName,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        COALESCE(SUM(p.ApprovedAmount), 0) as UtilizedAmount,
        b.AllocatedAmount - COALESCE(SUM(p.ApprovedAmount), 0) as RemainingAmount,
        CASE 
          WHEN b.AllocatedAmount > 0 
          THEN (COALESCE(SUM(p.ApprovedAmount), 0) * 100.0 / b.AllocatedAmount)
          ELSE 0 
        END as UtilizationPercentage,
        COUNT(p.PRFID) as TotalPRFs,
        SUM(CASE WHEN p.Status = 'Pending' THEN 1 ELSE 0 END) as PendingPRFs,
        SUM(CASE WHEN p.Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedPRFs,
        SUM(CASE WHEN p.Status = 'Completed' THEN 1 ELSE 0 END) as CompletedPRFs
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN PRF p ON b.COAID = p.COAID 
        AND p.RequestDate >= b.StartDate 
        AND p.RequestDate <= b.EndDate
        AND p.Status IN ('Approved', 'Completed')
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY 
        b.BudgetID, b.COAID, coa.AccountCode, coa.AccountName, 
        b.FiscalYear, b.Department, b.AllocatedAmount
      ORDER BY coa.AccountCode
    `;
    
    const result = await executeQuery<BudgetUtilization>(query, params);
    return result.recordset;
  }

  /**
   * Get budget utilization summary by fiscal year
   */
  static async getBudgetUtilizationSummary(fiscalYear: number): Promise<BudgetUtilizationSummary[]> {
    const query = `
      SELECT 
        b.Department,
        COUNT(b.BudgetID) as TotalBudgets,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(COALESCE(utilized.UtilizedAmount, 0)) as TotalUtilized,
        SUM(b.AllocatedAmount) - SUM(COALESCE(utilized.UtilizedAmount, 0)) as TotalRemaining,
        CASE 
          WHEN SUM(b.AllocatedAmount) > 0 
          THEN (SUM(COALESCE(utilized.UtilizedAmount, 0)) * 100.0 / SUM(b.AllocatedAmount))
          ELSE 0 
        END as OverallUtilizationPercentage
      FROM Budget b
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(p.ApprovedAmount) as UtilizedAmount
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) utilized ON b.COAID = utilized.COAID
      WHERE b.FiscalYear = @FiscalYear
      GROUP BY b.Department
      ORDER BY b.Department
    `;
    
    const result = await executeQuery(query, { FiscalYear: fiscalYear });
    return result.recordset;
  }

  /**
   * Update budget utilization (recalculate from PRF data)
   */
  static async updateUtilization(budgetId: number): Promise<Budget> {
    const query = `
      UPDATE Budget 
      SET UtilizedAmount = (
        SELECT COALESCE(SUM(p.ApprovedAmount), 0)
        FROM PRF p
        WHERE p.COAID = Budget.COAID
          AND p.RequestDate >= Budget.StartDate
          AND p.RequestDate <= Budget.EndDate
          AND p.Status IN ('Approved', 'Completed')
      ),
      UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE BudgetID = @BudgetID
    `;

    const result = await executeQuery<Budget>(query, { BudgetID: budgetId });
    return result.recordset[0];
  }

  /**
   * Get budget alerts (over-utilized or near limit)
   */
  static async getBudgetAlerts(thresholdPercentage: number = 90): Promise<BudgetAlert[]> {
    const query = `
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.AccountCode,
        coa.AccountName,
        b.Department,
        b.FiscalYear,
        b.AllocatedAmount,
        COALESCE(utilized.UtilizedAmount, 0) as UtilizedAmount,
        CASE 
          WHEN b.AllocatedAmount > 0 
          THEN (COALESCE(utilized.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount)
          ELSE 0 
        END as UtilizationPercentage,
        CASE 
          WHEN COALESCE(utilized.UtilizedAmount, 0) > b.AllocatedAmount THEN 'Over Budget'
          WHEN (COALESCE(utilized.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount) >= @Threshold THEN 'Near Limit'
          ELSE 'Normal'
        END as AlertType
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(p.ApprovedAmount) as UtilizedAmount
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
        GROUP BY p.COAID
      ) utilized ON b.COAID = utilized.COAID
      WHERE b.Status = 'Active'
        AND (
          COALESCE(utilized.UtilizedAmount, 0) > b.AllocatedAmount
          OR (COALESCE(utilized.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount) >= @Threshold
        )
      ORDER BY UtilizationPercentage DESC
    `;
    
    const result = await executeQuery(query, { Threshold: thresholdPercentage });
    return result.recordset;
  }

  /**
   * Get budget statistics
   */
  static async getStatistics(fiscalYear?: number): Promise<BudgetStatistics> {
    const whereCondition = fiscalYear ? 'WHERE b.FiscalYear = @FiscalYear' : '';
    const params = fiscalYear ? { FiscalYear: fiscalYear } : {};

    const query = `
      SELECT 
        COUNT(b.BudgetID) as TotalBudgets,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(b.UtilizedAmount) as TotalUtilized,
        SUM(b.AllocatedAmount - b.UtilizedAmount) as TotalRemaining,
        AVG(CASE WHEN b.AllocatedAmount > 0 THEN (b.UtilizedAmount * 100.0 / b.AllocatedAmount) ELSE 0 END) as AvgUtilizationPercentage,
        COUNT(CASE WHEN b.UtilizedAmount > b.AllocatedAmount THEN 1 END) as OverBudgetCount,
        COUNT(CASE WHEN (b.UtilizedAmount * 100.0 / b.AllocatedAmount) >= 90 THEN 1 END) as NearLimitCount
      FROM Budget b
      ${whereCondition}
    `;

    const result = await executeQuery(query, params);
    return result.recordset[0];
  }
}