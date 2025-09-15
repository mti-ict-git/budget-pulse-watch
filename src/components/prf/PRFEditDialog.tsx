import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Save, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PRFData {
  id: string;
  prfNo: string;
  dateSubmit: string;
  submitBy: string;
  description: string;
  sumDescriptionRequested: string;
  purchaseCostCode: string;
  amount: number;
  requiredFor: string;
  budgetYear: number;
  department: string;
  priority: string;
  progress: string;
  lastUpdate: string;
}

interface PRFEditDialogProps {
  prf: PRFData;
  onPRFUpdated?: () => void;
}

interface UpdatePRFRequest {
  Title?: string;
  Description?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequestedAmount?: number;
  RequiredFor?: string;
  BudgetYear?: number;
  Department?: string;
  Priority?: string;
  Status?: string;
  SubmitBy?: string;
}

export function PRFEditDialog({ prf, onPRFUpdated }: PRFEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<UpdatePRFRequest>({
    Title: prf.description,
    Description: prf.description,
    SumDescriptionRequested: prf.sumDescriptionRequested,
    PurchaseCostCode: prf.purchaseCostCode,
    RequestedAmount: prf.amount,
    RequiredFor: prf.requiredFor,
    BudgetYear: prf.budgetYear,
    Department: prf.department,
    Priority: prf.priority,
    Status: prf.progress,
    SubmitBy: prf.submitBy,
  });

  // Reset form data when PRF changes
  useEffect(() => {
    setFormData({
      Title: prf.description,
      Description: prf.description,
      SumDescriptionRequested: prf.sumDescriptionRequested,
      PurchaseCostCode: prf.purchaseCostCode,
      RequestedAmount: prf.amount,
      RequiredFor: prf.requiredFor,
      BudgetYear: prf.budgetYear,
      Department: prf.department,
      Priority: prf.priority,
      Status: prf.progress,
      SubmitBy: prf.submitBy,
    });
  }, [prf]);

  const handleInputChange = (field: keyof UpdatePRFRequest, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      if (!formData.Title?.trim()) {
        toast({
          title: "Validation Error",
          description: "Title is required",
          variant: "destructive",
        });
        return;
      }

      if (!formData.RequestedAmount || formData.RequestedAmount <= 0) {
        toast({
          title: "Validation Error",
          description: "Requested amount must be greater than 0",
          variant: "destructive",
        });
        return;
      }

      // Prepare update data
      const updateData: UpdatePRFRequest = {
        Title: formData.Title?.trim(),
        Description: formData.Description?.trim(),
        SumDescriptionRequested: formData.SumDescriptionRequested?.trim(),
        PurchaseCostCode: formData.PurchaseCostCode?.trim(),
        RequestedAmount: formData.RequestedAmount,
        RequiredFor: formData.RequiredFor?.trim(),
        BudgetYear: formData.BudgetYear,
        Department: formData.Department,
        Priority: formData.Priority,
        Status: formData.Status,
        SubmitBy: formData.SubmitBy?.trim(),
      };

      // Remove empty/undefined fields
      Object.keys(updateData).forEach(key => {
        const value = updateData[key as keyof UpdatePRFRequest];
        if (value === undefined || value === '' || value === null) {
          delete updateData[key as keyof UpdatePRFRequest];
        }
      });

      console.log('Updating PRF:', prf.id, 'with data:', updateData);

      const response = await fetch(`http://localhost:3001/api/prfs/${prf.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: `PRF ${prf.prfNo} updated successfully`,
        });
        setOpen(false);
        onPRFUpdated?.();
      } else {
        throw new Error(result.message || 'Failed to update PRF');
      }
    } catch (error) {
      console.error('Error updating PRF:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update PRF',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Edit PRF">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit PRF {prf.prfNo}</DialogTitle>
          <DialogDescription>
            Update the details for this Purchase Request Form.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.Title || ''}
                    onChange={(e) => handleInputChange('Title', e.target.value)}
                    placeholder="Enter PRF title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="submitBy">Submit By</Label>
                  <Input
                    id="submitBy"
                    value={formData.SubmitBy || ''}
                    onChange={(e) => handleInputChange('SubmitBy', e.target.value)}
                    placeholder="Enter submitter name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.Description || ''}
                  onChange={(e) => handleInputChange('Description', e.target.value)}
                  placeholder="Enter detailed description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="sumDescription">Summary Description</Label>
                <Textarea
                  id="sumDescription"
                  value={formData.SumDescriptionRequested || ''}
                  onChange={(e) => handleInputChange('SumDescriptionRequested', e.target.value)}
                  placeholder="Enter summary of what is being requested"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.Department || ''}
                    onChange={(e) => handleInputChange('Department', e.target.value)}
                    placeholder="Enter department"
                  />
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.Priority || ''}
                    onValueChange={(value) => handleInputChange('Priority', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="requestedAmount">Requested Amount *</Label>
                  <Input
                    id="requestedAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.RequestedAmount || ''}
                    onChange={(e) => handleInputChange('RequestedAmount', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="budgetYear">Budget Year</Label>
                  <Input
                    id="budgetYear"
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.BudgetYear || ''}
                    onChange={(e) => handleInputChange('BudgetYear', parseInt(e.target.value) || new Date().getFullYear())}
                    placeholder={new Date().getFullYear().toString()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseCostCode">Purchase Cost Code</Label>
                  <Input
                    id="purchaseCostCode"
                    value={formData.PurchaseCostCode || ''}
                    onChange={(e) => handleInputChange('PurchaseCostCode', e.target.value)}
                    placeholder="Enter cost code"
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Input
                    id="status"
                    value={formData.Status || ''}
                    onChange={(e) => handleInputChange('Status', e.target.value)}
                    placeholder="Enter status"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="requiredFor">Required For</Label>
                <Textarea
                  id="requiredFor"
                  value={formData.RequiredFor || ''}
                  onChange={(e) => handleInputChange('RequiredFor', e.target.value)}
                  placeholder="Describe what this purchase is required for"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Updating...' : 'Update PRF'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PRFEditDialog;