import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Plus, Edit, Trash2, RefreshCw, Download, Archive, CheckSquare, ChevronDown, ChevronRight, Expand, Minimize } from "lucide-react";
import { PRFDetailDialog } from "@/components/prf/PRFDetailDialog";
import { ExcelImportDialog } from "@/components/prf/ExcelImportDialog";

// PRF Item interface
interface PRFItem {
  ItemID: number;
  PRFID: number;
  ItemName: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  Specifications?: string;
}

// PRF data interface
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
  items?: PRFItem[];
}

// Raw API data interface (from backend)
interface PRFRawData {
  PRFID?: number;
  PRFNo?: string;
  RequestDate?: string;
  DateSubmit?: string;
  RequestorName?: string;
  SubmitBy?: string;
  Title?: string;
  Description?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequestedAmount?: number;
  Amount?: number;
  RequiredFor?: string;
  BudgetYear?: number;
  Department?: string;
  Priority?: string;
  Status?: string;
  UpdatedAt?: string;
  LastUpdate?: string;
  Items?: PRFItem[];
}

// API response interface
interface PRFApiResponse {
  success: boolean;
  data: PRFRawData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const getStatusBadge = (status: string) => {
  // Use the actual status value from Excel without modification
  const displayStatus = status || 'Unknown';
  
  // Determine badge variant based on common status patterns
  const getVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('approved') || lowerStatus.includes('complete')) {
      return 'success';
    }
    if (lowerStatus.includes('reject') || lowerStatus.includes('cancel') || lowerStatus.includes('denied')) {
      return 'destructive';
    }
    if (lowerStatus.includes('pending') || lowerStatus.includes('review') || lowerStatus.includes('pronto')) {
      return 'secondary';
    }
    if (lowerStatus.includes('draft') || lowerStatus.includes('hold')) {
      return 'outline';
    }
    return 'default';
  };
  
  return <Badge variant={getVariant(displayStatus)}>{displayStatus}</Badge>;
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

export default function PRFMonitoring() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [prfData, setPrfData] = useState<PRFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [availableStatusValues, setAvailableStatusValues] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Fetch PRF data from API
  const fetchPRFData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(departmentFilter !== 'all' && { department: departmentFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(yearFilter !== 'all' && { year: yearFilter })
      });

      const response = await fetch(`http://localhost:3001/api/prfs/with-items?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: PRFApiResponse = await response.json();
      
      if (result.success) {
        // Transform API data to match frontend interface
        // Debug: Log the raw data to see what Status values we're getting
        console.log('Raw PRF data from API:', result.data.slice(0, 3));
        console.log('Status values:', result.data.map(prf => prf.Status));
        
        const transformedData = result.data.map((prf: PRFRawData) => ({
          id: prf.PRFID?.toString() || '',
          prfNo: prf.PRFNo || '',
          dateSubmit: prf.DateSubmit || prf.RequestDate || '',
          submitBy: prf.SubmitBy || prf.RequestorName || '',
          description: prf.Title || prf.Description || '',
          sumDescriptionRequested: prf.SumDescriptionRequested || '',
          purchaseCostCode: prf.PurchaseCostCode || '',
          amount: prf.RequestedAmount || prf.Amount || 0,
          requiredFor: prf.RequiredFor || '',
          budgetYear: prf.BudgetYear || new Date().getFullYear(),
          department: prf.Department || '',
          priority: prf.Priority || 'Medium',
          progress: prf.Status || 'pending',
          lastUpdate: prf.UpdatedAt || prf.LastUpdate || prf.RequestDate || '',
          items: prf.Items || []
        }));
        
        // Debug: Log the transformed data to see what progress values we have
        console.log('Transformed data progress values:', transformedData.map(prf => prf.progress));
        
        setPrfData(transformedData);
        setPagination(result.pagination);
      } else {
        throw new Error('Failed to fetch PRF data');
      }
    } catch (err) {
      console.error('Error fetching PRF data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch PRF data');
      setPrfData([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch available status values from API
  const fetchStatusValues = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/prfs/filters/status');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAvailableStatusValues(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching status values:', error);
      // Fallback to empty array if fetch fails
      setAvailableStatusValues([]);
    }
  };

  // Fetch status values on component mount
  useEffect(() => {
    fetchStatusValues();
  }, []);

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchPRFData();
    setSelectedItems(new Set()); // Clear selections when data changes
  }, [pagination.page, pagination.limit, statusFilter, departmentFilter, priorityFilter, yearFilter]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.page === 1) {
        fetchPRFData();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Since filtering is now done on the backend, we use prfData directly
  const filteredData = prfData;

  // Toggle row expansion
  const toggleRowExpansion = (prfId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prfId)) {
        newSet.delete(prfId);
      } else {
        newSet.add(prfId);
      }
      return newSet;
    });
  };

  // Expand all rows that have items
  const expandAllRows = () => {
    const expandableRows = filteredData
      .filter(prf => prf.items && prf.items.length > 0)
      .map(prf => prf.id);
    setExpandedRows(new Set(expandableRows));
  };

  // Collapse all rows
  const collapseAllRows = () => {
    setExpandedRows(new Set());
  };

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredData.map(prf => prf.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkExport = () => {
    console.log('Exporting selected items:', Array.from(selectedItems));
    // TODO: Implement bulk export functionality
  };

  const handleBulkArchive = () => {
    console.log('Archiving selected items:', Array.from(selectedItems));
    // TODO: Implement bulk archive functionality
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} selected PRF records? This action cannot be undone.`)) {
      try {
        setLoading(true);
        const ids = Array.from(selectedItems);
        
        const response = await fetch('http://localhost:3001/api/prfs/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ids: ids.map(id => parseInt(id, 10)) }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Show success message
          alert(`Successfully deleted ${result.data.deletedCount} PRF records`);
          
          // Clear selection and refresh data
          setSelectedItems(new Set());
          await fetchPRFData();
        } else {
          throw new Error(result.message || 'Failed to delete PRF records');
        }
      } catch (error) {
        console.error('Error deleting PRF records:', error);
        alert(`Error deleting PRF records: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkStatusUpdate = (newStatus: string) => {
    console.log('Updating status for selected items:', Array.from(selectedItems), 'to:', newStatus);
    // TODO: Implement bulk status update functionality
  };

  const handlePageSizeChange = (newLimit: string) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PRF Monitoring</h1>
          <p className="text-muted-foreground">
            Track and manage Purchase Request Forms with enhanced Excel field support
          </p>
        </div>
        <div className="flex gap-2">
          <ExcelImportDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by PRF No, description, submit by, or required for..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {availableStatusValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              PRF List ({pagination.total} items)
              {loading && <span className="text-sm text-muted-foreground ml-2">Loading...</span>}
              {selectedItems.size > 0 && (
                <span className="text-sm text-blue-600 ml-2">({selectedItems.size} selected)</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pagination.limit.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Bulk Actions */}
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="h-4 w-4 mr-1" />
                    Export ({selectedItems.size})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkArchive}>
                    <Archive className="h-4 w-4 mr-1" />
                    Archive ({selectedItems.size})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedItems.size})
                  </Button>
                  <Select onValueChange={handleBulkStatusUpdate}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">Error loading PRF data: {error}</p>
              <Button onClick={() => fetchPRFData()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Expand/Collapse All Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={expandAllRows}
                    disabled={loading || filteredData.filter(prf => prf.items && prf.items.length > 0).length === 0}
                  >
                    <Expand className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={collapseAllRows}
                    disabled={loading || expandedRows.size === 0}
                  >
                    <Minimize className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredData.filter(prf => prf.items && prf.items.length > 0).length} expandable rows
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>PRF No</TableHead>
                    <TableHead>Date Submit</TableHead>
                    <TableHead>Submit By</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost Code</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Required For</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Budget Year</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Loading PRF data...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                        No PRF data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((prf) => (
                      <>
                        <TableRow 
                          key={prf.id} 
                          className={`${prf.items && prf.items.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => prf.items && prf.items.length > 0 && toggleRowExpansion(prf.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(prf.id)}
                              onChange={(e) => handleSelectItem(prf.id, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell>
                            {prf.items && prf.items.length > 0 && (
                              <div className="flex items-center justify-center">
                                {expandedRows.has(prf.id) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{prf.prfNo}</span>
                              {prf.items && prf.items.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {prf.items.length} items
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(prf.dateSubmit).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell>{prf.submitBy}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={prf.description}>{prf.description}</TableCell>
                          <TableCell className="font-mono text-sm">{prf.purchaseCostCode}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(prf.amount)}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={prf.requiredFor}>{prf.requiredFor}</TableCell>
                          <TableCell><Badge variant="outline">{prf.department}</Badge></TableCell>
                          <TableCell>{getPriorityBadge(prf.priority)}</TableCell>
                          <TableCell>{prf.budgetYear}</TableCell>
                          <TableCell>{getStatusBadge(prf.progress)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <PRFDetailDialog prf={prf} />
                              <Button variant="ghost" size="sm" title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(prf.id) && prf.items && prf.items.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={14} className="bg-gray-50 p-0">
                              <div className="p-4">
                                <h4 className="font-medium mb-3 text-sm text-gray-700">PRF Items ({prf.items.length})</h4>
                                <div className="space-y-2">
                                  {prf.items.map((item, index) => (
                                    <div key={item.ItemID} className="flex items-center justify-between p-3 bg-white rounded border">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{item.ItemName}</div>
                                        {item.Description && (
                                          <div className="text-xs text-gray-600 mt-1">{item.Description}</div>
                                        )}
                                        {item.Specifications && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Specs: {JSON.parse(item.Specifications).originalRow ? `Row ${JSON.parse(item.Specifications).originalRow}` : 'N/A'}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-medium">{formatCurrency(item.UnitPrice)}</div>
                                        <div className="text-xs text-gray-500">Qty: {item.Quantity}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1 || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}