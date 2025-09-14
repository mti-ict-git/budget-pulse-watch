# Budget Pulse Watch API Documentation

## Overview

The Budget Pulse Watch API is a RESTful API built with Node.js, Express, and TypeScript that provides comprehensive budget management and Purchase Request Form (PRF) monitoring capabilities.

### Base URL
```
http://localhost:3001/api
```

### Current Implementation Status

**✅ Fully Implemented:**
- PRF Management (`/api/prfs`) - Complete CRUD operations with search and filtering
- Budget Management (`/api/budgets`) - Full budget tracking and utilization
- Chart of Accounts (`/api/coa`) - Account structure management
- Import/Export (`/api/import`) - Excel file processing and validation

**🚧 In Development:**
- Authentication (`/api/auth`) - Routes defined but not integrated
- Reports (`/api/reports`) - Routes defined but not integrated

**📋 Health Check:**
- `GET /health` - API health status endpoint

### Authentication
The API uses session-based authentication with secure HTTP-only cookies.

### Response Format
All API responses follow a consistent format:

```json
{
  "success": boolean,
  "message": string,
  "data": object | array | null,
  "error": string | null
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## API Endpoints Overview

### Core Modules

1. **PRF Management** (`/api/prfs`)
   - Create, read, update, delete PRFs
   - Manage PRF items and specifications
   - Advanced search and filtering
   - Status management and workflow

2. **Budget Management** (`/api/budgets`)
   - Budget allocation and tracking
   - Budget vs actual spending analysis
   - Department and project budget management

3. **Chart of Accounts** (`/api/coa`)
   - Account structure management
   - Account hierarchy and categorization
   - Financial reporting structure

4. **Import/Export** (`/api/import`)
   - Excel file import for PRFs and budgets
   - Data validation and error handling
   - Bulk operations and templates

5. **Authentication** (`/api/auth`) - *Coming Soon*
   - User login and logout
   - Session management
   - Role-based access control
   - *Note: Authentication routes are defined but not yet active in the main application*

6. **Reports** (`/api/reports`) - *Coming Soon*
   - Financial reports and analytics
   - Custom report generation
   - Data export capabilities
   - *Note: Reports routes are defined but not yet active in the main application*

---

## Health Check Endpoint

### GET /health
Check API health status and availability.

**Response:**
```json
{
  "status": "OK",
  "message": "PRF Monitoring API is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 1. PRF Management Endpoints

### GET /api/prfs
Retrieve all PRFs with optional filtering and pagination.

**Query Parameters:**
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of items per page (default: 10)
- `status` (string, optional): Filter by PRF status
- `priority` (string, optional): Filter by priority level
- `department` (string, optional): Filter by department
- `search` (string, optional): Search across PRF fields

**Response:**
```json
{
  "success": true,
  "message": "PRFs retrieved successfully",
  "data": {
    "prfs": [
      {
        "id": 1,
        "prfNo": "PRF-2024-001",
        "title": "Office Equipment Purchase",
        "description": "Purchase of laptops and monitors",
        "status": "pending",
        "priority": "high",
        "totalAmount": 50000.00,
        "requestedBy": "John Doe",
        "department": "IT",
        "dateRequested": "2024-01-15T10:30:00Z",
        "dateNeeded": "2024-02-01T00:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

### GET /api/prfs/with-items
Retrieve PRFs with their associated items and detailed information.

**Query Parameters:**
- Same as `/api/prfs` plus:
- `includeItems` (boolean, optional): Include PRF items in response (default: true)
- `includeSpecs` (boolean, optional): Include item specifications (default: false)

**Response:**
```json
{
  "success": true,
  "message": "PRFs with items retrieved successfully",
  "data": [
    {
      "id": 1,
      "prfNo": "PRF-2024-001",
      "title": "Office Equipment Purchase",
      "items": [
        {
          "id": 1,
          "itemName": "Dell Laptop",
          "description": "High-performance laptop for development",
          "quantity": 5,
          "unitPrice": 8000.00,
          "totalPrice": 40000.00,
          "specifications": [
            {
              "id": 1,
              "specName": "Processor",
              "specValue": "Intel i7-12700H"
            }
          ]
        }
      ]
    }
  ]
}
```

### GET /api/prfs/:id
Retrieve a specific PRF by ID.

**Path Parameters:**
- `id` (number): PRF ID

**Response:**
```json
{
  "success": true,
  "message": "PRF retrieved successfully",
  "data": {
    "id": 1,
    "prfNo": "PRF-2024-001",
    "title": "Office Equipment Purchase",
    "description": "Purchase of laptops and monitors",
    "status": "pending",
    "priority": "high",
    "totalAmount": 50000.00,
    "requestedBy": "John Doe",
    "department": "IT",
    "dateRequested": "2024-01-15T10:30:00Z",
    "dateNeeded": "2024-02-01T00:00:00Z",
    "items": [
      {
        "id": 1,
        "itemName": "Dell Laptop",
        "description": "High-performance laptop for development",
        "quantity": 5,
        "unitPrice": 8000.00,
        "totalPrice": 40000.00
      }
    ]
  }
}
```

### POST /api/prfs
Create a new PRF.

**Request Body:**
```json
{
  "title": "Office Equipment Purchase",
  "description": "Purchase of laptops and monitors",
  "priority": "high",
  "department": "IT",
  "dateNeeded": "2024-02-01T00:00:00Z",
  "justification": "Current equipment is outdated",
  "items": [
    {
      "itemName": "Dell Laptop",
      "description": "High-performance laptop for development",
      "quantity": 5,
      "unitPrice": 8000.00,
      "specifications": [
        {
          "specName": "Processor",
          "specValue": "Intel i7-12700H"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "PRF created successfully",
  "data": {
    "id": 1,
    "prfNo": "PRF-2024-001",
    "title": "Office Equipment Purchase",
    "status": "draft",
    "totalAmount": 40000.00
  }
}
```

### PUT /api/prfs/:id
Update an existing PRF.

**Path Parameters:**
- `id` (number): PRF ID

**Request Body:**
```json
{
  "title": "Updated Office Equipment Purchase",
  "description": "Updated description",
  "priority": "medium",
  "status": "pending"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PRF updated successfully",
  "data": {
    "id": 1,
    "prfNo": "PRF-2024-001",
    "title": "Updated Office Equipment Purchase",
    "status": "pending"
  }
}
```

### DELETE /api/prfs/:id
Delete a PRF.

**Path Parameters:**
- `id` (number): PRF ID

**Response:**
```json
{
  "success": true,
  "message": "PRF deleted successfully",
  "data": null
}
```

### GET /api/prfs/status-values
Retrieve available PRF status values.

**Response:**
```json
{
  "success": true,
  "message": "Status values retrieved successfully",
  "data": [
    "draft",
    "pending",
    "approved",
    "rejected",
    "completed",
    "cancelled"
  ]
}
```

### POST /api/prfs/bulk-update
Update multiple PRFs in bulk.

**Request Body:**
```json
{
  "prfIds": [1, 2, 3],
  "updates": {
    "status": "approved",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "PRFs updated successfully",
  "data": {
    "updatedCount": 3,
    "failedIds": []
  }
}
```

---

## 2. Budget Management Endpoints

### GET /api/budgets
Retrieve budget information with filtering options.

**Query Parameters:**
- `department` (string, optional): Filter by department
- `year` (number, optional): Filter by fiscal year
- `category` (string, optional): Filter by budget category

**Response:**
```json
{
  "success": true,
  "message": "Budgets retrieved successfully",
  "data": [
    {
      "id": 1,
      "department": "IT",
      "category": "Equipment",
      "allocatedAmount": 100000.00,
      "spentAmount": 45000.00,
      "remainingAmount": 55000.00,
      "fiscalYear": 2024
    }
  ]
}
```

### GET /api/budgets/summary
Retrieve budget summary and analytics.

**Response:**
```json
{
  "success": true,
  "message": "Budget summary retrieved successfully",
  "data": {
    "totalAllocated": 1000000.00,
    "totalSpent": 450000.00,
    "totalRemaining": 550000.00,
    "utilizationRate": 45.0,
    "departmentBreakdown": [
      {
        "department": "IT",
        "allocated": 200000.00,
        "spent": 90000.00,
        "utilizationRate": 45.0
      }
    ]
  }
}
```

---

## 3. Chart of Accounts Endpoints

### GET /api/coa
Retrieve chart of accounts structure.

**Response:**
```json
{
  "success": true,
  "message": "Chart of accounts retrieved successfully",
  "data": [
    {
      "id": 1,
      "accountCode": "1000",
      "accountName": "Assets",
      "accountType": "Asset",
      "parentId": null,
      "level": 1,
      "isActive": true
    }
  ]
}
```

---

## 4. Import/Export Endpoints

### POST /api/import/prf/validate
Validate Excel file before importing PRF data.

**Request:**
- Content-Type: `multipart/form-data`
- File field: `file` (Excel file)

**Response:**
```json
{
  "success": true,
  "message": "File validation completed",
  "data": {
    "filename": "prf_data.xlsx",
    "fileSize": 1024000,
    "prfValidation": {
      "totalRecords": 100,
      "validRecords": 95,
      "invalidRecords": 5,
      "errors": [
        {
          "row": 10,
          "field": "unitPrice",
          "message": "Invalid price format"
        }
      ],
      "warnings": []
    },
    "summary": {
      "totalPRFRecords": 100,
      "validPRFRecords": 95,
      "totalErrors": 5,
      "totalWarnings": 0
    }
  }
}
```

### POST /api/import/prf/bulk
Import PRF data from Excel file.

**Request:**
- Content-Type: `multipart/form-data`
- File field: `file` (Excel file)
- Form fields:
  - `validateOnly` (boolean): Only validate, don't import
  - `skipDuplicates` (boolean): Skip duplicate records
  - `updateExisting` (boolean): Update existing records

**Response:**
```json
{
  "success": true,
  "message": "PRF data imported successfully",
  "data": {
    "importedRecords": 95,
    "skippedRecords": 5,
    "errors": [],
    "warnings": [],
    "summary": {
      "totalProcessed": 100,
      "successfulImports": 95,
      "failedImports": 5
    }
  }
}
```

### GET /api/import/prf/template
Download Excel template for PRF import.

**Response:**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File download: `prf_import_template.xlsx`

### GET /api/import/prf/history
Retrieve import history and logs.

**Query Parameters:**
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page
- `startDate` (string, optional): Filter from date
- `endDate` (string, optional): Filter to date

**Response:**
```json
{
  "success": true,
  "message": "Import history retrieved successfully",
  "data": {
    "imports": [
      {
        "id": 1,
        "filename": "prf_data.xlsx",
        "importDate": "2024-01-15T10:30:00Z",
        "status": "completed",
        "recordsProcessed": 100,
        "recordsImported": 95,
        "recordsFailed": 5,
        "importedBy": "admin@example.com"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25
    }
  }
}
```

---

## 5. Authentication Endpoints

### POST /api/auth/login
Authenticate user and create session.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "department": "IT"
    }
  }
}
```

### POST /api/auth/logout
Logout user and destroy session.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

### GET /api/auth/me
Get current user information.

**Response:**
```json
{
  "success": true,
  "message": "User information retrieved",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "department": "IT"
    }
  }
}
```

---

## 6. Reports Endpoints

### GET /api/reports/prf-summary
Generate PRF summary report.

**Query Parameters:**
- `startDate` (string, optional): Report start date
- `endDate` (string, optional): Report end date
- `department` (string, optional): Filter by department
- `status` (string, optional): Filter by status

**Response:**
```json
{
  "success": true,
  "message": "PRF summary report generated",
  "data": {
    "reportPeriod": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "summary": {
      "totalPRFs": 150,
      "totalAmount": 2500000.00,
      "averageAmount": 16666.67,
      "statusBreakdown": {
        "pending": 45,
        "approved": 80,
        "rejected": 15,
        "completed": 10
      }
    },
    "departmentBreakdown": [
      {
        "department": "IT",
        "prfCount": 50,
        "totalAmount": 1000000.00
      }
    ]
  }
}
```

### GET /api/reports/budget-utilization
Generate budget utilization report.

**Response:**
```json
{
  "success": true,
  "message": "Budget utilization report generated",
  "data": {
    "overallUtilization": 65.5,
    "departments": [
      {
        "department": "IT",
        "allocated": 200000.00,
        "spent": 130000.00,
        "utilization": 65.0,
        "remaining": 70000.00
      }
    ],
    "trends": [
      {
        "month": "2024-01",
        "spending": 45000.00,
        "budget": 50000.00
      }
    ]
  }
}
```

---

## Data Models

### PRF Model
```typescript
interface PRF {
  id: number;
  prfNo: string;
  title: string;
  description?: string;
  status: string; // Actual values from Pronto system: 'Cancelled', 'Completed', 'On order', 'Updated:DOMTU010017', etc.
  priority: 'low' | 'medium' | 'high' | 'urgent';
  totalAmount: number;
  requestedBy: string;
  department: string;
  dateRequested: Date;
  dateNeeded: Date;
  justification?: string;
  approvedBy?: string;
  approvedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### PRF Item Model
```typescript
interface PRFItem {
  id: number;
  prfId: number;
  itemName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  vendor?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### PRF Item Specification Model
```typescript
interface PRFItemSpecification {
  id: number;
  prfItemId: number;
  specName: string;
  specValue: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Budget Model
```typescript
interface Budget {
  id: number;
  department: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  fiscalYear: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "data": null
}
```

### Common Error Codes
- `400` - Bad Request: Invalid request parameters or body
- `401` - Unauthorized: Authentication required
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource not found
- `409` - Conflict: Resource already exists or conflict
- `422` - Unprocessable Entity: Validation errors
- `500` - Internal Server Error: Server-side error

### Validation Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Invalid input data",
  "data": {
    "validationErrors": [
      {
        "field": "title",
        "message": "Title is required"
      },
      {
        "field": "unitPrice",
        "message": "Unit price must be a positive number"
      }
    ]
  }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **General endpoints**: 100 requests per minute per IP
- **Authentication endpoints**: 5 requests per minute per IP
- **File upload endpoints**: 10 requests per minute per IP

---

## Testing

### Using cURL

#### Get all PRFs
```bash
curl -X GET "http://localhost:3001/api/prfs?page=1&limit=10" \
  -H "Content-Type: application/json"
```

#### Create a new PRF
```bash
curl -X POST "http://localhost:3001/api/prfs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test PRF",
    "description": "Test description",
    "priority": "medium",
    "department": "IT",
    "dateNeeded": "2024-02-01T00:00:00Z"
  }'
```

#### Upload Excel file for validation
```bash
curl -X POST "http://localhost:3001/api/import/prf/validate" \
  -F "file=@prf_data.xlsx"
```

#### Check API health
```bash
curl -X GET "http://localhost:3001/health" \
  -H "Content-Type: application/json"
```

### Using Postman

1. Import the API collection (if available)
2. Set the base URL to `http://localhost:3001/api`
3. Configure authentication headers if required
4. Test endpoints with sample data
5. Use the health check endpoint (`GET http://localhost:3001/health`) to verify API availability

---

## Changelog

### Version 1.0.0 (Current)
- Initial API implementation
- PRF management endpoints
- Budget tracking endpoints
- Excel import/export functionality
- Authentication and authorization
- Comprehensive search and filtering

---

## Support

For API support and questions:
- Check the error response messages for detailed information
- Review the validation requirements for each endpoint
- Ensure proper authentication and permissions
- Contact the development team for technical issues

---

*Last updated: January 2024*
*API Version: 1.0.0*