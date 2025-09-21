import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Calendar, User, Clock, FileText, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { budgetService, ChartOfAccount } from '../../services/budgetService';
import { cn } from '../../lib/utils';

interface PRFItem {
  PRFItemID: number;
  PRFID: number;
  ItemName: string;
  Description?: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Specifications?: string;
  Status?: 'Pending' | 'Approved' | 'Picked Up' | 'Cancelled' | 'On Hold';
  PickedUpBy?: string;
  PickedUpDate?: Date;
  Notes?: string;
  UpdatedAt?: Date;
  UpdatedBy?: number;
  CreatedAt: Date;
  StatusOverridden?: boolean; // Indicates if item status was manually overridden vs following PRF status
  
  // Cost code fields - enables multiple cost codes per PRF through item-level assignment
  PurchaseCostCode?: string;
  COAID?: number;
  BudgetYear?: number;
}

interface PRFItemModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PRFItem;
  onUpdate: (itemId: number, updateData: Partial<PRFItem>) => Promise<void>;
}

const statusOptions = [
  { value: 'Pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'Picked Up', label: 'Picked Up', color: 'bg-blue-100 text-blue-800' },
  { value: 'On Hold', label: 'On Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'Cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export const PRFItemModificationModal: React.FC<PRFItemModificationModalProps> = ({
  isOpen,
  onClose,
  item,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUpCOA, setIsLookingUpCOA] = useState(false);
  const [coaName, setCOAName] = useState<string>('');
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [costCodeComboOpen, setCostCodeComboOpen] = useState(false);
  
  // Function to lookup COA ID from purchase cost code
  const lookupCOAID = async (purchaseCostCode: string) => {
    if (!purchaseCostCode.trim()) {
      return null;
    }
    
    try {
      setIsLookingUpCOA(true);
      const response = await fetch(`/api/coa/code/${encodeURIComponent(purchaseCostCode)}`, {
        headers: authService.getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return {
            COAID: data.data.COAID,
            COAName: data.data.COAName
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to lookup COA ID:', error);
      return null;
    } finally {
      setIsLookingUpCOA(false);
    }
  };

  // Function to fetch Chart of Accounts data
  const fetchChartOfAccounts = async () => {
    try {
      const result = await budgetService.getChartOfAccounts();
      if (result.success && result.data) {
        setChartOfAccounts(result.data);
      }
    } catch (error) {
      console.error('Error fetching chart of accounts:', error);
    }
  };

  // Helper function to extract cost code data from specifications
  const extractCostCodeFromSpecs = (specifications: string) => {
    try {
      const specs = JSON.parse(specifications || '{}');
      return {
        PurchaseCostCode: specs.purchaseCostCode || specs.PurchaseCostCode || '',
        COAID: specs.coaid || specs.COAID ? (specs.coaid || specs.COAID).toString() : '',
        BudgetYear: specs.budgetYear || specs.BudgetYear ? (specs.budgetYear || specs.BudgetYear).toString() : ''
      };
    } catch {
      return {
        PurchaseCostCode: '',
        COAID: '',
        BudgetYear: ''
      };
    }
  };

  // Initialize form data
  const costCodeData = extractCostCodeFromSpecs(item.Specifications);
  const [formData, setFormData] = useState({
    Status: item.Status || 'Pending',
    PickedUpBy: item.PickedUpBy || '',
    PickedUpDate: item.PickedUpDate ? new Date(item.PickedUpDate).toISOString().split('T')[0] : '',
    Notes: item.Notes || '',
    PurchaseCostCode: item.PurchaseCostCode || costCodeData.PurchaseCostCode,
    COAID: item.COAID ? item.COAID.toString() : costCodeData.COAID,
    BudgetYear: item.BudgetYear || parseInt(costCodeData.BudgetYear) || new Date().getFullYear(),
  });

  // Reset form data when item changes
  useEffect(() => {
    const costCodeData = extractCostCodeFromSpecs(item.Specifications);
    setFormData({
      Status: item.Status || 'Pending',
      PickedUpBy: item.PickedUpBy || '',
      PickedUpDate: item.PickedUpDate ? new Date(item.PickedUpDate).toISOString().split('T')[0] : '',
      Notes: item.Notes || '',
      PurchaseCostCode: item.PurchaseCostCode || costCodeData.PurchaseCostCode,
      COAID: item.COAID ? item.COAID.toString() : costCodeData.COAID,
      BudgetYear: item.BudgetYear || parseInt(costCodeData.BudgetYear) || new Date().getFullYear(),
    });
    setCOAName(''); // Reset COA name when item changes
  }, [item]);

  // Automatically lookup COA ID when purchase cost code changes
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (formData.PurchaseCostCode && formData.PurchaseCostCode.trim()) {
        const coaData = await lookupCOAID(formData.PurchaseCostCode);
        if (coaData) {
          setFormData(prev => ({ ...prev, COAID: coaData.COAID.toString() }));
          setCOAName(coaData.COAName);
        } else {
          setCOAName('');
        }
      } else {
        setCOAName('');
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [formData.PurchaseCostCode]);

  // Fetch Chart of Accounts on component mount
  useEffect(() => {
    fetchChartOfAccounts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const updateData: Partial<PRFItem> = {
        Status: formData.Status as PRFItem['Status'],
        Notes: formData.Notes,
        UpdatedBy: user.id,
        PurchaseCostCode: formData.PurchaseCostCode,
        COAID: formData.COAID ? parseInt(formData.COAID.toString()) : undefined,
        BudgetYear: formData.BudgetYear,
      };

      // Only include pickup fields if status is "Picked Up"
      if (formData.Status === 'Picked Up') {
        updateData.PickedUpBy = formData.PickedUpBy;
        updateData.PickedUpDate = formData.PickedUpDate ? new Date(formData.PickedUpDate) : undefined;
      }

      await onUpdate(item.PRFItemID, updateData);
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = async (action: 'cancel' | 'approve' | 'pickup' | 'reset-override') => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updateData: Partial<PRFItem> = {
        UpdatedBy: user.id,
      };

      switch (action) {
        case 'cancel':
          updateData.Status = 'Cancelled';
          updateData.Notes = formData.Notes || 'Item cancelled';
          break;
        case 'approve':
          updateData.Status = 'Approved';
          break;
        case 'pickup':
          updateData.Status = 'Picked Up';
          updateData.PickedUpBy = user.username;
          updateData.PickedUpDate = new Date();
          break;
        case 'reset-override':
          updateData.StatusOverridden = false;
          // Don't set Status - let the backend cascade from PRF status
          break;
      }

      await onUpdate(item.PRFItemID, updateData);
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentStatusBadge = () => {
    const status = statusOptions.find(s => s.value === item.Status);
    return (
      <Badge className={status?.color || 'bg-gray-100 text-gray-800'}>
        {status?.label || 'Unknown'}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Modify Item: {item.ItemName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Item Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Quantity:</span> {item.Quantity}
              </div>
              <div>
                <span className="font-medium">Unit Price:</span> ${item.UnitPrice.toFixed(2)}
              </div>
              <div>
                <span className="font-medium">Total:</span> ${item.TotalPrice.toFixed(2)}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Current Status:</span> 
                <div className="flex items-center gap-1">
                  {getCurrentStatusBadge()}
                  {item.StatusOverridden && (
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                      title="Status manually overridden - does not follow PRF status"
                    >
                      Manual Override
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium">Cost Code:</span> {item.PurchaseCostCode || 'Not assigned'}
              </div>
              <div>
                <span className="font-medium">COA ID:</span> {item.COAID || 'Not assigned'}
              </div>
              <div>
                <span className="font-medium">Budget Year:</span> {item.BudgetYear || 'Not assigned'}
              </div>
            </div>
            {item.Description && (
              <div className="mt-2">
                <span className="font-medium">Description:</span> {item.Description}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h3 className="font-semibold">Quick Actions</h3>
            <div className="flex gap-2 flex-wrap">
              {item.Status !== 'Approved' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('approve')}
                  disabled={isLoading}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  Approve Item
                </Button>
              )}
              {item.Status !== 'Picked Up' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('pickup')}
                  disabled={isLoading}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Mark as Picked Up
                </Button>
              )}
              {item.Status !== 'Cancelled' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('cancel')}
                  disabled={isLoading}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Cancel Item
                </Button>
              )}
              {item.StatusOverridden && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('reset-override')}
                  disabled={isLoading}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  Reset to PRF Status
                </Button>
              )}
            </div>
          </div>

          {/* Detailed Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.Status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, Status: value as PRFItem['Status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.Status === 'Picked Up' && (
                <>
                  <div>
                    <Label htmlFor="pickedUpBy">Picked Up By</Label>
                    <Input
                      id="pickedUpBy"
                      value={formData.PickedUpBy}
                      onChange={(e) => setFormData(prev => ({ ...prev, PickedUpBy: e.target.value }))}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pickedUpDate">Pickup Date</Label>
                    <Input
                      id="pickedUpDate"
                      type="date"
                      value={formData.PickedUpDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, PickedUpDate: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Cost Code Fields */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Cost Code Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="purchaseCostCode">Purchase Cost Code</Label>
                  <Popover open={costCodeComboOpen} onOpenChange={setCostCodeComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={costCodeComboOpen}
                        className="w-full justify-between"
                      >
                        {formData.PurchaseCostCode || "Select cost code..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search cost codes..." />
                        <CommandList>
                          <CommandEmpty>No cost code found.</CommandEmpty>
                          <CommandGroup>
                            {chartOfAccounts.map((coa) => (
                              <CommandItem
                                key={coa.COAID}
                                value={coa.COACode}
                                onSelect={(currentValue) => {
                                  const selectedCOA = chartOfAccounts.find(c => c.COACode === currentValue);
                                  if (selectedCOA) {
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      PurchaseCostCode: selectedCOA.COACode,
                                      COAID: selectedCOA.COAID.toString()
                                    }));
                                    setCOAName(selectedCOA.COAName);
                                  }
                                  setCostCodeComboOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.PurchaseCostCode === coa.COACode ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{coa.COACode}</span>
                                  <span className="text-sm text-muted-foreground">{coa.COAName}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {isLookingUpCOA && (
                    <p className="text-sm text-blue-600 mt-1">Looking up COA ID...</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="coaid">COA ID</Label>
                  <Input
                    id="coaid"
                    type="number"
                    value={formData.COAID}
                    placeholder="Auto-populated from cost code"
                    readOnly
                    className="bg-gray-50 cursor-not-allowed"
                  />
                  {coaName && (
                    <p className="text-sm text-green-600 mt-1">{coaName}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="budgetYear">Budget Year</Label>
                  <Input
                    id="budgetYear"
                    type="number"
                    value={formData.BudgetYear}
                    onChange={(e) => setFormData(prev => ({ ...prev, BudgetYear: parseInt(e.target.value) || new Date().getFullYear() }))}
                    placeholder="Enter budget year"
                    min="2020"
                    max="2030"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.Notes}
                onChange={(e) => setFormData(prev => ({ ...prev, Notes: e.target.value }))}
                placeholder="Add any notes about this modification..."
                rows={3}
              />
            </div>

            {/* History */}
            {(item.UpdatedAt || item.PickedUpDate) && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  History
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  {item.PickedUpDate && (
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      Picked up by {item.PickedUpBy} on {new Date(item.PickedUpDate).toLocaleDateString()}
                    </div>
                  )}
                  {item.UpdatedAt && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      Last updated: {new Date(item.UpdatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Item'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};