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

// Interface for count query results
interface CountResult {
  Total: number;
}

const itemSpendByCoaCte = `
  WITH ItemSpendByCoa AS (
    SELECT
      coa_map.COAID AS COAID,
      COALESCE(pi.BudgetYear, p.BudgetYear, YEAR(p.RequestDate)) AS FiscalYear,
      SUM(CAST(COALESCE(pi.Quantity, 0) * COALESCE(pi.UnitPrice, 0) AS DECIMAL(18,2))) AS UtilizedAmount,
      COUNT(DISTINCT p.PRFID) AS TotalPRFs,
      COUNT(DISTINCT CASE WHEN LOWER(COALESCE(p.Status, '')) LIKE '%pending%'
                           OR LOWER(COALESCE(p.Status, '')) LIKE '%approval%req%'
                          THEN p.PRFID END) AS PendingPRFs,
      COUNT(DISTINCT CASE WHEN LOWER(COALESCE(p.Status, '')) LIKE '%approved%'
                          THEN p.PRFID END) AS ApprovedPRFs,
      COUNT(DISTINCT CASE WHEN LOWER(COALESCE(p.Status, '')) LIKE '%complete%'
                          THEN p.PRFID END) AS CompletedPRFs
    FROM PRF p
    INNER JOIN PRFItems pi ON p.PRFID = pi.PRFID
    LEFT JOIN ChartOfAccounts coa_map
      ON NULLIF(LTRIM(RTRIM(pi.PurchaseCostCode)), '') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(pi.PurchaseCostCode))) = UPPER(LTRIM(RTRIM(coa_map.COACode)))
    WHERE LOWER(LTRIM(RTRIM(COALESCE(p.Status, '')))) NOT LIKE '%cancel%'
      AND LOWER(LTRIM(RTRIM(COALESCE(pi.Status, '')))) NOT LIKE '%cancel%'
    GROUP BY
      coa_map.COAID,
      COALESCE(pi.BudgetYear, p.BudgetYear, YEAR(p.RequestDate))
  )
`;

export class BudgetModel {
  /**
   * Create a new budget
   */
  static async create(budgetData: CreateBudgetRequest, createdBy: number): Promise<Budget> {
    const query = `
      INSERT INTO Budget (
        COAID, FiscalYear, AllocatedAmount, Description, 
        Department, BudgetType, ExpenseType, CurrencyCode, ExchangeRateToIDR, StartDate, EndDate, CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @COAID, @FiscalYear, @AllocatedAmount, @Description,
        @Department, @BudgetType, @ExpenseType, @CurrencyCode, @ExchangeRateToIDR, @StartDate, @EndDate, @CreatedBy
      )
    `;
    
    const params = {
      COAID: budgetData.COAID,
      FiscalYear: budgetData.FiscalYear,
      AllocatedAmount: budgetData.AllocatedAmount,
      Description: budgetData.Description || null,
      Department: budgetData.Department,
      BudgetType: budgetData.BudgetType || 'Annual',
      ExpenseType: budgetData.ExpenseType || 'OPEX',
      CurrencyCode: budgetData.CurrencyCode || 'IDR',
      ExchangeRateToIDR: budgetData.ExchangeRateToIDR && budgetData.ExchangeRateToIDR > 0 ? budgetData.ExchangeRateToIDR : 1,
      StartDate: budgetData.StartDate,
      EndDate: budgetData.EndDate,
      CreatedBy: createdBy
    };
    
    const result = await executeQuery<Budget>(query, params);
    return result.recordset[0] as Budget;
  }

  /**
   * Find budget by ID
   */
  static async findById(budgetId: number): Promise<Budget | null> {
    const query = `
      SELECT * FROM Budget WHERE BudgetID = @BudgetID
    `;
    
    const result = await executeQuery<Budget>(query, { BudgetID: budgetId });
    return (result.recordset[0] as Budget) || null;
  }

  /**
   * Find budget by COA and fiscal year
   */
  static async findByCOAAndYear(coaId: number, fiscalYear: number): Promise<Budget | null> {
    const query = `
      SELECT TOP 1 * FROM Budget 
      WHERE COAID = @COAID AND FiscalYear = @FiscalYear
      ORDER BY UpdatedAt DESC, BudgetID DESC
    `;
    
    const result = await executeQuery<Budget>(query, { COAID: coaId, FiscalYear: fiscalYear });
    return (result.recordset[0] as Budget) || null;
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
    if (updateData.ExpenseType) {
      setClause.push('ExpenseType = @ExpenseType');
      params.ExpenseType = updateData.ExpenseType;
    }
    if (updateData.CurrencyCode) {
      setClause.push('CurrencyCode = @CurrencyCode');
      params.CurrencyCode = updateData.CurrencyCode;
    }
    if (updateData.ExchangeRateToIDR !== undefined) {
      setClause.push('ExchangeRateToIDR = @ExchangeRateToIDR');
      params.ExchangeRateToIDR = updateData.ExchangeRateToIDR;
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
    return result.recordset[0] as Budget;
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
      expenseType,
      status,
      coaId,
      search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: BudgetFindAllParams = { Offset: offset, Limit: limit };

    if (fiscalYear) {
      whereConditions.push('FiscalYear = @FiscalYear');
      params.FiscalYear = fiscalYear;
    }
    if (department) {
      whereConditions.push('Department = @Department');
      params.Department = department;
    }
    if (budgetType) {
      whereConditions.push('BudgetType = @BudgetType');
      params.BudgetType = budgetType;
    }
    if (expenseType) {
      whereConditions.push('ExpenseType = @ExpenseType');
      params.ExpenseType = expenseType;
    }
    if (status) {
      whereConditions.push('Status = @Status');
      params.Status = status;
    }
    if (coaId) {
      whereConditions.push('COAID = @COAID');
      params.COAID = coaId;
    }
    if (search) {
      whereConditions.push('(AccountCode LIKE @Search OR AccountName LIKE @Search OR Category LIKE @Search OR Department LIKE @Search)');
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
      FROM vw_BudgetSummary
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
      total: (countResult.recordset[0] as CountResult).Total
    };
  }

  /**
   * Get budget utilization for a specific budget
   */
  static async getBudgetUtilization(budgetId: number): Promise<BudgetUtilization | null> {
    const query = `
      ${itemSpendByCoaCte}
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.COACode,
        coa.COAName,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        COALESCE(spend.UtilizedAmount, 0) as UtilizedAmount,
        b.AllocatedAmount - COALESCE(spend.UtilizedAmount, 0) as RemainingAmount,
        CASE 
          WHEN b.AllocatedAmount > 0 
          THEN (COALESCE(spend.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount)
          ELSE 0 
        END as UtilizationPercentage,
        COALESCE(spend.TotalPRFs, 0) as TotalPRFs,
        COALESCE(spend.PendingPRFs, 0) as PendingPRFs,
        COALESCE(spend.ApprovedPRFs, 0) as ApprovedPRFs,
        COALESCE(spend.CompletedPRFs, 0) as CompletedPRFs
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN ItemSpendByCoa spend
        ON b.COAID = spend.COAID
        AND b.FiscalYear = spend.FiscalYear
      WHERE b.BudgetID = @BudgetID
    `;
    
    const result = await executeQuery<BudgetUtilization>(query, { BudgetID: budgetId });
    return (result.recordset[0] as BudgetUtilization) || null;
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
      ${itemSpendByCoaCte}
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.COACode,
        coa.COAName,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        COALESCE(spend.UtilizedAmount, 0) as UtilizedAmount,
        b.AllocatedAmount - COALESCE(spend.UtilizedAmount, 0) as RemainingAmount,
        CASE 
          WHEN b.AllocatedAmount > 0 
          THEN (COALESCE(spend.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount)
          ELSE 0 
        END as UtilizationPercentage,
        COALESCE(spend.TotalPRFs, 0) as TotalPRFs,
        COALESCE(spend.PendingPRFs, 0) as PendingPRFs,
        COALESCE(spend.ApprovedPRFs, 0) as ApprovedPRFs,
        COALESCE(spend.CompletedPRFs, 0) as CompletedPRFs
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN ItemSpendByCoa spend
        ON b.COAID = spend.COAID
        AND b.FiscalYear = spend.FiscalYear
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY coa.COACode
    `;
    
    const result = await executeQuery<BudgetUtilization>(query, params);
    return result.recordset;
  }

  /**
   * Get budget utilization summary by fiscal year
   */
  static async getBudgetUtilizationSummary(fiscalYear: number): Promise<BudgetUtilizationSummary[]> {
    const query = `
      ${itemSpendByCoaCte}
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
      LEFT JOIN ItemSpendByCoa utilized
        ON b.COAID = utilized.COAID
        AND b.FiscalYear = utilized.FiscalYear
      WHERE b.FiscalYear = @FiscalYear
      GROUP BY b.Department
      ORDER BY b.Department
    `;
    
    const result = await executeQuery(query, { FiscalYear: fiscalYear });
    return result.recordset as BudgetUtilizationSummary[];
  }

  /**
   * Update budget utilization (recalculate from PRF data)
   */
  static async updateUtilization(budgetId: number): Promise<Budget> {
    const query = `
      ${itemSpendByCoaCte}
      UPDATE Budget 
      SET UtilizedAmount = (
        SELECT COALESCE(MAX(spend.UtilizedAmount), 0)
        FROM ItemSpendByCoa spend
        WHERE spend.COAID = Budget.COAID
          AND spend.FiscalYear = Budget.FiscalYear
      ),
      UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE BudgetID = @BudgetID
    `;

    const result = await executeQuery<Budget>(query, { BudgetID: budgetId });
    return result.recordset[0] as Budget;
  }

  /**
   * Get budget alerts (over-utilized or near limit)
   */
  static async getBudgetAlerts(thresholdPercentage: number = 90): Promise<BudgetAlert[]> {
    const query = `
      ${itemSpendByCoaCte}
      SELECT 
        b.BudgetID,
        b.COAID,
        coa.COACode,
        coa.COAName,
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
      LEFT JOIN ItemSpendByCoa utilized
        ON b.COAID = utilized.COAID
        AND b.FiscalYear = utilized.FiscalYear
      WHERE b.Status = 'Active'
        AND (
          COALESCE(utilized.UtilizedAmount, 0) > b.AllocatedAmount
          OR (COALESCE(utilized.UtilizedAmount, 0) * 100.0 / b.AllocatedAmount) >= @Threshold
        )
      ORDER BY UtilizationPercentage DESC
    `;
    
    const result = await executeQuery(query, { Threshold: thresholdPercentage });
    return result.recordset as BudgetAlert[];
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
    return result.recordset[0] as BudgetStatistics;
  }
}
