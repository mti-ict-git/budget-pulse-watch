import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import type { UtilizationData } from '@/services/budgetService';

interface UtilizationChartProps {
  title: string;
  data: UtilizationData[];
  expenseType: 'CAPEX' | 'OPEX';
  className?: string;
}

export function UtilizationChart({ title, data, expenseType, className }: UtilizationChartProps) {
  // Filter data by expense type
  const filteredData = data.filter(item => item.expenseType === expenseType);



  // Sort by utilization percentage (highest first)
  const sortedData = filteredData.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getUtilizationTextColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    if (percentage >= 50) return 'text-blue-600';
    return 'text-green-600';
  };

  if (sortedData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No {expenseType} data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} flex flex-col`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Budget utilization by category (spent vs allocated)
        </p>

      </CardHeader>
      <CardContent className="space-y-4 flex-1 overflow-y-auto">
        {sortedData.map((item, index) => (
          <div key={`${item.category}-${index}`} className="space-y-2 p-3 border rounded-lg bg-card/50">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate" title={item.category}>
                  {item.category}
                </h4>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
                  <span>Spent: {formatCurrency(Number(item.totalSpent) || 0)}</span>
                  <span>Budget: {formatCurrency(item.totalAllocated)}</span>
                </div>
              </div>
              <div className={`text-sm font-semibold whitespace-nowrap ${getUtilizationTextColor(item.utilizationPercentage)}`}>
                {item.utilizationPercentage.toFixed(1)}%
              </div>
            </div>
            <div className="relative">
              <Progress 
                value={Math.min(item.utilizationPercentage, 100)} 
                className="h-3"
              />
              <div 
                className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getUtilizationColor(item.utilizationPercentage)}`}
                style={{ width: `${Math.min(item.utilizationPercentage, 100)}%` }}
              />
              {item.utilizationPercentage > 100 && (
                <div className="absolute -top-1 right-0 text-xs text-red-600 font-semibold">
                  Over Budget!
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
              <span>Remaining: {formatCurrency(Math.max(0, Number(item.totalAllocated) - Number(item.totalSpent)))}</span>
              <span>{item.budgetCount} budget item{item.budgetCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
        
        {sortedData.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No {expenseType} categories found
          </div>
        )}
      </CardContent>
    </Card>
  );
}