const { executeQuery, connectDatabase } = require('./dist/config/database');

async function checkRepairsData() {
  // Connect to database first
  await connectDatabase();
  try {
    console.log('=== UTILIZATION CHART DATA (from /api/reports/utilization) ===');
    const utilizationQuery = `
      SELECT 
        coa.Category,
        coa.ExpenseType,
        SUM(b.AllocatedAmount) as totalAllocated,
        SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as totalSpent,
        CASE 
          WHEN SUM(b.AllocatedAmount) > 0 
          THEN (SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) / SUM(b.AllocatedAmount)) * 100
          ELSE 0 
        END as utilizationPercentage,
        COUNT(DISTINCT b.BudgetID) as budgetCount
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN PRF p ON coa.COACode = p.PurchaseCostCode 
        AND p.Status IN ('Approved', 'Completed')
        AND p.BudgetYear = b.FiscalYear
      WHERE b.AllocatedAmount > 0
        AND coa.Category = 'Repairs and maintenance'
        AND coa.ExpenseType = 'OPEX'
      GROUP BY coa.Category, coa.ExpenseType
    `;
    
    const utilizationResult = await executeQuery(utilizationQuery);
    console.log('Utilization Chart Results:');
    console.log(utilizationResult.recordset);
    
    console.log('\n=== BUDGET DETAILS TABLE DATA (simplified) ===');
    const budgetQuery = `
      SELECT TOP 5
        p.PurchaseCostCode,
        coa.COACode,
        coa.COAName,
        coa.Category,
        coa.ExpenseType,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
      FROM dbo.PRF p
      LEFT JOIN ChartOfAccounts coa ON p.PurchaseCostCode = coa.COACode
      LEFT JOIN Budget b ON coa.COAID = b.COAID
      WHERE p.PurchaseCostCode IS NOT NULL 
        AND p.PurchaseCostCode != ''
        AND coa.Category = 'Repairs and maintenance'
        AND coa.ExpenseType = 'OPEX'
      GROUP BY p.PurchaseCostCode, coa.COACode, coa.COAName, coa.Category, coa.ExpenseType
      ORDER BY SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) DESC
    `;
    
    const budgetResult = await executeQuery(budgetQuery);
    console.log('Budget Details Table Results:');
    console.log(budgetResult.recordset);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRepairsData();