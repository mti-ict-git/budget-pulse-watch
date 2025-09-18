import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Calendar, User, Clock, FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
  const [formData, setFormData] = useState({
    Status: item.Status || 'Pending',
    PickedUpBy: item.PickedUpBy || '',
    PickedUpDate: item.PickedUpDate ? new Date(item.PickedUpDate).toISOString().split('T')[0] : '',
    Notes: item.Notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const updateData: Partial<PRFItem> = {
        Status: formData.Status as PRFItem['Status'],
        Notes: formData.Notes,
        UpdatedBy: user.id,
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