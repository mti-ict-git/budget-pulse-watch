import { useState } from "react";
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

interface CreatePRFRequest {
  PRFNo: string;
  Title: string;
  Description?: string;
  Department: string;
  COAID: number;
  RequestedAmount: number;
  Priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  RequiredDate?: Date;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  Notes?: string;
  DateSubmit?: Date;
  SubmitBy?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
}

interface PRFCreateDialogProps {
  onPRFCreated?: () => void;
}

const departments = [
  "IT",
  "Finance",
  "HR",
  "Operations",
  "Marketing",
  "Sales",
  "Procurement",
  "Legal",
  "Admin"
];

const priorities = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Critical", label: "Critical" }
];

export function PRFCreateDialog({ onPRFCreated }: PRFCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<CreatePRFRequest>({
    PRFNo: "",
    Title: "",
    Description: "",
    Department: "",
    COAID: 1, // Default COA ID - should be fetched from API
    RequestedAmount: 0,
    Priority: "Medium",
    RequiredDate: undefined,
    Justification: "",
    VendorName: "",
    VendorContact: "",
    Notes: "",
    DateSubmit: new Date(),
    SubmitBy: "",
    SumDescriptionRequested: "",
    PurchaseCostCode: "",
    RequiredFor: "",
    BudgetYear: new Date().getFullYear()
  });

  const handleInputChange = (field: keyof CreatePRFRequest, value: string | number | Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.PRFNo || !formData.Title || !formData.Department || !formData.RequestedAmount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields: PRF No, Title, Department, and Requested Amount.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/prfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          RequestedAmount: Number(formData.RequestedAmount),
          COAID: Number(formData.COAID),
          BudgetYear: Number(formData.BudgetYear)
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "PRF created successfully!"
        });
        
        // Reset form
        setFormData({
          PRFNo: "",
          Title: "",
          Description: "",
          Department: "",
          COAID: 1,
          RequestedAmount: 0,
          Priority: "Medium",
          RequiredDate: undefined,
          Justification: "",
          VendorName: "",
          VendorContact: "",
          Notes: "",
          DateSubmit: new Date(),
          SubmitBy: "",
          SumDescriptionRequested: "",
          PurchaseCostCode: "",
          RequiredFor: "",
          BudgetYear: new Date().getFullYear()
        });
        
        setOpen(false);
        onPRFCreated?.();
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to create PRF",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating PRF:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while creating the PRF.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New PRF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New PRF
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new Purchase Request Form.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="prfNo">PRF Number *</Label>
                    <Input
                      id="prfNo"
                      value={formData.PRFNo}
                      onChange={(e) => handleInputChange('PRFNo', e.target.value)}
                      placeholder="e.g., PRF-2024-001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="budgetYear">Budget Year</Label>
                    <Input
                      id="budgetYear"
                      type="number"
                      value={formData.BudgetYear}
                      onChange={(e) => handleInputChange('BudgetYear', parseInt(e.target.value))}
                      placeholder="2024"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.Title}
                    onChange={(e) => handleInputChange('Title', e.target.value)}
                    placeholder="Brief title of the request"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.Description}
                    onChange={(e) => handleInputChange('Description', e.target.value)}
                    placeholder="Detailed description of the request"
                    rows={3}
                  />
                </div>
                
                <div>
                  <Label htmlFor="sumDescription">Summary Description</Label>
                  <Textarea
                    id="sumDescription"
                    value={formData.SumDescriptionRequested}
                    onChange={(e) => handleInputChange('SumDescriptionRequested', e.target.value)}
                    placeholder="Summary of what is being requested"
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Select value={formData.Department} onValueChange={(value) => handleInputChange('Department', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.Priority} onValueChange={(value) => handleInputChange('Priority', value as CreatePRFRequest['Priority'])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="requestedAmount">Requested Amount *</Label>
                    <Input
                      id="requestedAmount"
                      type="number"
                      step="0.01"
                      value={formData.RequestedAmount}
                      onChange={(e) => handleInputChange('RequestedAmount', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="coaid">COA ID *</Label>
                    <Input
                      id="coaid"
                      type="number"
                      value={formData.COAID}
                      onChange={(e) => handleInputChange('COAID', parseInt(e.target.value) || 1)}
                      placeholder="1"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="requiredFor">Required For</Label>
                  <Input
                    id="requiredFor"
                    value={formData.RequiredFor}
                    onChange={(e) => handleInputChange('RequiredFor', e.target.value)}
                    placeholder="What is this request for?"
                  />
                </div>
                
                <div>
                  <Label htmlFor="purchaseCostCode">Purchase Cost Code</Label>
                  <Input
                    id="purchaseCostCode"
                    value={formData.PurchaseCostCode}
                    onChange={(e) => handleInputChange('PurchaseCostCode', e.target.value)}
                    placeholder="Cost center code"
                  />
                </div>
                
                <div>
                  <Label htmlFor="requiredDate">Required Date</Label>
                  <Input
                    id="requiredDate"
                    type="date"
                    value={formData.RequiredDate ? formData.RequiredDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleInputChange('RequiredDate', e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submitBy">Submit By</Label>
                  <Input
                    id="submitBy"
                    value={formData.SubmitBy}
                    onChange={(e) => handleInputChange('SubmitBy', e.target.value)}
                    placeholder="Person submitting this request"
                  />
                </div>
                <div>
                  <Label htmlFor="dateSubmit">Submit Date</Label>
                  <Input
                    id="dateSubmit"
                    type="date"
                    value={formData.DateSubmit ? formData.DateSubmit.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleInputChange('DateSubmit', e.target.value ? new Date(e.target.value) : new Date())}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendorName">Vendor Name</Label>
                  <Input
                    id="vendorName"
                    value={formData.VendorName}
                    onChange={(e) => handleInputChange('VendorName', e.target.value)}
                    placeholder="Preferred vendor"
                  />
                </div>
                <div>
                  <Label htmlFor="vendorContact">Vendor Contact</Label>
                  <Input
                    id="vendorContact"
                    value={formData.VendorContact}
                    onChange={(e) => handleInputChange('VendorContact', e.target.value)}
                    placeholder="Vendor contact information"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="justification">Justification</Label>
                <Textarea
                  id="justification"
                  value={formData.Justification}
                  onChange={(e) => handleInputChange('Justification', e.target.value)}
                  placeholder="Business justification for this request"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.Notes}
                  onChange={(e) => handleInputChange('Notes', e.target.value)}
                  placeholder="Additional notes or comments"
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
              {isSubmitting ? 'Creating...' : 'Create PRF'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}