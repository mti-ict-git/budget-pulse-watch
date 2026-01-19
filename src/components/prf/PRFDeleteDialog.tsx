import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { authService } from '@/services/authService';

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

interface PRFDeleteDialogProps {
  prf: PRFData;
  onPRFDeleted?: () => void;
}

export function PRFDeleteDialog({ prf, onPRFDeleted }: PRFDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
        const response = await fetch(`/api/prfs/${prf.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authService.getToken()}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: `PRF ${prf.prfNo} deleted successfully`,
        });
        onPRFDeleted?.();
      } else {
        throw new Error(result.message || 'Failed to delete PRF');
      }
    } catch (error) {
      console.error('Error deleting PRF:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete PRF',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Delete PRF">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete PRF {prf.prfNo}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this Purchase Request Form? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
            <p><strong>PRF No:</strong> {prf.prfNo}</p>
            <p><strong>Description:</strong> {prf.description}</p>
            <p><strong>Amount:</strong> Rp {prf.amount.toLocaleString('id-ID')}</p>
            <p><strong>Department:</strong> {prf.department}</p>
            <p><strong>Status:</strong> {prf.progress}</p>
          </div>
          <p className="text-red-600 font-medium">
            ⚠️ This will permanently delete the PRF and all associated data including items and documents.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete PRF
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default PRFDeleteDialog;