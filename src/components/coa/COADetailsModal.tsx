import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ExternalLink, TrendingUp, FileText, Wallet } from 'lucide-react';
import { coaService, ChartOfAccounts, COAAccountUsage } from '@/services/coaService';
import { useToast } from '@/hooks/use-toast';

interface COADetailsModalProps {
  account: ChartOfAccounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function COADetailsModal({ account, open, onOpenChange }: COADetailsModalProps) {
  const [usage, setUsage] = useState<COAAccountUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [parentAccount, setParentAccount] = useState<ChartOfAccounts | null>(null);
  const { toast } = useToast();

  // Fetch account usage statistics
  useEffect(() => {
    if (open && account) {
      fetchAccountUsage();
      fetchParentAccount();
    }
  }, [open, account]);

  const fetchAccountUsage = async () => {
    setLoadingUsage(true);
    try {
      const response = await coaService.getAccountUsage(account.COAID);
      if (response.success && response.data) {
        setUsage(response.data);
      } else {
        toast({
          title: 'Warning',
          description: 'Could not fetch account usage statistics',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching account usage:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const fetchParentAccount = async () => {
    if (account.ParentCOAID) {
      try {
        const response = await coaService.getById(account.ParentCOAID);
        if (response.success && response.data) {
          setParentAccount(response.data);
        }
      } catch (error) {
        console.error('Error fetching parent account:', error);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{account.COACode} - {account.COAName}</span>
            <Badge variant={account.IsActive ? 'default' : 'destructive'}>
              {account.IsActive ? 'Active' : 'Inactive'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detailed information and usage statistics for this account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Code</label>
                  <p className="text-sm font-mono">{account.COACode}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Name</label>
                  <p className="text-sm">{account.COAName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p className="text-sm">{account.Category || 'No category'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expense Type</label>
                  <Badge variant={account.ExpenseType === 'CAPEX' ? 'default' : 'secondary'}>
                    {account.ExpenseType}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                  <p className="text-sm">{account.Department}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created Date</label>
                  <p className="text-sm">{formatDate(account.CreatedAt)}</p>
                </div>
              </div>

              {account.Description && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm mt-1">{account.Description}</p>
                  </div>
                </>
              )}

              {parentAccount && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Parent Account</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-mono">{parentAccount.COACode}</span>
                      <span className="text-sm">-</span>
                      <span className="text-sm">{parentAccount.COAName}</span>
                      <Badge variant="outline" className="text-xs">
                        {parentAccount.ExpenseType}
                      </Badge>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Statistics
              </CardTitle>
              <CardDescription>
                How this account is being used across the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsage ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading usage statistics...</p>
                </div>
              ) : usage ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="h-8 w-8 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">{usage.PRFCount}</div>
                    <div className="text-sm text-muted-foreground">PRFs Using</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Wallet className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">{usage.BudgetCount}</div>
                    <div className="text-sm text-muted-foreground">Budget Entries</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(usage.TotalPRFAmount)}</div>
                    <div className="text-sm text-muted-foreground">Total PRF Amount</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Wallet className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(usage.TotalBudgetAmount)}</div>
                    <div className="text-sm text-muted-foreground">Total Budget Amount</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No usage statistics available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Hierarchy */}
          {account.ParentCOAID && (
            <Card>
              <CardHeader>
                <CardTitle>Account Hierarchy</CardTitle>
                <CardDescription>
                  This account's position in the chart of accounts structure
                </CardDescription>
              </CardHeader>
              <CardContent>
                {parentAccount ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Parent:</span>
                    <span className="font-mono text-sm">{parentAccount.COACode}</span>
                    <span className="text-sm">-</span>
                    <span className="text-sm">{parentAccount.COAName}</span>
                    <Badge variant="outline" className="text-xs">
                      {parentAccount.ExpenseType}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Loading parent account information...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Related PRFs
                </Button>
                <Button variant="outline" size="sm">
                  <Wallet className="mr-2 h-4 w-4" />
                  View Budget Entries
                </Button>
                <Button variant="outline" size="sm">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}