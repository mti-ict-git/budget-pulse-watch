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
import { Plus, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { budgetService, CreateBudgetRequest, ChartOfAccount } from "@/services/budgetService";

interface BudgetCreateDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  onBudgetCreated?: () => void;
}

export function BudgetCreateDialog({ 
  open: externalOpen, 
  onOpenChange, 
  onSuccess, 
  onBudgetCreated 
}: BudgetCreateDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [isLoadingCOA, setIsLoadingCOA] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CreateBudgetRequest>({
    COAID: 0,
    AllocatedAmount: 0,
    FiscalYear: new Date().getFullYear(),
    Description: "",
    Department: ""
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
    }
  }, [open, loadChartOfAccounts]);

  const handleInputChange = (field: keyof CreateBudgetRequest, value: string | number | boolean) => {
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
      const result = await budgetService.createBudget(formData);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Budget created successfully!"
        });
        
        // Reset form
        setFormData({
          COAID: 0,
          AllocatedAmount: 0,
          FiscalYear: new Date().getFullYear(),
          Description: "",
          Department: ""
        });
        
        setOpen(false);
        onSuccess?.();
        onBudgetCreated?.();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create budget",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the budget.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      COAID: 0,
      AllocatedAmount: 0,
      FiscalYear: new Date().getFullYear(),
      Description: "",
      Department: ""
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Budget
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new budget allocation.
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
                  value={formData.COAID.toString()}
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
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Budget
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}