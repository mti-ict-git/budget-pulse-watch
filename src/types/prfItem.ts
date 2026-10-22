// PRF Item interface
export interface PRFItem {
  PRFItemID: number;
  ItemID?: number; // Legacy field for compatibility
  PRFID: number;
  ItemName: string;
  Description: string;
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
  OriginalPONumber?: string | null;
  SplitPONumber?: string | null;

  // Cost code fields - enables multiple cost codes per PRF through item-level assignment
  PurchaseCostCode?: string;
  COAID?: number;
  BudgetYear?: number;
}
