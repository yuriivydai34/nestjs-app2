# Backup API Documentation

The Backup API provides endpoints for creating, managing, and downloading PostgreSQL database backups.

## Features

- ✅ Create database backups using `pg_dump`
- ✅ List all backups with metadata
- ✅ Download backup files
- ✅ Delete backups (file + database record)
- ✅ Upload to cloud storage (MinIO/S3)
- 🔒 **Secure error handling** - No sensitive data in error messages

## Prerequisites

Make sure you have `pg_dump` installed on your system:
- macOS: `brew install postgresql`
- Ubuntu/Debian: `sudo apt-get install postgresql-client`
- Windows: Install PostgreSQL tools

## API Endpoints

### Authentication & Authorization
All backup endpoints require authentication **AND** admin role. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

**🔒 Admin Only Access**: Only users with `role: "admin"` can access backup endpoints. Non-admin users will receive a `403 Forbidden` response.

### 1. Create Backup
**POST** `/backups`

Creates a new database backup.

**Body:**
```json
{
  "description": "Daily backup before maintenance",
  "type": "full"
}
```

**Response:**
```json
{
  "id": 1,
  "filename": "backup_2024-10-17_14-30-22.sql",
  "description": "Daily backup before maintenance",
  "size": 1024000,
  "type": "full",
  "status": "completed",
  "cloudUrl": null,
  "createdAt": "2024-10-17T14:30:22.000Z"
}
```

### 2. List All Backups
**GET** `/backups`

Returns a list of all backups ordered by creation date (newest first).

**Response:**
```json
[
  {
    "id": 1,
    "filename": "backup_2024-10-17_14-30-22.sql",
    "description": "Daily backup before maintenance",
    "size": 1024000,
    "type": "full",
    "status": "completed",
    "cloudUrl": null,
    "createdAt": "2024-10-17T14:30:22.000Z"
  }
]
```

### 3. Get Backup Details
**GET** `/backups/:id`

Returns details of a specific backup.

### 4. Download Backup
**GET** `/backups/:id/download`

Downloads the backup file. Returns the SQL file as an attachment.

### 5. Upload to Cloud Storage
**POST** `/backups/:id/upload-cloud`

Uploads a backup to MinIO cloud storage and returns an updated backup record with cloud URL.

**Response:**
```json
{
  "id": 1,
  "filename": "backup_2024-10-17_14-30-22.sql",
  "description": "Daily backup before maintenance", 
  "size": 1024000,
  "type": "full",
  "status": "completed",
  "cloudUrl": "http://localhost:9000/backups/backups/backup_2024-10-17_14-30-22.sql?X-Amz-Algorithm=...",
  "createdAt": "2024-10-17T14:30-22.000Z"
}

### 6. Delete Backup
**DELETE** `/backups/:id`

Deletes both the backup file and database record.

**Response:**
```json
{
  "message": "Backup deleted successfully"
}
```

## Backup Storage

- **Local Storage**: Backups are stored in the `backups/` directory
- **Database Records**: Metadata is stored in the `Backup` table
- **File Naming**: `backup_YYYY-MM-DD_HH-MM-SS.sql`

## Error Handling & Security

The API implements secure error handling to protect sensitive information:

### 🔒 **Security Features**
- **No credential exposure**: Database URLs and passwords are never shown in error messages
- **Sanitized errors**: File paths and sensitive configuration are hidden
- **User-friendly messages**: Clear, helpful error descriptions without technical details
- **Secure logging**: Full error details logged server-side for debugging

### **Error Scenarios**
- **401**: Authentication required (no valid JWT token)
- **403**: Forbidden - Admin role required (user is authenticated but not admin)
- **404**: Backup not found
- **500**: User-friendly error messages (e.g., "Database backup tool is not available")

### **Example Error Responses**

**Non-Admin User (403 Forbidden):**
```json
{
  "statusCode": 403,
  "timestamp": "2024-10-17T15:30:22.000Z",
  "path": "/backups",
  "message": "Access denied. Required role(s): admin. Your role: user"
}
```

**Server Error (500):**
```json
{
  "statusCode": 500,
  "timestamp": "2024-10-17T15:30:22.000Z",
  "path": "/backups", 
  "message": "Backup creation failed due to an unexpected error. Please try again or contact support."
}
```

**Note**: Detailed error information is logged server-side for developers but never exposed to API clients.

## MinIO Cloud Storage Integration

### ✅ **Now Implemented!**

The system now supports uploading backups to MinIO cloud storage.

### Setup MinIO

1. **Install and run MinIO locally:**
```bash
# Using Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"

# Or download MinIO binary for your platform
```

2. **Configure environment variables:**

Create a `.env` file in your project root with:
```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/mydb1?schema=public"

# JWT Configuration  
JWT_SECRET="your-super-secret-jwt-key"

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=backups
MINIO_USE_SSL=false
```

### Using Cloud Upload

The `POST /backups/:id/upload-cloud` endpoint is now fully functional:

```bash
# Upload a backup to MinIO
curl -X POST http://localhost:3000/backups/1/upload-cloud \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": 1,
  "filename": "backup_2024-10-17_14-30-22.sql",
  "description": "Daily backup before maintenance",
  "size": 1024000,
  "type": "full", 
  "status": "completed",
  "cloudUrl": "http://localhost:9000/backups/backups/backup_2024-10-17_14-30-22.sql?X-Amz-Algorithm=...",
  "createdAt": "2024-10-17T14:30:22.000Z"
}
```

### Features

- ✅ **Automatic bucket creation** - Creates the 'backups' bucket if it doesn't exist
- ✅ **File upload** - Uploads backup files to MinIO using `fPutObject`
- ✅ **Presigned URLs** - Generates secure download URLs (valid for 7 days)
- ✅ **Error handling** - Proper error responses for missing files or upload failures
- ✅ **Database updates** - Stores cloud URL in the backup record

### MinIO Web Console

Access the MinIO web console at http://localhost:9001 with:
- **Username**: minioadmin  
- **Password**: minioadmin

## Future Enhancements

### Backup Scheduling

Consider adding backup scheduling using:
- `@nestjs/schedule` for cron jobs
- Queue system like Bull for background processing

### Compression

Add backup compression support:
- Gzip compression for smaller file sizes
- Update file extensions to `.sql.gz`

## Complete Workflow Example

Here's a complete example of creating and uploading a backup **with admin user**:

```bash
# 1. Login as admin user first
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin_password"}'

# Response: {"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

# 2. Create a backup (use the access_token from step 1)
curl -X POST http://localhost:3001/backups \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Test backup with MinIO", "type": "full"}'

# Response: {"id": 1, "filename": "backup_2024-10-17_14-30-22.sql", ...}

# 3. Upload to MinIO
curl -X POST http://localhost:3001/backups/1/upload-cloud \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Response: {..., "cloudUrl": "http://localhost:9000/...", ...}

# 4. List all backups (see cloud URLs)
curl -X GET http://localhost:3001/backups \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# 5. Download from local storage
curl -X GET http://localhost:3001/backups/1/download \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -o backup.sql

# 6. Access from MinIO directly using the cloudUrl from step 3
# The presigned URL allows direct download from MinIO
```

### **Non-Admin User Example (Will Fail)**
```bash
# Login as regular user
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "regular_user", "password": "user_password"}'

# Try to create backup (will fail with 403)
curl -X POST http://localhost:3001/backups \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "This will fail"}'

# Response: 
# {
#   "statusCode": 403,
#   "message": "Access denied. Required role(s): admin. Your role: user",
#   "timestamp": "2024-10-17T15:30:22.000Z",
#   "path": "/backups"
# }
```

## Testing

Make sure MinIO is running on localhost:9000 and your environment variables are properly configured.