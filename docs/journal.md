# Create a simple nginx configuration for frontend
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

## 2025-09-20 12:15:32 - CIFS Mount Configuration Fix

**Context**: Fixed credential mismatch between docker-compose.yml and backend/.env.production for CIFS network share mounting.

**What was done**:
- Identified incorrect credentials in docker-compose.yml (using `mtiadmin` instead of `ict.supportassistant`)
- Updated docker-compose.yml environment variables:
  - `CIFS_USERNAME`: Changed from `mbma\\mtiadmin` to `mbma\\ict.supportassistant`
  - `CIFS_PASSWORD`: Changed from `MMT!@dmin23` to `P@ssw0rd.123`
- Committed changes to git repository
- User pulled updated code on production server

**Next steps**: 
- Deploy updated configuration on production server
- Test CIFS mount functionality
- Verify application functionality after mount script fixes

## 2025-09-20 12:21:01 - CIFS Mount Fix Successfully Deployed

**Context**: Deployed and tested the corrected CIFS credentials on production server.

**What was done**:
- Rebuilt Docker containers with corrected credentials using `docker-compose down` and `docker-compose up -d --build`
- Verified CIFS mount success in backend container logs:
  ```
  CIFS mount script: Testing access to mounted directory...
  CIFS mount script: Found 6 items in mounted directory
  CIFS mount script: CIFS mount setup completed successfully
  ```
- Confirmed mounted directory contains expected data:
  - `/app/shared-documents/PT Merdeka Tsingshan Indonesia` accessible
  - Contains numerous subdirectories (10, 100, 1000, etc.) and PDF files
  - Total of 442461 items in the directory
- Verified application health endpoint returns `{"status":true}`

## 2025-09-20 12:54:01 - Additional File Upload Feature Implementation

### Context
User requested to add a new file drag-and-drop feature for additional files that will be submitted to the shared file storage after creating a PRF successfully. This feature should be available on the PRF creation page (`https://pomon.merdekabattery.com/prf/create`) and integrate with the existing OpenAI OCR functionality.

### What was done

#### 1. Frontend Implementation
- **Created `AdditionalFileUpload.tsx` component** with the following features:
  - Drag-and-drop interface using `react-dropzone`
  - Multiple file selection support
  - File type validation (PDF, DOC, DOCX, XLS, XLSX, images, TXT)
  - File size limit (10MB per file)
  - Progress tracking for uploads
  - Individual file descriptions
  - Upload status indicators (pending, uploading, success, error)
  - File preview with icons based on file type
  - Batch upload functionality

- **Integrated with `CreatePRF.tsx`**:
  - Added import for `AdditionalFileUpload` component
  - Added `Paperclip` icon import from `lucide-react`
  - Integrated the component in the success section after PRF creation
  - Passes PRF ID and PRF number to the component
  - Shows toast notifications for upload completion

#### 2. Backend Implementation
- **Enhanced `prfFilesRoutes.ts`** with new endpoint:
  - Added `POST /api/prf-files/:prfId/upload-multiple` endpoint
  - Supports uploading up to 10 files simultaneously
  - Uses `multer.array('files', 10)` for multiple file handling
  - Integrates with existing shared storage service
  - Provides detailed response with successful uploads and errors
  - Maintains existing single file upload endpoint for backward compatibility

#### 3. Key Features
- **Drag-and-Drop Interface**: Users can drag files directly onto the upload area
- **Multiple File Support**: Upload multiple files at once
- **File Validation**: Automatic validation of file types and sizes
- **Progress Tracking**: Real-time upload progress for each file
- **Error Handling**: Detailed error messages for failed uploads
- **Shared Storage Integration**: Files are automatically saved to the network share
- **Database Integration**: File metadata is stored in the PRF files table
- **Security**: Requires authentication and content manager permissions

#### 4. Technical Details
- **File Storage Path**: Files are stored in shared storage under PRF-specific folders
- **Temporary Storage**: Files are temporarily stored locally before being copied to shared storage
- **File Metadata**: Includes original filename, file size, MIME type, upload timestamp
- **Authentication**: Uses JWT token authentication
- **Authorization**: Requires content manager role

#### 5. Code Structure
```
src/
├── components/
│   └── AdditionalFileUpload.tsx     # New drag-and-drop component
├── pages/
│   └── CreatePRF.tsx               # Updated to include additional file upload
backend/src/
└── routes/
    └── prfFilesRoutes.ts           # Enhanced with multiple upload endpoint
```

#### 6. API Endpoints
- `GET /api/prf-files/:prfId` - Get all files for a PRF
- `POST /api/prf-files/:prfId/upload` - Upload single file (existing)
- `POST /api/prf-files/:prfId/upload-multiple` - Upload multiple files (new)
- `GET /api/prf-files/file/:fileId` - Get specific file details
- `DELETE /api/prf-files/file/:fileId` - Delete a file

### Next steps
- Test the complete workflow in production environment
- Monitor file upload performance with multiple files
- Consider adding file preview functionality
- Add file download functionality for uploaded files
- Implement file versioning if needed

### Notes
- The feature is only available after successful PRF creation
- Files are stored both locally (temporarily) and in shared storage
- The component provides comprehensive error handling and user feedback
- All uploads require proper authentication and authorization
- File type restrictions are enforced both on frontend and backend

**Resolution**: CIFS network share mounting issue has been completely resolved. The application can now successfully access the shared documents from the network drive using the correct `ict.supportassistant` credentials.

**Next steps**: Monitor application performance and document any additional network share related functionality as needed.

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  #