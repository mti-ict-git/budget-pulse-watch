import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Upload, Zap, CheckCircle, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OCRUpload from '@/components/OCRUpload';
import { toast } from '@/hooks/use-toast';

interface ExtractedPRFData {
  prfNo?: string;
  requestedBy?: string;
  department?: string;
  dateRaised?: string;
  dateRequired?: string;
  proposedSupplier?: string;
  totalAmount?: number;
  items?: Array<{
    partNumber?: string;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    currency?: string;
  }>;
  projectDescription?: string;
  projectId?: string;
  referenceDrawingNumber?: string;
  generalLedgerCode?: string;
  requestFor?: string; // Auto-extracted from item descriptions
  budgeted?: boolean;
  underICTControl?: boolean;
  receivedPRDate?: string;
  entryDate?: string;
  status?: string;
  confidence?: number;
}

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

interface CreatedPRFData {
  prf: {
    PRFID: number;
    PRFNo: string;
    RequestedBy: string;
    Department: string;
    TotalAmount: number;
    Status: string;
  };
  items: Array<{
    ItemID: number;
    PartNumber?: string;
    Description: string;
    Quantity: number;
    UnitPrice: number;
    TotalPrice: number;
    Currency: string;
  }>;
  extractedData: ExtractedPRFData;
  ocrConfidence: number;
  uploadId: string;
  originalFilename: string;
  savedFilePath: string;
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

const CreatePRF: React.FC = () => {
  const navigate = useNavigate();
  const [createdPRF, setCreatedPRF] = useState<CreatedPRFData | null>(null);
  const [previewData, setPreviewData] = useState<ExtractedPRFData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<CreatePRFRequest>({
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

  const handlePRFCreated = (prfData: CreatedPRFData) => {
    setCreatedPRF(prfData);
  };

  const handleInputChange = (field: keyof CreatePRFRequest, value: string | number | Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
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
        
        // Navigate back to PRF list
        navigate('/prf');
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

  const handlePreviewData = (data: ExtractedPRFData) => {
    setPreviewData(data);
  };

  const handleViewPRF = () => {
    if (createdPRF) {
      navigate(`/prf/${createdPRF.prf.PRFID}`);
    }
  };

  const handleCreateAnother = () => {
    setCreatedPRF(null);
    setPreviewData(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/prf')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to PRF List
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create PRF</h1>
            <p className="text-muted-foreground">
              Create a new Purchase Request Form using OCR document scanning
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {createdPRF && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>PRF Created Successfully!</strong>
                <br />
                PRF {createdPRF.prf.PRFNo} has been created with {createdPRF.items.length} items.
                OCR Confidence: {Math.round(createdPRF.ocrConfidence * 100)}%
              </div>
              <div className="flex gap-2">
                <Button onClick={handleViewPRF} size="sm">
                  View PRF
                </Button>
                <Button onClick={handleCreateAnother} variant="outline" size="sm">
                  Create Another
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {!createdPRF ? (
        <Tabs defaultValue="ocr" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ocr" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              OCR Upload
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ocr" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  OCR Document Upload
                </CardTitle>
                <CardDescription>
                  Upload a PRF document and let our AI extract the information automatically.
                  Supports images (JPEG, PNG, GIF, BMP, WebP) and PDF files.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Upload className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">1. Upload Document</h3>
                      <p className="text-sm text-gray-600">Drag & drop or select your PRF document</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Zap className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">2. AI Processing</h3>
                      <p className="text-sm text-gray-600">Our AI extracts data from your document</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">3. PRF Created</h3>
                      <p className="text-sm text-gray-600">Review and finalize your PRF</p>
                    </div>
                  </div>
                </div>
                
                <OCRUpload 
                  onPRFCreated={handlePRFCreated}
                  onPreviewData={handlePreviewData}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Manual PRF Entry</CardTitle>
                <CardDescription>
                  Create a PRF by manually entering all the required information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-6">
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
                            <Input
                               id="department"
                               value={formData.Department}
                               onChange={(e) => handleInputChange('Department', e.target.value)}
                               placeholder="Enter department"
                               required
                             />
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
                    <Button type="button" variant="outline" onClick={() => navigate('/prf')}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? 'Creating...' : 'Create PRF'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* PRF Created Summary */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>PRF Summary</CardTitle>
              <CardDescription>
                Details of the created PRF from OCR extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">PRF Number</label>
                  <p className="text-lg font-semibold">{createdPRF.prf.PRFNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <Badge variant="secondary">{createdPRF.prf.Status}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Requested By</label>
                  <p className="text-sm">{createdPRF.prf.RequestedBy}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Department</label>
                  <p className="text-sm">{createdPRF.prf.Department}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(createdPRF.prf.TotalAmount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OCR Processing Details</CardTitle>
              <CardDescription>
                Information about the OCR extraction process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Source Document</label>
                <p className="text-sm">{createdPRF.originalFilename}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">OCR Confidence</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${createdPRF.ocrConfidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(createdPRF.ocrConfidence * 100)}%
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Items Extracted</label>
                <p className="text-sm">{createdPRF.items.length} items</p>
              </div>
              <div className="pt-4">
                <Button onClick={handleViewPRF} className="w-full">
                  View Complete PRF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CreatePRF;