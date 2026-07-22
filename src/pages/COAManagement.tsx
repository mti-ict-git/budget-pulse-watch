import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Download, Users, Building, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { coaService, ChartOfAccounts, COAQueryParams, BulkUpdateCOARequest, BulkDeleteCOARequest, CoaCoverageStatus } from '../services/coaService';
import { COAForm } from '@/components/coa/COAForm';
import { COADetailsModal } from '@/components/coa/COADetailsModal';

const CURRENT_FISCAL_YEAR = new Date().getFullYear();

const MANDATORY_HR_IT_OPEX_LABELS: Record<string, string> = {
  MTIRMRAD496137: 'Software Maintenance',
  MTIRMRAD496232: 'Repairs and maintenance',
  MTIRMRAD496769: 'Tools',
  MTIRMRAD496250: 'IT consumeables',
  MTIRMRAD496313: 'Internet',
  MTIRMRAD496315: 'Stationery and postage',
  MTIRMRAD496326: 'Other permit & licenses',
  MTIRMRAD496328: 'Subscriptions',
  MTIRMRAD496014: 'Training and seminars',
  MTIRMRAD496314: 'Telephone and mobile comms'
};

const getMandatoryApprovedName = (coaCode: string): string | undefined => MANDATORY_HR_IT_OPEX_LABELS[coaCode];

export default function COAManagement() {
  const [accounts, setAccounts] = useState<ChartOfAccounts[]>([]);
  const [mandatoryCoverage, setMandatoryCoverage] = useState<Record<number, CoaCoverageStatus>>({});
  const [loading, setLoading] = useState(true);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedExpenseType, setSelectedExpenseType] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [governanceScope, setGovernanceScope] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccounts | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Bulk selection state
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDepartment, setBulkDepartment] = useState<string>('');
  const [bulkExpenseType, setBulkExpenseType] = useState<string>('');
  
  const { toast } = useToast();

  const isMandatoryAccount = (account: ChartOfAccounts) => getMandatoryApprovedName(account.COACode) !== undefined;
  const isProtectedMandatoryAccount = (account: ChartOfAccounts) => isMandatoryAccount(account);
  const getCoverage = (account: ChartOfAccounts) => mandatoryCoverage[account.COAID];
  const hasApprovedNameMismatch = (account: ChartOfAccounts) => {
    const approvedName = getMandatoryApprovedName(account.COACode);
    return approvedName !== undefined && approvedName !== account.COAName;
  };
  const protectedAccountsOnPage = accounts.filter(isProtectedMandatoryAccount);
  const mandatoryReadyCount = protectedAccountsOnPage.filter((account) => getCoverage(account)?.readinessStatus === 'Budget Ready').length;
  const mandatoryAttentionCount = protectedAccountsOnPage.filter((account) => getCoverage(account)?.needsAttention).length;
  const mandatoryCarryForwardCount = protectedAccountsOnPage.filter((account) => getCoverage(account)?.readinessStatus === 'Carry Forward Applied').length;

  // Fetch accounts with current filters
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: COAQueryParams = {
        page: currentPage,
        limit: pageSize,
        isActive: showActiveOnly,
        search: searchTerm || undefined,
        category: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined,
        expenseType: governanceScope === 'mandatory-hr-it-opex'
          ? 'OPEX'
          : selectedExpenseType && selectedExpenseType !== 'all'
            ? (selectedExpenseType as 'CAPEX' | 'OPEX')
            : undefined,
        department: governanceScope === 'mandatory-hr-it-opex'
          ? 'HR / IT'
          : selectedDepartment && selectedDepartment !== 'all'
            ? selectedDepartment
            : undefined,
      };

      const response = await coaService.getAll(params);
      
      if (response.success && response.data) {
        setAccounts(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotalAccounts(response.pagination.total);
        }
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to fetch accounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    showActiveOnly,
    searchTerm,
    selectedCategory,
    selectedExpenseType,
    selectedDepartment,
    governanceScope,
    toast
  ]);

  const fetchMandatoryCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try {
      const response = await coaService.getMandatoryReadiness(CURRENT_FISCAL_YEAR);
      if (response.success && response.data) {
        setMandatoryCoverage(response.data);
      } else {
        setMandatoryCoverage({});
      }
    } catch (error) {
      setMandatoryCoverage({});
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  // Effect to fetch accounts when filters change
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchMandatoryCoverage();
  }, [fetchMandatoryCoverage]);

  // Handle page size change
  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Handle account deletion
  const handleDelete = async (account: ChartOfAccounts) => {
    try {
      const response = await coaService.delete(account.COAID);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Account deactivated successfully',
        });
        fetchAccounts();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to deactivate account',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate account',
        variant: 'destructive',
      });
    }
  };

  // Handle account creation/update success
  const handleAccountSuccess = () => {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    setSelectedAccount(null);
    fetchAccounts();
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allAccountIds = new Set(
        accounts
          .filter((account) => !isProtectedMandatoryAccount(account))
          .map((account) => account.COAID)
      );
      setSelectedAccounts(allAccountIds);
    } else {
      setSelectedAccounts(new Set());
    }
  };

  const handleSelectAccount = (accountId: number, checked: boolean) => {
    const newSelected = new Set(selectedAccounts);
    if (checked) {
      newSelected.add(accountId);
    } else {
      newSelected.delete(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const clearSelection = () => {
    setSelectedAccounts(new Set());
    setShowBulkActions(false);
  };

  // Show/hide bulk actions based on selection
  useEffect(() => {
    setShowBulkActions(selectedAccounts.size > 0);
  }, [selectedAccounts]);

  // Bulk operation handlers
  const handleBulkUpdate = async () => {
    if (selectedAccounts.size === 0) return;

    setBulkActionLoading(true);
    try {
      const updates: BulkUpdateCOARequest['updates'] = {};
      
      if (bulkDepartment) {
        updates.Department = bulkDepartment;
      }
      if (bulkExpenseType) {
        updates.ExpenseType = bulkExpenseType as 'CAPEX' | 'OPEX';
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: 'Warning',
          description: 'Please select at least one field to update',
          variant: 'destructive',
        });
        return;
      }

      const bulkData: BulkUpdateCOARequest = {
        accountIds: Array.from(selectedAccounts),
        updates,
      };

      // Debug logging
      console.log('Bulk update request payload:', {
        accountIds: bulkData.accountIds,
        updates: bulkData.updates,
        selectedAccountsSize: selectedAccounts.size
      });

      const response = await coaService.bulkUpdate(bulkData);

      if (response.success) {
        toast({
          title: 'Success',
          description: `Successfully updated ${selectedAccounts.size} accounts`,
        });
        clearSelection();
        setBulkDepartment('');
        setBulkExpenseType('');
        fetchAccounts();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to update accounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedAccounts.size === 0) return;

    setBulkActionLoading(true);
    try {
      const bulkData: BulkDeleteCOARequest = {
        accountIds: Array.from(selectedAccounts),
        hard: false, // Soft delete (deactivate)
      };

      const response = await coaService.bulkDelete(bulkData);

      if (response.success) {
        toast({
          title: 'Success',
          description: `Successfully deactivated ${selectedAccounts.size} accounts`,
        });
        clearSelection();
        fetchAccounts();
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to deactivate accounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Get unique values for filters
  const categories = [...new Set(accounts.map(acc => acc.Category).filter(Boolean))];
  const departments = [...new Set(accounts.map(acc => acc.Department).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">
            Manage your organization's chart of accounts
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
              <DialogDescription>
                Add a new account to your chart of accounts.
              </DialogDescription>
            </DialogHeader>
            <COAForm onSuccess={handleAccountSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accounts.filter(acc => acc.IsActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mandatory Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverageLoading ? '...' : mandatoryReadyCount}</div>
            <p className="text-xs text-muted-foreground">
              FY {CURRENT_FISCAL_YEAR} governed COAs ready
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/40">
        <CardHeader>
          <CardTitle>Mandatory HR / IT OPEX Governance</CardTitle>
          <CardDescription>
            Protected baseline list with current fiscal-year coverage visibility and label governance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm text-muted-foreground">Protected Baseline</div>
            <div className="text-2xl font-bold">{Object.keys(MANDATORY_HR_IT_OPEX_LABELS).length}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Need Attention</div>
            <div className="text-2xl font-bold text-orange-600">{coverageLoading ? '...' : mandatoryAttentionCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Carry Forward Applied</div>
            <div className="text-2xl font-bold text-blue-700">{coverageLoading ? '...' : mandatoryCarryForwardCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Governance Scope</div>
            <Select value={governanceScope} onValueChange={setGovernanceScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All COAs</SelectItem>
                <SelectItem value="mandatory-hr-it-opex">Mandatory HR / IT OPEX</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedExpenseType} onValueChange={setSelectedExpenseType} disabled={governanceScope === 'mandatory-hr-it-opex'}>
              <SelectTrigger>
                <SelectValue placeholder="Expense Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CAPEX">CAPEX</SelectItem>
                <SelectItem value="OPEX">OPEX</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={governanceScope === 'mandatory-hr-it-opex'}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={showActiveOnly ? 'active' : 'all'} onValueChange={(value) => setShowActiveOnly(value === 'active')}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSelectedExpenseType('all');
                setSelectedDepartment('all');
                setGovernanceScope('all');
                setShowActiveOnly(true);
                setCurrentPage(1);
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {showBulkActions && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedAccounts.size} account{selectedAccounts.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <Select value={bulkDepartment} onValueChange={setBulkDepartment}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Set Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HR / IT">HR / IT</SelectItem>
                      <SelectItem value="Non IT">Non IT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={bulkExpenseType} onValueChange={setBulkExpenseType}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Set Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAPEX">CAPEX</SelectItem>
                      <SelectItem value="OPEX">OPEX</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleBulkUpdate}
                    disabled={bulkActionLoading || (!bulkDepartment && !bulkExpenseType)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Apply Changes
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        disabled={bulkActionLoading}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deactivate Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Bulk Deactivation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to deactivate {selectedAccounts.size} selected account{selectedAccounts.size !== 1 ? 's' : ''}? 
                          This action will set them as inactive but they can be reactivated later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDeactivate} disabled={bulkActionLoading}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearSelection}
                disabled={bulkActionLoading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            {totalAccounts} total accounts found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={accounts.length > 0 && selectedAccounts.size === accounts.length}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all accounts"
                    />
                  </TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading accounts...
                    </TableCell>
                  </TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow key={account.COAID}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAccounts.has(account.COAID)}
                          onCheckedChange={(checked) => handleSelectAccount(account.COAID, checked as boolean)}
                          aria-label={`Select account ${account.COACode}`}
                          disabled={isProtectedMandatoryAccount(account)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{account.COACode}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{account.COAName}</div>
                          <div className="flex flex-wrap gap-1">
                            {isMandatoryAccount(account) && (
                              <Badge variant="secondary">Protected Baseline</Badge>
                            )}
                            {hasApprovedNameMismatch(account) && (
                              <Badge variant="destructive">Label Mismatch</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{account.Category || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={account.ExpenseType === 'CAPEX' ? 'default' : 'secondary'}>
                          {account.ExpenseType}
                        </Badge>
                      </TableCell>
                      <TableCell>{account.Department}</TableCell>
                      <TableCell>
                        {isMandatoryAccount(account) ? (
                          <div className="space-y-1">
                            <Badge
                              variant={
                                getCoverage(account)?.readinessStatus === 'Need Attention'
                                  ? 'destructive'
                                  : getCoverage(account)?.readinessStatus === 'Carry Forward Applied'
                                    ? 'secondary'
                                    : 'default'
                              }
                            >
                              {getCoverage(account)?.readinessStatus || 'Loading'}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              FY {CURRENT_FISCAL_YEAR} total {getCoverage(account) ? getCoverage(account)?.totalAvailableBudget.toLocaleString('en-US') : 0}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.IsActive ? 'default' : 'destructive'}>
                          {account.IsActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAccount(account);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedAccount(account);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isProtectedMandatoryAccount(account)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {isProtectedMandatoryAccount(account)
                                      ? `Protected mandatory COA ${account.COACode} cannot be deactivated from COA Management.`
                                      : `This will deactivate the account "${account.COAName}". This action can be reversed by editing the account.`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(account)}
                                    disabled={isProtectedMandatoryAccount(account)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination and Page Size Selector */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalAccounts)} of {totalAccounts} entries
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update the account information.
            </DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <COAForm
              initialData={selectedAccount}
              onSuccess={handleAccountSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      {selectedAccount && (
        <COADetailsModal
          account={selectedAccount}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </div>
  );
}
