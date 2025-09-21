import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { budgetService, Budget, UpdateBudgetRequest, CreateBudgetRequest, ChartOfAccount } from "@/services/budgetService";

interface BudgetEditDialogProps {
  budget: Budget;
  onBudgetUpdated?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BudgetEditDialog({ budget, onBudgetUpdated, trigger, open: externalOpen, onOpenChange, onSuccess }: BudgetEditDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoadingCOA, setIsLoadingCOA] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<UpdateBudgetRequest>({
    COAID: budget.COAID,
    FiscalYear: budget.FiscalYear,
    AllocatedAmount: budget.AllocatedAmount,
    Description: budget.Description || "",
    Department: budget.Department || ""
  });

  const loadChartOfAccounts = useCallback(async () => {
    setIsLoadingCOA(true);
    try {
      const response = await budgetService.getChartOfAccounts();
      if (response.success && response.data) {
        setChartOfAccounts(response.data);
      } else {
        throw new Error(response.message || 'Failed to load Chart of Accounts');
      }
    } catch (error) {
      console.error('Error loading Chart of Accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load Chart of Accounts",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCOA(false);
    }
  }, [toast]);

  // Load Chart of Accounts when dialog opens
  useEffect(() => {
    if (open) {
      loadChartOfAccounts();
      // Reset form data to current budget values when dialog opens
      setFormData({
        COAID: budget.COAID,
        FiscalYear: budget.FiscalYear,
        AllocatedAmount: budget.AllocatedAmount,
        Description: budget.Description || "",
        Department: budget.Department || ""
      });
    }
  }, [open, budget, loadChartOfAccounts]);

  const handleInputChange = (field: keyof UpdateBudgetRequest, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.COAID || !formData.AllocatedAmount || !formData.FiscalYear) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields: Chart of Account, Allocated Amount, and Fiscal Year.",
        variant: "destructive"
      });
      return;
    }

    if (formData.AllocatedAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Allocated Amount must be greater than 0.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      let result;
      
      if (budget.BudgetID === 0) {
        // Create new budget
        const createData: CreateBudgetRequest = {
          COAID: formData.COAID!,
          FiscalYear: formData.FiscalYear!,
          AllocatedAmount: formData.AllocatedAmount!,
          Description: formData.Description,
          Department: formData.Department!
        };
        result = await budgetService.createBudget(createData);
      } else {
        // Update existing budget
        result = await budgetService.updateBudget(budget.BudgetID, formData);
      }
      
      if (result.success) {
        toast({
          title: "Success",
          description: budget.BudgetID === 0 ? "Budget created successfully!" : "Budget updated successfully!"
        });
        
        setOpen(false);
        onSuccess?.();
        onBudgetUpdated?.();
      } else {
        toast({
          title: "Error",
          description: result.message || (budget.BudgetID === 0 ? "Failed to create budget" : "Failed to update budget"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: `An unexpected error occurred while ${budget.BudgetID === 0 ? 'creating' : 'updating'} the budget.`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      COAID: budget.COAID,
      AllocatedAmount: budget.AllocatedAmount,
      FiscalYear: budget.FiscalYear,
      Description: budget.Description || "",
      Department: budget.Department || "",
      IsActive: budget.IsActive
    });
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {budget.BudgetID === 0 ? 'Create New Budget' : `Edit Budget (ID: ${budget.BudgetID})`}
          </DialogTitle>
          <DialogDescription>
            {budget.BudgetID === 0 ? 'Create a new budget allocation for this Chart of Account.' : 'Update the budget allocation details below.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Budget Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chart of Account Selection */}
              <div className="space-y-2">
                <Label htmlFor="coaid" className="text-sm font-medium">
                  Chart of Account <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.COAID?.toString() || ""}
                  onValueChange={(value) => handleInputChange('COAID', parseInt(value))}
                  disabled={isLoadingCOA}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingCOA ? "Loading accounts..." : "Select Chart of Account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {chartOfAccounts.map((account) => (
                      <SelectItem key={account.COAID} value={account.COAID.toString()}>
                        {account.COACode} - {account.COAName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Allocated Amount */}
              <div className="space-y-2">
                <Label htmlFor="allocatedAmount" className="text-sm font-medium">
                  Allocated Amount <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="allocatedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter allocated amount"
                  value={formData.AllocatedAmount || ''}
                  onChange={(e) => handleInputChange('AllocatedAmount', parseFloat(e.target.value) || 0)}
                  className="w-full"
                />
              </div>

              {/* Fiscal Year */}
              <div className="space-y-2">
                <Label htmlFor="fiscalYear" className="text-sm font-medium">
                  Fiscal Year <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fiscalYear"
                  type="number"
                  min="2020"
                  max="2030"
                  placeholder="Enter fiscal year"
                  value={formData.FiscalYear || ''}
                  onChange={(e) => handleInputChange('FiscalYear', parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full"
                />
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium">
                  Department
                </Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="Enter department"
                  value={formData.Department || ''}
                  onChange={(e) => handleInputChange('Department', e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Enter budget description"
                  value={formData.Description || ''}
                  onChange={(e) => handleInputChange('Description', e.target.value)}
                  className="w-full min-h-[80px]"
                />
              </div>

              {/* Active Status */}
              <div className="space-y-2">
                <Label htmlFor="isActive" className="text-sm font-medium">
                  Status
                </Label>
                <Select
                  value={formData.IsActive ? "true" : "false"}
                  onValueChange={(value) => handleInputChange('IsActive', value === "true")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Budget Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Budget Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Budget ID:</span>
                <span>{budget.BudgetID}</span>
              </div>
              <div className="flex justify-between">
                <span>Created:</span>
                <span>{new Date(budget.CreatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Created By:</span>
                <span>{budget.CreatedBy || 'N/A'}</span>
              </div>
              {budget.UpdatedAt && (
                <div className="flex justify-between">
                  <span>Last Updated:</span>
                  <span>{new Date(budget.UpdatedAt).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoadingCOA}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Update Budget
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}