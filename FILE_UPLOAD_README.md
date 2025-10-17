# File Upload Service - MinIO Integration

## 🚀 **MinIO Cloud Storage Integration**

The FileUploadService has been completely rewritten to use MinIO cloud storage instead of local file storage, providing better scalability, reliability, and cloud-native file management.

## 🔧 **Key Features**

### ✅ **What's New**
- **MinIO Cloud Storage**: All files stored in MinIO object storage
- **Presigned URLs**: Secure, time-limited access URLs (7 days validity)
- **Unique Filenames**: Timestamp-based naming to prevent conflicts
- **Streaming Downloads**: Direct file streaming from MinIO
- **Secure Error Handling**: No sensitive information exposure
- **Automatic Bucket Management**: Creates buckets if they don't exist
- **Metadata Storage**: File information stored in PostgreSQL database

### 🗂️ **File Storage Structure**
```
MinIO Bucket: "files"
├── uploads/
│   ├── 2024-10-17T15-30-22-000Z_document.pdf
│   ├── 2024-10-17T15-31-15-123Z_image.jpg
│   └── 2024-10-17T15-32-08-456Z_video.mp4
```

## 📋 **API Endpoints**

### **1. Upload File**
**POST** `/file-upload`

Upload files to MinIO cloud storage.

**Request:**
```bash
curl -X POST http://localhost:3001/file-upload \
  -F "file=@/path/to/your/file.pdf"
```

**Response:**
```json
{
  "message": "File uploaded successfully to cloud storage",
  "data": {
    "id": 1,
    "filename": "2024-10-17T15-30-22-000Z_document.pdf",
    "originalName": "document.pdf",
    "size": 1024000,
    "mimetype": "application/pdf",
    "url": "http://localhost:9000/files/uploads/2024-10-17T15-30-22-000Z_document.pdf?X-Amz-Algorithm=...",
    "cloudUrl": "http://localhost:9000/files/uploads/2024-10-17T15-30-22-000Z_document.pdf?X-Amz-Algorithm=...",
    "uploadDate": "2024-10-17T15:30:22.000Z"
  }
}
```

### **2. Get File Metadata**
**GET** `/file-upload/:id`

Get file metadata with fresh presigned URL.

**Response:**
```json
{
  "id": 1,
  "filename": "2024-10-17T15-30-22-000Z_document.pdf",
  "originalName": "document.pdf",
  "size": 1024000,
  "mimetype": "application/pdf",
  "url": "http://localhost:9000/files/uploads/...",
  "cloudUrl": "http://localhost:9000/files/uploads/...",
  "uploadDate": "2024-10-17T15:30:22.000Z"
}
```

### **3. Download File**
**GET** `/file-upload/:id/download`

Stream file directly from MinIO storage.

```bash
curl -X GET http://localhost:3001/file-upload/1/download -o downloaded_file.pdf
```

### **4. List All Files**
**GET** `/file-upload`

Get all files with fresh presigned URLs.

### **5. Delete File**
**DELETE** `/file-upload/:id`

Delete file from both MinIO storage and database.

## 🔧 **Configuration**

### **Environment Variables**
Update your `.env` file:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=backups          # For backup files
MINIO_BUCKET_FILES=files      # For uploaded files
MINIO_USE_SSL=false
```

### **MinIO Setup**
1. **Start MinIO server**:
```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

2. **Access MinIO Console**: http://localhost:9001
   - Username: `minioadmin`
   - Password: `minioadmin`

## 🔄 **Migration from Local Storage**

### **Before (Local File Storage)**
- Files stored in `./upload` directory
- Direct file system access
- Local file paths in database
- Manual file management

### **After (MinIO Cloud Storage)**
- Files stored in MinIO cloud storage
- Presigned URLs for secure access
- Automatic bucket management
- Cloud-native file operations

### **Migration Steps**
If you have existing files in local storage:

1. **Backup existing files**:
```bash
cp -r ./upload ./upload_backup
```

2. **Upload existing files to MinIO** (manual script needed):
```typescript
// migration-script.ts
import * as fs from 'fs';
import * as path from 'path';
import { FileUploadService } from './src/file-upload/file-upload.service';

// Script to migrate existing files to MinIO
// (Implementation depends on your specific needs)
```

## 🛡️ **Security Features**

### **1. Secure Error Handling**
- No MinIO credentials exposed in error messages
- User-friendly error responses
- Detailed logging for debugging

### **2. Presigned URLs**
- Time-limited access (7 days)
- Secure access without exposing credentials
- Automatic URL regeneration

### **3. File Access Control**
- Currently public access (can be restricted)
- Ready for role-based access control
- Audit trail through database logs

## 🚀 **Performance Benefits**

### **Scalability**
- ✅ Cloud storage eliminates local disk limitations
- ✅ MinIO handles concurrent file operations
- ✅ Automatic load balancing across MinIO nodes

### **Reliability**
- ✅ Data redundancy and backup capabilities
- ✅ MinIO's built-in data protection
- ✅ Separate metadata and file storage

### **Speed**
- ✅ Direct streaming from MinIO
- ✅ No server file system bottlenecks
- ✅ CDN-ready architecture

## 📊 **Monitoring & Debugging**

### **File Upload Logs**
```
[FileUploadService] Uploading file to MinIO: uploads/2024-10-17T15-30-22-000Z_document.pdf
[FileUploadService] File uploaded successfully: 2024-10-17T15-30-22-000Z_document.pdf
```

### **Error Scenarios**
- **MinIO Connection Issues**: Graceful fallback with user-friendly messages
- **File Not Found**: Clear 404 responses
- **Upload Failures**: Detailed server logs, sanitized user messages

### **MinIO Console Monitoring**
Access http://localhost:9001 to:
- View uploaded files
- Monitor storage usage
- Check bucket policies
- Review access logs

## 🔮 **Future Enhancements**

### **Planned Features**
- **File Compression**: Automatic image/document compression
- **Thumbnail Generation**: For images and videos
- **Virus Scanning**: Integration with antivirus services
- **Access Control**: Role-based file access permissions
- **File Versioning**: Multiple versions of the same file
- **CDN Integration**: For faster global file delivery

### **Advanced Configuration**
```typescript
// Example: Custom file processing
async processFile(file: Express.Multer.File) {
  // Image resizing
  // Document OCR
  // Virus scanning
  // Metadata extraction
}
```

## 🧪 **Testing**

### **Manual Testing**
```bash
# Upload a file
curl -X POST http://localhost:3001/file-upload \
  -F "file=@test.pdf"

# Get file metadata
curl -X GET http://localhost:3001/file-upload/1

# Download file
curl -X GET http://localhost:3001/file-upload/1/download -o downloaded.pdf

# List all files
curl -X GET http://localhost:3001/file-upload

# Delete file
curl -X DELETE http://localhost:3001/file-upload/1
```

The file upload system is now fully cloud-native with MinIO integration! 🎉