# MinIO Upload Issues - Troubleshooting Guide

## 🚨 **Issue: Signature Mismatch Error**

### **Error Message**
```
The request signature we calculated does not match the signature you provided. Check your key and signing method.
```

### **Root Causes & Solutions**

#### **1. MinIO Server Not Running**
**Check:**
```bash
# Test if MinIO is accessible
curl http://localhost:9000/minio/health/live
```

**Fix:**
```bash
# Start MinIO with Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

#### **2. Wrong MinIO Credentials**
**Check your `.env` file:**
```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=backups
MINIO_BUCKET_FILES=files
MINIO_USE_SSL=false
```

**Verify credentials match MinIO server:**
- Default Docker credentials: `minioadmin` / `minioadmin`
- Check MinIO console at http://localhost:9001

#### **3. Port or Endpoint Issues**
**Test connection:**
```bash
# Check if port 9000 is accessible
nc -zv localhost 9000

# Check if MinIO API responds
curl -I http://localhost:9000
```

**Common fixes:**
- Ensure MinIO is running on port 9000
- Check firewall settings
- Verify `MINIO_ENDPOINT` in `.env` (use `localhost`, not `127.0.0.1`)

#### **4. SSL Configuration Mismatch**
**Check SSL settings:**
```env
# For local development (HTTP)
MINIO_USE_SSL=false

# For production (HTTPS)
MINIO_USE_SSL=true
```

## 🔤 **Issue: Cyrillic/International Character Filenames**

### **Problem**
Cyrillic filenames like `"ÐÐºÑ Ð®ÑÑÐ¸Ì ÐÑÐ²ÑÐ²ÑÑÐºÐ¸Ð¸Ì Ð¡Ð°Ð´ 4.xlsx"` cause encoding issues.

### **Solution Implemented**
1. **Base64 Encoding**: Filenames are encoded to prevent character issues
2. **UTF-8 Metadata**: Original names stored in object metadata
3. **Proper Headers**: Content-Disposition with UTF-8 encoding

### **Before Fix**
```typescript
const uniqueFilename = `${timestamp}_${baseFilename}${fileExtension}`;
// Problem: Cyrillic characters in filesystem path
```

### **After Fix**
```typescript
const encodedBaseFilename = Buffer.from(baseFilename, 'utf8').toString('base64').replace(/[+/=]/g, '_');
const uniqueFilename = `${timestamp}_${encodedBaseFilename}${fileExtension}`;
// Solution: Safe base64 encoded filename
```

## 🧪 **Testing & Debugging**

### **1. Health Check Endpoint**
```bash
# Check MinIO connection status
curl http://localhost:3001/file-upload/health

# Expected response:
{
  "status": "healthy",
  "buckets": ["files", "backups"]
}
```

### **2. Test File Upload**
```bash
# Test with ASCII filename
curl -X POST http://localhost:3001/file-upload \
  -F "file=@test.txt"

# Test with Cyrillic filename
curl -X POST http://localhost:3001/file-upload \
  -F "file=@тест.txt"
```

### **3. Check Application Logs**
Look for these log messages:
```
[FileUploadService] MinIO connection successful
[FileUploadService] MinIO bucket verified: files
[FileUploadService] Uploading file to MinIO: uploads/2024-10-17T18-30-00-000Z_dGVzdA__test.txt
```

### **4. MinIO Console Verification**
1. Access http://localhost:9001
2. Login with `minioadmin` / `minioadmin`
3. Check if `files` bucket exists
4. Verify uploaded files appear in `uploads/` folder

## 🔧 **Step-by-Step Troubleshooting**

### **Step 1: Verify MinIO Server**
```bash
# 1. Check if MinIO is running
docker ps | grep minio

# 2. Check MinIO logs
docker logs <minio_container_id>

# 3. Test MinIO API
curl http://localhost:9000/minio/health/live
```

### **Step 2: Verify Application Configuration**
```bash
# Check environment variables
cd /Users/yura/proj/nestjs-app2
cat .env | grep MINIO
```

### **Step 3: Test Health Endpoint**
```bash
# Application should be running on port 3001
curl http://localhost:3001/file-upload/health
```

### **Step 4: Check Application Logs**
```bash
# Look for MinIO connection errors in app startup
# Check for "MinIO connection successful" message
```

## 🔐 **Security Notes**

### **Production Configuration**
For production environments:

```env
# Use strong credentials
MINIO_ACCESS_KEY=your-strong-access-key
MINIO_SECRET_KEY=your-strong-secret-key

# Enable SSL
MINIO_USE_SSL=true
MINIO_ENDPOINT=your-minio-domain.com
```

### **Network Security**
- MinIO admin console (port 9001) should not be publicly accessible
- Use reverse proxy for MinIO API (port 9000)
- Implement proper authentication for file upload endpoints

## 🚀 **Quick Fix Commands**

### **Restart MinIO**
```bash
# Stop existing MinIO
docker stop $(docker ps -q --filter ancestor=quay.io/minio/minio)

# Start fresh MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

### **Restart Application**
```bash
# In your project directory
npm run start:dev
```

### **Test Upload**
```bash
# Create test file
echo "test content" > test.txt

# Upload test file
curl -X POST http://localhost:3001/file-upload \
  -F "file=@test.txt"
```

## 📊 **Expected Success Response**

After fixing the issues, file upload should return:

```json
{
  "message": "File uploaded successfully to cloud storage",
  "data": {
    "id": 1,
    "filename": "2024-10-17T18-30-00-000Z_dGVzdA__.txt",
    "originalName": "test.txt",
    "size": 13,
    "mimetype": "text/plain",
    "url": "http://localhost:9000/files/uploads/...",
    "cloudUrl": "http://localhost:9000/files/uploads/...",
    "uploadDate": "2024-10-17T18:30:00.000Z"
  }
}
```

## ✅ **Verification Checklist**

- [ ] MinIO server running on port 9000
- [ ] MinIO console accessible at http://localhost:9001
- [ ] Application `.env` file configured correctly
- [ ] Health endpoint returns "healthy" status
- [ ] Test file upload succeeds
- [ ] Files appear in MinIO console under `files` bucket
- [ ] Cyrillic filenames handled correctly
- [ ] Download endpoints work properly