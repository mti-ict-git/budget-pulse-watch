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
import { Eye, Calendar, User, Building, DollarSign, Target, Code, Clock } from "lucide-react";

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

const formatCurrency = (amount: number) => {
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
                <p className="text-2xl font-bold text-primary">{formatCurrency(prf.amount)}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm font-medium text-muted-foreground">Short Description</label>
                <p className="font-medium">{prf.description}</p>
              </div>
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Detailed Description</label>
                <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-md">
                  {prf.sumDescriptionRequested}
                </p>
              </div>
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Required For</label>
                <p className="font-medium">{prf.requiredFor}</p>
              </div>
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
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}