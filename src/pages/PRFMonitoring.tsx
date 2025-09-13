import { useState } from "react";
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
import { Search, Filter, Plus, Eye } from "lucide-react";

// Mock PRF data
const prfData = [
  {
    id: "PRF-2024-248",
    dateSubmit: "2024-01-15",
    submitBy: "John Doe",
    description: "Office Supplies for Q1",
    purchaseCostCode: "COA-001",
    amount: 2500000,
    requiredFor: "Finance Department",
    picPickup: "Jane Smith",
    buyer: "Procurement Team",
    headOfBuyer: "Mike Johnson",
    progress: "pending",
    lastUpdate: "2024-01-15"
  },
  {
    id: "PRF-2024-247",
    dateSubmit: "2024-01-14",
    submitBy: "Jane Smith",
    description: "Software License Renewal",
    purchaseCostCode: "COA-003",
    amount: 750000,
    requiredFor: "IT Department",
    picPickup: "Bob Wilson",
    buyer: "IT Procurement",
    headOfBuyer: "Sarah Davis",
    progress: "approved",
    lastUpdate: "2024-01-14"
  },
  {
    id: "PRF-2024-246",
    dateSubmit: "2024-01-13",
    submitBy: "Bob Wilson",
    description: "Network Equipment",
    purchaseCostCode: "COA-002",
    amount: 1200000,
    requiredFor: "IT Infrastructure",
    picPickup: "Alice Johnson",
    buyer: "Tech Team",
    headOfBuyer: "Mike Johnson",
    progress: "over_budget",
    lastUpdate: "2024-01-13"
  }
];

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: { label: "Pending", variant: "secondary" as const },
    approved: { label: "Approved", variant: "default" as const },
    completed: { label: "Completed", variant: "success" as const },
    over_budget: { label: "Over Budget", variant: "destructive" as const }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig];
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
  const [yearFilter, setYearFilter] = useState("2024");

  const filteredData = prfData.filter(prf => {
    const matchesSearch = prf.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prf.submitBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prf.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || prf.progress === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">PRF Monitoring</h1>
          <p className="text-muted-foreground">
            Track and manage Purchase Request Forms
          </p>
        </div>
        <Button className="w-fit">
          <Plus className="h-4 w-4" />
          New PRF
        </Button>
      </div>

      {/* Filters */}
      <Card className="dashboard-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PRFs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="over_budget">Over Budget</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PRF Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            PRF List
            <Badge variant="secondary">{filteredData.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PRF No</TableHead>
                  <TableHead>Date Submit</TableHead>
                  <TableHead>Submit By</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((prf) => (
                  <TableRow key={prf.id}>
                    <TableCell className="font-medium">{prf.id}</TableCell>
                    <TableCell>{new Date(prf.dateSubmit).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell>{prf.submitBy}</TableCell>
                    <TableCell>{prf.description}</TableCell>
                    <TableCell>{formatCurrency(prf.amount)}</TableCell>
                    <TableCell>{getStatusBadge(prf.progress)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}