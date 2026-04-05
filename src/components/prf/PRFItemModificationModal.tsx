import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Calendar, User, Clock, FileText, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { budgetService, ChartOfAccount } from '../../services/budgetService';
import { cn } from '../../lib/utils';

interface PRFItem {
  PRFItemID: number;
  PRFID: number;
  ItemName: string;
  Description?: string;
  ItemCode?: string | null;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Specifications?: string;
  Status?: string;
  PickedUpBy?: string;
  PickedUpByUserID?: number;
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
  prfStatus: string;
  onUpdate: (itemId: number, updateData: Partial<PRFItem>) => Promise<void>;
}

export const PRFItemModificationModal: React.FC<PRFItemModificationModalProps> = ({
  isOpen,
  onClose,
  item,
  prfStatus,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLookingUpCOA, setIsLookingUpCOA] = useState(false);
  const [coaName, setCOAName] = useState<string>('');
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [costCodeComboOpen, setCostCodeComboOpen] = useState(false);
  const canManagePickupFields = user?.role === 'admin' || user?.role === 'doccon';
  
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
    PickedUpBy: item.PickedUpBy || '',
    PickedUpByUserID: item.PickedUpByUserID ? item.PickedUpByUserID.toString() : '',
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
      PickedUpBy: item.PickedUpBy || '',
      PickedUpByUserID: item.PickedUpByUserID ? item.PickedUpByUserID.toString() : '',
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
      const pickedUpByName = formData.PickedUpBy.trim();
      const hasPicName = pickedUpByName.length > 0;
      const hasPicUserId = formData.PickedUpByUserID.trim().length > 0;
      const hasPickedUpDate = formData.PickedUpDate.trim().length > 0;
      const wantsPickup = hasPicName || hasPicUserId || hasPickedUpDate;

      if (wantsPickup) {
        if (!hasPicName && !hasPicUserId) {
          throw new Error('Picking PIC wajib diisi jika set PickedUpDate');
        }
        if (!hasPickedUpDate) {
          throw new Error('PickedUpDate wajib diisi jika set Picking PIC');
        }
      }

      const updateData: Partial<PRFItem> = {
        Notes: formData.Notes,
        UpdatedBy: user.id,
        PurchaseCostCode: formData.PurchaseCostCode,
        COAID: formData.COAID ? parseInt(formData.COAID.toString()) : undefined,
        BudgetYear: formData.BudgetYear,
      };

      if (canManagePickupFields) {
        updateData.PickedUpBy = formData.PickedUpBy;
        updateData.PickedUpByUserID = formData.PickedUpByUserID ? parseInt(formData.PickedUpByUserID, 10) : undefined;
        updateData.PickedUpDate = formData.PickedUpDate ? new Date(formData.PickedUpDate) : undefined;
      }

      await onUpdate(item.PRFItemID, updateData);
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
      alert(error instanceof Error ? error.message : 'Failed to update item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPickup = async () => {
    if (!user) return;
    const pickerName = window.prompt('Who picked up this item?');
    if (!pickerName || pickerName.trim().length === 0) {
      alert('Picking PIC wajib diisi');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: Partial<PRFItem> = {
        UpdatedBy: user.id,
        PickedUpBy: pickerName.trim(),
        PickedUpByUserID: undefined,
        PickedUpDate: new Date(),
      };
      await onUpdate(item.PRFItemID, updateData);
      onClose();
    } catch (error) {
      console.error('Failed to update item:', error);
    } finally {
      setIsLoading(false);
    }
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
                <span className="font-medium">Status PO:</span>
                <Badge variant="outline" className="whitespace-nowrap">
                  {prfStatus || '-'}
                </Badge>
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
              {canManagePickupFields && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuickPickup}
                  disabled={isLoading}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Mark as Picked Up
                </Button>
              )}
            </div>
          </div>

          {/* Detailed Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-6">
                <Label htmlFor="pickedUpBy">Picking PIC</Label>
                <Input
                  id="pickedUpBy"
                  value={formData.PickedUpBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, PickedUpBy: e.target.value, PickedUpByUserID: '' }))}
                  placeholder="Enter picker name"
                  readOnly={!canManagePickupFields}
                  className={!canManagePickupFields ? 'bg-muted' : ''}
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <Label htmlFor="pickedUpDate">Pickup Date</Label>
                <Input
                  id="pickedUpDate"
                  type="date"
                  value={formData.PickedUpDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, PickedUpDate: e.target.value }))}
                  disabled={!canManagePickupFields}
                />
              </div>
            </div>

            {!canManagePickupFields && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Picking PIC fields are read-only for your role.
              </div>
            )}

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
              <Button type="submit" disabled={isLoading || !canManagePickupFields}>
                {isLoading ? 'Updating...' : 'Update Item'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
