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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, Calendar, User, Building, DollarSign, Target, Code, Clock, CheckCircle2, MessageSquare, Briefcase } from "lucide-react";
import PRFDocuments from "./PRFDocuments";

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
  approvedByName?: string;
  lastUpdate: string;
  
  // Additional Fields
  title?: string;
  approvedAmount?: number | null;
  actualAmount?: number | null;
  currencyCode?: string;
  exchangeRateToIDR?: number;
  requiredDate?: string | null;
  approvalDate?: string | null;
  completionDate?: string | null;
  justification?: string | null;
  vendorName?: string | null;
  vendorContact?: string | null;
  notes?: string | null;
}

interface PRFDetailDialogProps {
  prf: PRFData;
}

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: { label: "Pending", variant: "secondary" as const },
    approved: { label: "Approved", variant: "default" as const },
    completed: { label: "Completed", variant: "success" as const },
    over_budget: { label: "Over Budget", variant: "destructive" as const },
    draft: { label: "Draft", variant: "outline" as const },
    submitted: { label: "Submitted", variant: "secondary" as const },
    under_review: { label: "Under Review", variant: "secondary" as const },
    rejected: { label: "Rejected", variant: "destructive" as const },
    cancelled: { label: "Cancelled", variant: "outline" as const }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getPriorityBadge = (priority: string) => {
  const priorityConfig = {
    Low: { label: "Low", variant: "outline" as const },
    Medium: { label: "Medium", variant: "secondary" as const },
    High: { label: "High", variant: "default" as const },
    Critical: { label: "Critical", variant: "destructive" as const }
  };
  
  const config = priorityConfig[priority as keyof typeof priorityConfig] || { label: priority, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const formatCurrency = (amount: number, currencyCode: string = 'IDR', exchangeRate: number = 1) => {
  // If USD and exchange rate exists, show USD amount with IDR equivalent
  if (currencyCode === 'USD') {
    const usdFormat = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
    
    const idrFormat = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount * exchangeRate);
    
    return `${usdFormat} (${idrFormat})`;
  }

  // Default IDR formatting
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export function PRFDetailDialog({ prf }: PRFDetailDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="View Details">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>PRF Details - {prf.prfNo}</span>
            {getStatusBadge(prf.progress)}
            {getPriorityBadge(prf.priority)}
          </DialogTitle>
          <DialogDescription>
            System ID: {prf.id} • Last Updated: {new Date(prf.lastUpdate).toLocaleDateString('id-ID')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">PRF Number</label>
                  <p className="font-medium">{prf.prfNo}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">System ID</label>
                  <p className="font-mono text-sm">{prf.id}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submit By</label>
                  <p className="font-medium">{prf.submitBy}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Department</label>
                  <Badge variant="outline">{prf.department}</Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Date Submitted
                </label>
                <p className="font-medium">{new Date(prf.dateSubmit).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Requested Amount</label>
                <p className="text-2xl font-bold text-primary">{formatCurrency(prf.amount, prf.currencyCode, prf.exchangeRateToIDR)}</p>
              </div>
              
              {(prf.approvedAmount != null || prf.actualAmount != null) && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  {prf.approvedAmount != null && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Approved Amount</label>
                      <p className="font-medium text-green-700">{formatCurrency(prf.approvedAmount, prf.currencyCode, prf.exchangeRateToIDR)}</p>
                    </div>
                  )}
                  {prf.actualAmount != null && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Actual/Spent Amount</label>
                      <p className="font-medium text-blue-700">{formatCurrency(prf.actualAmount, prf.currencyCode, prf.exchangeRateToIDR)}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Code className="h-4 w-4" />
                    Cost Code
                  </label>
                  <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{prf.purchaseCostCode}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Budget Year</label>
                  <p className="font-medium">{prf.budgetYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Information */}
          {(prf.vendorName || prf.vendorContact) && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building className="h-5 w-5" />
                  Vendor Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {prf.vendorName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vendor Name</label>
                    <p className="font-medium">{prf.vendorName}</p>
                  </div>
                )}
                {prf.vendorContact && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vendor Contact Details</label>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{prf.vendorContact}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Description & Purpose */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" />
                Description & Purpose
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Title / Short Description</label>
                <p className="font-medium">{prf.title || prf.description}</p>
              </div>
              
              {(prf.title && prf.description && prf.title !== prf.description) && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Additional Description</label>
                    <p className="text-sm leading-relaxed">{prf.description}</p>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Detailed Summary (From Request)</label>
                <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                  {prf.sumDescriptionRequested || 'No detailed summary provided.'}
                </p>
              </div>
              
              {prf.justification && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Justification</label>
                    <p className="text-sm leading-relaxed bg-blue-50/50 p-3 rounded-md whitespace-pre-wrap border border-blue-100">
                      {prf.justification}
                    </p>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Required For</label>
                <p className="font-medium">{prf.requiredFor || 'Not specified'}</p>
              </div>

              {prf.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      Notes
                    </label>
                    <p className="text-sm leading-relaxed italic mt-1">{prf.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status & Timeline */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5" />
                Status & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <label className="text-sm font-medium text-muted-foreground">Current Status</label>
                  <div className="mt-2">
                    {getStatusBadge(prf.progress)}
                  </div>
                </div>
                
                <div className="text-center">
                  <label className="text-sm font-medium text-muted-foreground">Priority Level</label>
                  <div className="mt-2">
                    {getPriorityBadge(prf.priority)}
                  </div>
                </div>
                
                <div className="text-center">
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="font-medium mt-2">
                    {new Date(prf.lastUpdate).toLocaleDateString('id-ID')}
                  </p>
                </div>

                {prf.requiredDate && (
                  <div className="text-center">
                    <label className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Required By
                    </label>
                    <p className="font-medium mt-2">
                      {new Date(prf.requiredDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                )}
                
                {prf.approvalDate && (
                  <div className="text-center">
                    <label className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Approval Date
                    </label>
                    <p className="font-medium mt-2">
                      {new Date(prf.approvalDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                )}
                
                {prf.completionDate && (
                  <div className="text-center">
                    <label className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                      <Briefcase className="h-4 w-4 text-blue-600" />
                      Completion Date
                    </label>
                    <p className="font-medium mt-2">
                      {new Date(prf.completionDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                )}
                
                {prf.approvedByName && (
                  <div className="text-center md:col-span-3 mt-2 pt-4 border-t">
                    <label className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                      <User className="h-4 w-4 text-green-600" />
                      Approved By
                    </label>
                    <p className="font-medium text-green-600 mt-2">{prf.approvedByName}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PRF Documents */}
          <div className="md:col-span-2">
            <PRFDocuments 
              prfId={parseInt(prf.id)} 
              prfNo={prf.prfNo} 
              onDocumentUpdate={() => {
                // Optional: refresh PRF data if needed
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}