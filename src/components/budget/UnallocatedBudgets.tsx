import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, DollarSign, FileX, Building } from 'lucide-react';
import { UnallocatedBudgetData, UnallocatedBudget } from '@/services/budgetService';

interface UnallocatedBudgetsProps {
  data: UnallocatedBudgetData | null;
  loading?: boolean;
}

const UnallocatedBudgets: React.FC<UnallocatedBudgetsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <FileX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No unallocated budget data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getReasonBadgeColor = (reasonType: string): string => {
    switch (reasonType) {
      case 'Zero Allocation':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Non-IT Department':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zero Allocation Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.zeroAllocationCount}</div>
            <p className="text-xs text-muted-foreground">
              Spent: {formatCurrency(data.summary.zeroAllocationSpent)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non-IT Departments</CardTitle>
            <Building className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.nonITCount}</div>
            <p className="text-xs text-muted-foreground">
              Budget: {formatCurrency(data.summary.nonITBudget)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Non-IT Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.summary.nonITSpent)}</div>
            <p className="text-xs text-muted-foreground">
              From non-IT departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <FileX className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Unallocated Budget Details</CardTitle>
        </CardHeader>
        <CardContent>
          {data.budgets.length === 0 ? (
            <div className="text-center py-8">
              <FileX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No unallocated budgets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cost Code</TableHead>
                    <TableHead>COA Code</TableHead>
                    <TableHead>COA Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.budgets.map((budget: UnallocatedBudget) => (
                    <TableRow key={budget.budgetId}>
                      <TableCell className="font-medium">{budget.purchaseCostCode}</TableCell>
                      <TableCell>{budget.coaCode}</TableCell>
                      <TableCell>{budget.coaName}</TableCell>
                      <TableCell>{budget.category}</TableCell>
                      <TableCell>{budget.department}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={budget.expenseType === 'OPEX' ? 'border-blue-200 text-blue-700' : 'border-green-200 text-green-700'}>
                          {budget.expenseType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(budget.allocatedAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(budget.totalSpent)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getReasonBadgeColor(budget.reasonType)}>
                          {budget.reasonType}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnallocatedBudgets;