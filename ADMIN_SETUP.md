# Admin User Setup for Backup Access

## 🔐 Role-Based Access Control

The backup system now requires **admin role** for all operations. This document explains how to create and manage admin users.

## Creating Admin Users

### **Option 1: Database Direct Update**
If you have existing users that need admin access:

```sql
-- Update existing user to admin
UPDATE "User" SET role = 'admin' WHERE username = 'your_username';

-- Check user roles
SELECT id, username, role FROM "User";
```

### **Option 2: Create New Admin User via API**
1. **Create user with regular API**:
```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin", 
    "password": "secure_admin_password"
  }'
```

2. **Update role in database**:
```sql
UPDATE "User" SET role = 'admin' WHERE username = 'admin';
```

### **Option 3: Modify User Creation Endpoint (Development)**
For development, you can temporarily modify the users service to allow role specification:

```typescript
// In users.service.ts - for development only
async create(createUserDto: CreateUserDto & { role?: string }): Promise<User> {
  const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
  return this.prisma.user.create({
    data: {
      username: createUserDto.username,
      password: hashedPassword,
      role: createUserDto.role || 'user', // Default to 'user'
    },
  });
}
```

Then create admin directly:
```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "secure_admin_password", 
    "role": "admin"
  }'
```

## User Roles in the System

### **Default Roles**
- `user` - Regular user (default)
- `admin` - Administrator with backup access

### **Current Admin Permissions**
- ✅ Create database backups
- ✅ List all backups  
- ✅ Download backup files
- ✅ Upload backups to cloud storage
- ✅ Delete backups
- ✅ Access backup management endpoints

### **Regular User Restrictions**
- ❌ Cannot access any backup endpoints
- ❌ Will receive `403 Forbidden` when attempting backup operations

## Testing Role-Based Access

### **1. Test Admin Access**
```bash
# Login as admin
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin_password"}'

# Use returned token for backup operations
curl -X GET http://localhost:3001/backups \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Should return: 200 OK with backup list
```

### **2. Test Regular User Restriction** 
```bash
# Login as regular user
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "regular_user", "password": "user_password"}'

# Try backup operation
curl -X GET http://localhost:3001/backups \
  -H "Authorization: Bearer USER_TOKEN"
# Should return: 403 Forbidden
```

## Security Benefits

### **🔒 Enhanced Security**
- Prevents unauthorized database access
- Limits backup operations to trusted administrators
- Provides audit trail of admin actions
- Follows principle of least privilege

### **🛡️ Error Handling**
- Clear error messages for unauthorized access
- No sensitive information leaked in error responses
- Proper HTTP status codes (403 vs 401)

## Extending Role System

### **Adding More Roles**
You can extend the system with additional roles:

```typescript
// Example: Add 'backup_operator' role
@Roles('admin', 'backup_operator')
@Controller('backups')
export class BackupController {
  // Only admin and backup_operator can access
}
```

### **Method-Level Permissions**
Apply different roles to different endpoints:

```typescript
@Get()
@Roles('admin', 'backup_operator') // View access
async getAllBackups() { }

@Delete(':id')  
@Roles('admin') // Delete requires admin only
async deleteBackup() { }
```

## Production Recommendations

### **1. Strong Admin Passwords**
- Use complex passwords for admin accounts
- Consider password policies and rotation
- Use environment variables for default admin credentials

### **2. Admin User Management**
- Create dedicated admin management endpoints
- Log admin actions for audit purposes  
- Consider multi-factor authentication

### **3. Role Validation**
- Validate roles on JWT creation
- Consider role expiration/refresh
- Monitor admin access patterns

## Troubleshooting

### **Common Issues**

**403 Forbidden Error:**
- Check user role in database: `SELECT role FROM "User" WHERE username = 'your_user'`
- Verify JWT token includes correct role
- Ensure user exists and is active

**Role Not Working:**
- Restart application after role changes
- Check JWT payload includes updated role
- Verify RolesGuard is properly applied

**Database Role Updates:**
```sql
-- Check current roles
SELECT username, role FROM "User";

-- Update user to admin
UPDATE "User" SET role = 'admin' WHERE username = 'your_username';

-- Verify change
SELECT username, role FROM "User" WHERE username = 'your_username';
```