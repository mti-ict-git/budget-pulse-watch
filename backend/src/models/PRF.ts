import { executeQuery } from '../config/database';
import { PRF, CreatePRFRequest, UpdatePRFRequest, PRFQueryParams, PRFSummary, PRFItem, CreatePRFItemRequest, UpdatePRFParams, AddPRFItemsParams, UpdatePRFItemParams, PRFStatistics } from './types';

// Interface for count query results
interface CountResult {
  Total: number;
}

export class PRFModel {
  // PRFNumber generation removed - PRFNo is now mandatory from Excel data

  /**
   * Create a new PRF
   */
  static async create(prfData: CreatePRFRequest, requestorId: number): Promise<PRF> {
    if (!prfData.PRFNo || prfData.PRFNo.trim().length === 0) {
      throw new Error('PRFNo is required and cannot be empty');
    }
    
    const query = `
      INSERT INTO PRF (
        PRFNo, Title, Description, RequestorID, Department, COAID, 
        RequestedAmount, Priority, RequiredDate, Justification, 
        VendorName, VendorContact, Notes, DateSubmit, SubmitBy, 
        SumDescriptionRequested, PurchaseCostCode, RequiredFor, BudgetYear
      )
      OUTPUT INSERTED.*
      VALUES (
        @PRFNo, @Title, @Description, @RequestorID, @Department, @COAID,
        @RequestedAmount, @Priority, @RequiredDate, @Justification,
        @VendorName, @VendorContact, @Notes, @DateSubmit, @SubmitBy,
        @SumDescriptionRequested, @PurchaseCostCode, @RequiredFor, @BudgetYear
      )
    `;
    
    const params = {
      PRFNo: prfData.PRFNo.trim(),
      Title: prfData.Title,
      Description: prfData.Description || null,
      RequestorID: requestorId,
      Department: prfData.Department,
      COAID: prfData.COAID,
      RequestedAmount: prfData.RequestedAmount,
      Priority: prfData.Priority || 'Medium',
      RequiredDate: prfData.RequiredDate || null,
      Justification: prfData.Justification || null,
      VendorName: prfData.VendorName || null,
      VendorContact: prfData.VendorContact || null,
      Notes: prfData.Notes || null,
      DateSubmit: prfData.DateSubmit || null,
      SubmitBy: prfData.SubmitBy || null,
      SumDescriptionRequested: prfData.SumDescriptionRequested || null,
      PurchaseCostCode: prfData.PurchaseCostCode || null,
      RequiredFor: prfData.RequiredFor || null,
      BudgetYear: prfData.BudgetYear || null
    };
    
    const result = await executeQuery<PRF>(query, params);
    const prf = result.recordset[0];

    // Add PRF items if provided
    if (prfData.Items && prfData.Items.length > 0) {
      await this.addItems(prf.PRFID, prfData.Items);
    }

    return prf;
  }

  /**
   * Find PRF by ID
   */
  static async findById(prfId: number): Promise<PRF | null> {
    const query = `
      SELECT * FROM PRF WHERE PRFID = @PRFID
    `;
    
    const result = await executeQuery<PRF>(query, { PRFID: prfId });
    return (result.recordset[0] as PRF) || null;
  }

  /**
   * Find PRF by PRFNo
   */
  static async findByPRFNo(prfNo: string): Promise<PRF | null> {
    const query = `
      SELECT * FROM PRF WHERE PRFNo = @PRFNo
    `;
    
    const result = await executeQuery<PRF>(query, { PRFNo: prfNo });
    return (result.recordset[0] as PRF) || null;
  }

  /**
   * Get PRF with items
   */
  static async findByIdWithItems(prfId: number): Promise<(PRF & { Items: PRFItem[] }) | null> {
    const prf = await this.findById(prfId);
    if (!prf) return null;

    const items = await this.getItems(prfId);
    return { ...prf, Items: items };
  }

  /**
   * Update PRF
   */
  static async update(prfId: number, updateData: UpdatePRFRequest): Promise<PRF> {
    const setClause = [];
    const params: UpdatePRFParams = { PRFID: prfId };

    if (updateData.Title) {
      setClause.push('Title = @Title');
      params.Title = updateData.Title;
    }
    if (updateData.Description !== undefined) {
      setClause.push('Description = @Description');
      params.Description = updateData.Description;
    }
    if (updateData.Department) {
      setClause.push('Department = @Department');
      params.Department = updateData.Department;
    }
    if (updateData.COAID) {
      setClause.push('COAID = @COAID');
      params.COAID = updateData.COAID;
    }
    if (updateData.RequestedAmount) {
      setClause.push('RequestedAmount = @RequestedAmount');
      params.RequestedAmount = updateData.RequestedAmount;
    }
    if (updateData.Priority) {
      setClause.push('Priority = @Priority');
      params.Priority = updateData.Priority;
    }
    if (updateData.Status) {
      setClause.push('Status = @Status');
      params.Status = updateData.Status;
    }
    if (updateData.RequiredDate !== undefined) {
      setClause.push('RequiredDate = @RequiredDate');
      params.RequiredDate = updateData.RequiredDate;
    }
    if (updateData.ApprovedAmount !== undefined) {
      setClause.push('ApprovedAmount = @ApprovedAmount');
      params.ApprovedAmount = updateData.ApprovedAmount;
    }
    if (updateData.ActualAmount !== undefined) {
      setClause.push('ActualAmount = @ActualAmount');
      params.ActualAmount = updateData.ActualAmount;
    }
    if (updateData.ApprovalDate !== undefined) {
      setClause.push('ApprovalDate = @ApprovalDate');
      params.ApprovalDate = updateData.ApprovalDate;
    }
    if (updateData.CompletionDate !== undefined) {
      setClause.push('CompletionDate = @CompletionDate');
      params.CompletionDate = updateData.CompletionDate;
    }
    if (updateData.ApprovedBy !== undefined) {
      setClause.push('ApprovedBy = @ApprovedBy');
      params.ApprovedBy = updateData.ApprovedBy;
    }
    if (updateData.Justification !== undefined) {
      setClause.push('Justification = @Justification');
      params.Justification = updateData.Justification;
    }
    if (updateData.VendorName !== undefined) {
      setClause.push('VendorName = @VendorName');
      params.VendorName = updateData.VendorName;
    }
    if (updateData.VendorContact !== undefined) {
      setClause.push('VendorContact = @VendorContact');
      params.VendorContact = updateData.VendorContact;
    }
    if (updateData.Notes !== undefined) {
      setClause.push('Notes = @Notes');
      params.Notes = updateData.Notes;
    }
    if (updateData.DateSubmit !== undefined) {
      setClause.push('DateSubmit = @DateSubmit');
      params.DateSubmit = updateData.DateSubmit;
    }
    if (updateData.SubmitBy !== undefined) {
      setClause.push('SubmitBy = @SubmitBy');
      params.SubmitBy = updateData.SubmitBy;
    }
    if (updateData.SumDescriptionRequested !== undefined) {
      setClause.push('SumDescriptionRequested = @SumDescriptionRequested');
      params.SumDescriptionRequested = updateData.SumDescriptionRequested;
    }
    if (updateData.PurchaseCostCode !== undefined) {
      setClause.push('PurchaseCostCode = @PurchaseCostCode');
      params.PurchaseCostCode = updateData.PurchaseCostCode;
    }
    if (updateData.RequiredFor !== undefined) {
      setClause.push('RequiredFor = @RequiredFor');
      params.RequiredFor = updateData.RequiredFor;
    }
    if (updateData.BudgetYear !== undefined) {
      setClause.push('BudgetYear = @BudgetYear');
      params.BudgetYear = updateData.BudgetYear;
    }

    setClause.push('UpdatedAt = GETDATE()');

    const query = `
      UPDATE PRF 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE PRFID = @PRFID
    `;

    const result = await executeQuery<PRF>(query, params);
    const updatedPRF = result.recordset[0];

    // If Status was updated, cascade the status to all non-overridden items
    if (updateData.Status) {
      await this.cascadeStatusToItems(prfId, updateData.Status);
    }

    return updatedPRF;
  }

  /**
   * Delete PRF
   */
  static async delete(prfId: number): Promise<boolean> {
    const query = `DELETE FROM PRF WHERE PRFID = @PRFID`;
    const result = await executeQuery(query, { PRFID: prfId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get all PRFs with filtering and pagination
   */
  static async findAll(queryParams: PRFQueryParams): Promise<{ prfs: PRFSummary[], total: number }> {
    const {
      page = 1,
      limit = 10,
      Status,
      Department,
      Priority,
      RequestorID,
      COAID,
      DateFrom,
      DateTo,
      Search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: PRFQueryParams = { Offset: offset, Limit: limit };

    if (Status) {
      whereConditions.push('Status = @Status');
      params.Status = Status;
    }
    if (Department) {
      whereConditions.push('Department = @Department');
      params.Department = Department;
    }
    if (Priority) {
      whereConditions.push('Priority = @Priority');
      params.Priority = Priority;
    }
    if (RequestorID) {
      whereConditions.push('PRFID IN (SELECT PRFID FROM PRF WHERE RequestorID = @RequestorID)');
      params.RequestorID = RequestorID;
    }
    if (COAID) {
      whereConditions.push('PRFID IN (SELECT PRFID FROM PRF WHERE COAID = @COAID)');
      params.COAID = COAID;
    }
    if (DateFrom) {
      whereConditions.push('RequestDate >= @DateFrom');
      params.DateFrom = DateFrom;
    }
    if (DateTo) {
      whereConditions.push('RequestDate <= @DateTo');
      params.DateTo = DateTo;
    }
    if (Search) {
      whereConditions.push('(PRFNo LIKE @Search OR Title LIKE @Search OR SumDescriptionRequested LIKE @Search OR SubmitBy LIKE @Search OR RequiredFor LIKE @Search)');
      params.Search = `%${Search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM vw_PRFSummary
      ${whereClause}
      ORDER BY RequestDate DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) as Total 
      FROM vw_PRFSummary
      ${whereClause}
    `;

    const countParams = { ...params };
    delete countParams.Offset;
    delete countParams.Limit;

    const [prfsResult, countResult] = await Promise.all([
      executeQuery<PRFSummary>(query, params),
      executeQuery<{ Total: number }>(countQuery, countParams)
    ]);

    return {
      prfs: prfsResult.recordset,
      total: (countResult.recordset[0] as CountResult).Total
    };
  }

  /**
   * Find all PRFs with items (enhanced search includes PRF items)
   */
  static async findAllWithItems(queryParams: PRFQueryParams): Promise<{ prfs: (PRFSummary & { Items: PRFItem[] })[], total: number }> {
    const {
      page = 1,
      limit = 10,
      Status,
      Department,
      Priority,
      RequestorID,
      COAID,
      DateFrom,
      DateTo,
      Search
    } = queryParams;

    const offset = (page - 1) * limit;
    const whereConditions = [];
    const params: PRFQueryParams = { Offset: offset, Limit: limit };

    if (Status) {
      whereConditions.push('p.Status = @Status');
      params.Status = Status;
    }
    if (Department) {
      whereConditions.push('p.Department = @Department');
      params.Department = Department;
    }
    if (Priority) {
      whereConditions.push('p.Priority = @Priority');
      params.Priority = Priority;
    }
    if (RequestorID) {
      whereConditions.push('p.RequestorID = @RequestorID');
      params.RequestorID = RequestorID;
    }
    if (COAID) {
      whereConditions.push('p.COAID = @COAID');
      params.COAID = COAID;
    }
    if (DateFrom) {
      whereConditions.push('p.RequestDate >= @DateFrom');
      params.DateFrom = DateFrom;
    }
    if (DateTo) {
      whereConditions.push('p.RequestDate <= @DateTo');
      params.DateTo = DateTo;
    }
    if (Search) {
      // Enhanced search: include PRF fields AND PRF items fields
      whereConditions.push(`(
        p.PRFNo LIKE @Search OR 
        p.Title LIKE @Search OR 
        p.SumDescriptionRequested LIKE @Search OR 
        p.SubmitBy LIKE @Search OR 
        p.RequiredFor LIKE @Search OR
        p.Description LIKE @Search OR
        EXISTS (
          SELECT 1 FROM PRFItems pi 
          WHERE pi.PRFID = p.PRFID AND (
            pi.ItemName LIKE @Search OR 
            pi.Description LIKE @Search OR 
            pi.Specifications LIKE @Search
          )
        )
      )`);
      params.Search = `%${Search}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query to get PRFs with enhanced search
    const query = `
      SELECT DISTINCT p.* FROM vw_PRFSummary p
      ${whereClause}
      ORDER BY p.RequestDate DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.PRFID) as Total 
      FROM vw_PRFSummary p
      ${whereClause}
    `;

    const countParams = { ...params };
    delete countParams.Offset;
    delete countParams.Limit;

    const [prfsResult, countResult] = await Promise.all([
      executeQuery<PRFSummary>(query, params),
      executeQuery<{ Total: number }>(countQuery, countParams)
    ]);

    // Get items for each PRF
    const prfsWithItems = await Promise.all(
      prfsResult.recordset.map(async (prf) => {
        const items = await this.getItems(prf.PRFID);
        return { ...prf, Items: items };
      })
    );
    
    return {
      prfs: prfsWithItems,
      total: (countResult.recordset[0] as CountResult).Total
    };
  }

  /**
   * Add items to PRF
   */
  static async addItems(prfId: number, items: CreatePRFItemRequest[]): Promise<PRFItem[]> {
    const insertValues = items.map((_, index) => 
      `(@PRFID, @ItemName${index}, @Description${index}, @Quantity${index}, @UnitPrice${index}, @Specifications${index})`
    ).join(', ');

    const params: AddPRFItemsParams = { PRFID: prfId };
    items.forEach((item, index) => {
      params[`ItemName${index}`] = item.ItemName;
      params[`Description${index}`] = item.Description || null;
      params[`Quantity${index}`] = item.Quantity;
      params[`UnitPrice${index}`] = item.UnitPrice;
      params[`Specifications${index}`] = item.Specifications || null;
    });

    const query = `
      INSERT INTO PRFItems (PRFID, ItemName, Description, Quantity, UnitPrice, Specifications)
      OUTPUT INSERTED.*
      VALUES ${insertValues}
    `;

    const result = await executeQuery<PRFItem>(query, params);
    return result.recordset;
  }

  /**
   * Get PRF items
   */
  static async getItems(prfId: number): Promise<PRFItem[]> {
    const query = `
      SELECT * FROM PRFItems WHERE PRFID = @PRFID ORDER BY PRFItemID
    `;
    
    const result = await executeQuery<PRFItem>(query, { PRFID: prfId });
    return result.recordset;
  }

  /**
   * Update PRF item
   */
  static async updateItem(itemId: number, updateData: Partial<UpdatePRFItemParams>): Promise<PRFItem> {
    const setClause = [];
    const params: UpdatePRFItemParams = { PRFItemID: itemId };

    if (updateData.ItemName) {
      setClause.push('ItemName = @ItemName');
      params.ItemName = updateData.ItemName;
    }
    if (updateData.Description !== undefined) {
      setClause.push('Description = @Description');
      params.Description = updateData.Description;
    }
    if (updateData.Quantity) {
      setClause.push('Quantity = @Quantity');
      params.Quantity = updateData.Quantity;
    }
    if (updateData.UnitPrice) {
      setClause.push('UnitPrice = @UnitPrice');
      params.UnitPrice = updateData.UnitPrice;
    }
    if (updateData.Specifications !== undefined) {
      setClause.push('Specifications = @Specifications');
      params.Specifications = updateData.Specifications;
    }
    if (updateData.Status !== undefined) {
      setClause.push('Status = @Status');
      params.Status = updateData.Status;
      // When status is manually changed, mark as overridden
      setClause.push('StatusOverridden = @StatusOverridden');
      params.StatusOverridden = true;
    }
    if (updateData.PickedUpBy !== undefined) {
      setClause.push('PickedUpBy = @PickedUpBy');
      params.PickedUpBy = updateData.PickedUpBy;
    }
    if (updateData.PickedUpDate !== undefined) {
      setClause.push('PickedUpDate = @PickedUpDate');
      params.PickedUpDate = updateData.PickedUpDate;
    }
    if (updateData.Notes !== undefined) {
      setClause.push('Notes = @Notes');
      params.Notes = updateData.Notes;
    }
    if (updateData.UpdatedBy !== undefined) {
      setClause.push('UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE()');
      params.UpdatedBy = updateData.UpdatedBy;
    }
    if (updateData.StatusOverridden !== undefined) {
      setClause.push('StatusOverridden = @StatusOverridden');
      params.StatusOverridden = updateData.StatusOverridden;
      
      // If resetting override to false, cascade PRF status to this item
      if (updateData.StatusOverridden === false) {
        const prfQuery = `SELECT Status FROM PRF WHERE PRFID = (SELECT PRFID FROM PRFItems WHERE PRFItemID = @PRFItemID)`;
        const prfResult = await executeQuery<{ Status: string }>(prfQuery, { PRFItemID: itemId });
        
        if (prfResult.recordset.length > 0) {
          const prfStatus = prfResult.recordset[0].Status;
          const mappedStatus = this.mapPRFStatusToItemStatus(prfStatus);
          setClause.push('Status = @CascadedStatus');
          params.CascadedStatus = mappedStatus;
        }
      }
    }

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE PRFItems 
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE PRFItemID = @PRFItemID
    `;

    const result = await executeQuery<PRFItem>(query, params);
    return result.recordset[0] as PRFItem;
  }

  /**
   * Delete PRF item
   */
  static async deleteItem(itemId: number): Promise<boolean> {
    const query = `DELETE FROM PRFItems WHERE PRFItemID = @PRFItemID`;
    const result = await executeQuery(query, { PRFItemID: itemId });
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get PRF statistics
   */
  static async getStatistics(): Promise<PRFStatistics> {
    const query = `
      SELECT 
        COUNT(*) as TotalPRFs,
        SUM(CASE WHEN Status IN ('Draft', 'Submitted', 'Under Review') THEN 1 ELSE 0 END) as PendingPRFs,
        SUM(CASE WHEN Status = 'Approved' THEN 1 ELSE 0 END) as ApprovedPRFs,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) as CompletedPRFs,
        SUM(CASE WHEN Status = 'Rejected' THEN 1 ELSE 0 END) as RejectedPRFs,
        SUM(RequestedAmount) as TotalRequestedAmount,
        SUM(COALESCE(ApprovedAmount, RequestedAmount)) as TotalApprovedAmount,
        AVG(DATEDIFF(day, RequestDate, COALESCE(ApprovalDate, GETDATE()))) as AvgProcessingDays
      FROM PRF
      WHERE RequestDate >= DATEADD(year, -1, GETDATE())
    `;

    const result = await executeQuery(query);
    return result.recordset[0] as PRFStatistics;
  }

  /**
   * Get unique status values from database
   */
  static async getUniqueStatusValues(): Promise<string[]> {
    const query = `
      SELECT DISTINCT Status
      FROM PRF
      WHERE Status IS NOT NULL AND Status != ''
      ORDER BY Status
    `;

    const result = await executeQuery<{ Status: string }>(query);
    return result.recordset.map(row => row.Status);
  }

  /**
   * Map legacy PRF status values to valid PRFItems status values
   */
  private static mapPRFStatusToItemStatus(prfStatus: string): string {
    // Map legacy PRF status values to valid PRFItems constraint values
    const statusMapping: { [key: string]: string } = {
      'Req. Approved': 'Approved',
      'Req. Approved 2': 'Approved',
      'Completed': 'Picked Up',
      'In transit': 'Approved',
      'On order': 'Approved',
      'Rejected': 'Cancelled',
      'Cancelled': 'Cancelled',
      'On Hold': 'On Hold',
      // Handle any "Updated:" prefixed statuses as Pending
    };

    // Handle "Updated:" prefixed statuses
    if (prfStatus.toLowerCase().startsWith('updated:')) {
      return 'Pending';
    }

    // Return mapped status or default to 'Pending' if not found
    return statusMapping[prfStatus] || 'Pending';
  }

  /**
   * Cascade status update to all non-overridden items
   */
  private static async cascadeStatusToItems(prfId: number, newStatus: string): Promise<void> {
    // Map the PRF status to a valid PRFItems status
    const mappedStatus = this.mapPRFStatusToItemStatus(newStatus);
    
    const query = `
      UPDATE PRFItems 
      SET Status = @Status, UpdatedAt = GETDATE()
      WHERE PRFID = @PRFID 
        AND (StatusOverridden IS NULL OR StatusOverridden = 0)
    `;

    await executeQuery(query, {
      PRFID: prfId,
      Status: mappedStatus
    });
  }
}