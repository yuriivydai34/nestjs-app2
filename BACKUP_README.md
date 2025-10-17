# Backup API Documentation

The Backup API provides endpoints for creating, managing, and downloading PostgreSQL database backups.

## Features

- ✅ Create database backups using `pg_dump`
- ✅ List all backups with metadata
- ✅ Download backup files
- ✅ Delete backups (file + database record)
- 🚧 Upload to cloud storage (MinIO/S3) - planned

## Prerequisites

Make sure you have `pg_dump` installed on your system:
- macOS: `brew install postgresql`
- Ubuntu/Debian: `sudo apt-get install postgresql-client`
- Windows: Install PostgreSQL tools

## API Endpoints

### Authentication
All backup endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

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

### 5. Upload to Cloud (Coming Soon)
**POST** `/backups/:id/upload-cloud`

Uploads a backup to cloud storage (MinIO/S3). Currently returns a placeholder response.

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

## Error Handling

The API handles various error scenarios:
- **404**: Backup not found
- **500**: Backup creation failed (database issues, permissions, etc.)
- **401**: Authentication required

## Future Enhancements

### Cloud Storage Integration

The system is designed to support cloud storage uploads to MinIO or AWS S3:

1. **Install cloud storage dependencies:**
```bash
npm install @aws-sdk/client-s3 # for S3
# or
npm install minio # for MinIO
```

2. **Update environment variables:**
```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=backups

# OR S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-backup-bucket
```

3. **The `uploadToCloud` method in `BackupService` is ready for implementation**

### Backup Scheduling

Consider adding backup scheduling using:
- `@nestjs/schedule` for cron jobs
- Queue system like Bull for background processing

### Compression

Add backup compression support:
- Gzip compression for smaller file sizes
- Update file extensions to `.sql.gz`

## Testing

Run the backup endpoints using tools like Postman or curl:

```bash
# Create a backup
curl -X POST http://localhost:3000/backups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Test backup", "type": "full"}'

# List backups
curl -X GET http://localhost:3000/backups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Download backup
curl -X GET http://localhost:3000/backups/1/download \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o backup.sql
```