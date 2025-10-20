import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBackupDto, BackupResponseDto, RestoreBackupResponseDto } from './dto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import * as Minio from 'minio';
import { ErrorSanitizer } from '../utils/error-sanitizer';
import { PassThrough } from 'stream';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = join(process.cwd(), 'backups');
  private readonly minioClient: Minio.Client;
  private readonly minioBucket = process.env.MINIO_BUCKET || 'backups';

  constructor(private prisma: PrismaService) {
    // Create backups directory if it doesn't exist
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    // Initialize MinIO client
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    // Ensure bucket exists
    this.ensureBucketExists();
  }

  async createBackup(createBackupDto: CreateBackupDto): Promise<BackupResponseDto> {
    const { description, type = 'full' } = createBackupDto;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
    const filename = `backup_${timestamp}.sql`;

    try {
      // Create backup record in database first
      const backup = await this.prisma.backup.create({
        data: {
          filename,
          description,
          size: 0,
          type,
          status: 'in_progress',
        },
      });

      // Get database URL
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      this.logger.log(`Starting backup creation and cloud upload: ${filename}`);
      
      // Remove Prisma-specific parameters that pg_dump doesn't understand
      const cleanDatabaseUrl = databaseUrl.split('?')[0];
      
      // Create a PassThrough stream to capture pg_dump output
      const stream = new PassThrough();
      let totalSize = 0;
      
      // Track the size of data flowing through the stream
      stream.on('data', (chunk) => {
        totalSize += chunk.length;
      });

      // Spawn pg_dump process and pipe output to stream
      const pgDumpProcess = spawn('pg_dump', [cleanDatabaseUrl], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Handle pg_dump errors
      pgDumpProcess.stderr.on('data', (data) => {
        this.logger.error(`pg_dump stderr: ${data}`);
      });

      // Pipe pg_dump output to our stream
      pgDumpProcess.stdout.pipe(stream);

      // Upload stream directly to MinIO
      const objectName = `backups/${filename}`;
      
      // Start upload to MinIO while pg_dump is running
      const uploadPromise = this.minioClient.putObject(this.minioBucket, objectName, stream);
      
      // Wait for both pg_dump to finish and upload to complete
      await Promise.all([
        new Promise((resolve, reject) => {
          pgDumpProcess.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`pg_dump process exited with code ${code}`));
            } else {
              resolve(void 0);
            }
          });
          pgDumpProcess.on('error', reject);
        }),
        uploadPromise
      ]);

      // Generate presigned URL for access (valid for 7 days - MinIO limit)
      const cloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket, 
        objectName, 
        7 * 24 * 60 * 60 // 7 days in seconds (MinIO maximum)
      );

      // Update backup record with size, status, and cloud URL
      const updatedBackup = await this.prisma.backup.update({
        where: { id: backup.id },
        data: {
          size: totalSize,
          status: 'completed',
          cloudUrl,
        },
      });

      this.logger.log(`Backup created and uploaded to cloud successfully: ${filename} (${totalSize} bytes)`);

      return this.mapToResponseDto(updatedBackup);
    } catch (error) {
      // Log full error details for debugging (in secure logs)
      this.logger.error(`[BACKUP_CREATE] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Filename: ${filename}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Update backup status to failed if record was created
      try {
        await this.prisma.backup.updateMany({
          where: { filename, status: 'in_progress' },
          data: { status: 'failed' },
        });
      } catch (updateError) {
        this.logger.error(`Failed to update backup status: ${ErrorSanitizer.sanitizeErrorMessage(updateError)}`);
      }

      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'Backup creation');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  async getAllBackups(): Promise<BackupResponseDto[]> {
    const backups = await this.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Check and refresh expired cloudUrls
    const refreshedBackups = await Promise.all(
      backups.map(async (backup) => {
        if (backup.cloudUrl && this.isCloudUrlExpired(backup.cloudUrl)) {
          this.logger.log(`Refreshing expired cloudUrl for backup: ${backup.filename}`);
          try {
            const newCloudUrl = await this.refreshCloudUrl(backup.id);
            return { ...backup, cloudUrl: newCloudUrl };
          } catch (error) {
            this.logger.warn(`Failed to refresh cloudUrl for ${backup.filename}: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
            return backup;
          }
        }
        return backup;
      })
    );

    return refreshedBackups.map(backup => this.mapToResponseDto(backup));
  }

  async getBackupById(id: number): Promise<BackupResponseDto> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup with ID ${id} not found`);
    }

    // Check if cloudUrl is expired and refresh if needed
    if (backup.cloudUrl && this.isCloudUrlExpired(backup.cloudUrl)) {
      this.logger.log(`Refreshing expired cloudUrl for backup: ${backup.filename}`);
      try {
        const newCloudUrl = await this.refreshCloudUrl(backup.id);
        backup.cloudUrl = newCloudUrl;
      } catch (error) {
        this.logger.warn(`Failed to refresh cloudUrl for ${backup.filename}: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      }
    }

    return this.mapToResponseDto(backup);
  }

  async downloadBackup(id: number): Promise<{ filepath: string; filename: string }> {
    const backup = await this.getBackupById(id);
    let filepath = join(this.backupDir, backup.filename);

    // If backup file doesn't exist locally but has cloud URL, download it first
    if (!existsSync(filepath) && backup.cloudUrl) {
      this.logger.log(`Backup file not found locally, downloading from cloud: ${backup.filename}`);
      filepath = await this.downloadFromCloud(backup);
    }

    if (!existsSync(filepath)) {
      throw new NotFoundException(`Backup file not found locally or in cloud: ${backup.filename}`);
    }

    return { filepath, filename: backup.filename };
  }

  async deleteBackup(id: number): Promise<void> {
    const backup = await this.getBackupById(id);
    const filepath = join(this.backupDir, backup.filename);
    const objectName = `backups/${backup.filename}`;

    try {
      // Delete local file if exists
      if (existsSync(filepath)) {
        unlinkSync(filepath);
        this.logger.log(`Local backup file deleted: ${backup.filename}`);
      }

      // Delete from cloud storage if it exists
      try {
        await this.minioClient.removeObject(this.minioBucket, objectName);
        this.logger.log(`Cloud backup file deleted: ${objectName}`);
      } catch (cloudError) {
        // Log but don't fail if cloud file doesn't exist or can't be deleted
        this.logger.warn(`Could not delete cloud backup file (may not exist): ${ErrorSanitizer.sanitizeErrorMessage(cloudError)}`);
      }

      // Delete database record
      await this.prisma.backup.delete({
        where: { id },
      });

      this.logger.log(`Backup deleted successfully: ${backup.filename}`);
    } catch (error) {
      // Log full error details for debugging
      this.logger.error(`[BACKUP_DELETE] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Backup ID: ${id}
        Filename: ${backup.filename}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'Backup deletion');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  private mapToResponseDto(backup: any): BackupResponseDto {
    return {
      id: backup.id,
      filename: backup.filename,
      description: backup.description,
      size: backup.size,
      type: backup.type,
      status: backup.status,
      cloudUrl: backup.cloudUrl,
      createdAt: backup.createdAt,
    };
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.minioBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.minioBucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.minioBucket}`);
      }
    } catch (error) {
      // Log sanitized error message for MinIO connection issues
      const sanitizedMessage = ErrorSanitizer.sanitizeErrorMessage(error);
      this.logger.warn(`Failed to ensure bucket exists: ${sanitizedMessage}`);
    }
  }

  async uploadToCloud(id: number): Promise<BackupResponseDto> {
    const backup = await this.getBackupById(id);

    // For new backups created after this update, they're already in cloud storage
    // This method now just refreshes the presigned URL
    try {
      this.logger.log(`Refreshing cloud URL for backup: ${backup.filename}`);

      const objectName = `backups/${backup.filename}`;
      
      // Check if file exists in cloud storage
      try {
        await this.minioClient.statObject(this.minioBucket, objectName);
      } catch (statError) {
        throw new NotFoundException(`Backup file not found in cloud storage: ${backup.filename}`);
      }

      // Generate new presigned URL for access (valid for 7 days - MinIO limit)
      const cloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket, 
        objectName, 
        7 * 24 * 60 * 60 // 7 days in seconds (MinIO maximum)
      );

      // Update backup record with new cloud URL
      const updatedBackup = await this.prisma.backup.update({
        where: { id },
        data: { cloudUrl },
      });

      this.logger.log(`Cloud URL refreshed successfully for backup: ${backup.filename}`);
      return this.mapToResponseDto(updatedBackup);
    } catch (error) {
      // Log full error details for debugging
      this.logger.error(`[CLOUD_URL_REFRESH] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Backup ID: ${id}
        Filename: ${backup.filename}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'Cloud URL refresh');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  async restoreBackup(id: number) {
    const backup = await this.getBackupById(id);
    let filepath = join(this.backupDir, backup.filename);

    // If backup file doesn't exist locally but has cloud URL, download it first
    if (!existsSync(filepath) && backup.cloudUrl) {
      this.logger.log(`Backup file not found locally, downloading from cloud: ${backup.filename}`);
      filepath = await this.downloadFromCloud(backup);
    }

    if (!existsSync(filepath)) {
      throw new NotFoundException(`Backup file not found locally or in cloud: ${backup.filename}`);
    }

    // Step 1: Save current backup list to local file before restore
    this.logger.log('Saving current backup list to local file before restore...');
    const currentBackups = await this.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    this.logger.log(`Found ${currentBackups.length} backups to preserve`);
    
    // Save backup list to local JSON file with better validation
    const backupListFile = join(this.backupDir, 'backup_list_temp.json');
    try {
      // Add debugging for what we're saving
      this.logger.log(`Backups with cloudUrl: ${currentBackups.filter(b => b.cloudUrl).length}/${currentBackups.length}`);
      currentBackups.forEach((backup, index) => {
        this.logger.log(`  ${index + 1}. ${backup.filename} - cloudUrl: ${backup.cloudUrl ? 'YES' : 'NO'} - size: ${backup.size}`);
      });

      const backupData = JSON.stringify(currentBackups, null, 2);
      const fs = require('fs');
      fs.writeFileSync(backupListFile, backupData);
      this.logger.log(`Backup list saved to local file: ${backupListFile}`);
    } catch (fileError) {
      this.logger.error(`Failed to save backup list to file: ${ErrorSanitizer.sanitizeErrorMessage(fileError)}`);
      throw new InternalServerErrorException('Failed to save backup list before restore');
    }

    try {
      this.logger.log(`Starting database restore from backup: ${backup.filename}`);

      // Extract database name from DATABASE_URL
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable not found');
      }

      // Parse database URL to extract connection details
      const url = new URL(databaseUrl);
      const dbName = url.pathname.substring(1); // Remove leading '/'
      const username = url.username;
      const password = url.password;
      const hostname = url.hostname;
      const port = url.port || '5432';

      // Set PGPASSWORD environment variable for psql authentication
      const env = { ...process.env, PGPASSWORD: password };

      // Drop all connections to the database
      this.logger.log('Terminating existing database connections...');
      const dropConnectionsCommand = `psql -h ${hostname} -p ${port} -U ${username} -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`;
      
      try {
        await execAsync(dropConnectionsCommand, { env });
      } catch (error) {
        this.logger.warn(`Warning: Could not terminate all connections: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      }

      // Drop and recreate database for clean restore
      this.logger.log('Dropping and recreating database...');
      const dropDbCommand = `psql -h ${hostname} -p ${port} -U ${username} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`;
      const createDbCommand = `psql -h ${hostname} -p ${port} -U ${username} -d postgres -c "CREATE DATABASE ${dbName};"`;
      
      await execAsync(dropDbCommand, { env });
      await execAsync(createDbCommand, { env });

      // Restore the database from backup file
      this.logger.log('Restoring database from backup file...');
      const restoreCommand = `psql -h ${hostname} -p ${port} -U ${username} -d ${dbName} -f "${filepath}"`;
      
      await execAsync(restoreCommand, { 
        env,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large restore outputs
      });

      // Run Prisma migrations to ensure schema is up to date
      this.logger.log('Database restore completed, running Prisma migrations...');
      try {
        await execAsync('npx prisma migrate deploy', { 
          cwd: process.cwd(),
          env 
        });
        this.logger.log('Prisma migrations completed successfully');
      } catch (migrationError) {
        this.logger.warn(`Prisma migration warning: ${ErrorSanitizer.sanitizeErrorMessage(migrationError)}`);
        // Continue even if migrations fail
      }

      // Force Prisma to reconnect after database recreation
      this.logger.log('Forcing Prisma to reconnect after database recreation...');
      try {
        await this.prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.prisma.$connect();
        this.logger.log('Prisma reconnection successful');
      } catch (reconnectError) {
        this.logger.warn(`Prisma reconnection warning: ${ErrorSanitizer.sanitizeErrorMessage(reconnectError)}`);
      }

      // Give additional time for the connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Restore backup list from local file after database restore
      this.logger.log('Restoring backup list from local file to database...');
      await this.restoreBackupListFromFile(backupListFile);

      // Clean up temporary file
      try {
        if (existsSync(backupListFile)) {
          const fs = require('fs');
          fs.unlinkSync(backupListFile);
          this.logger.log('Temporary backup list file cleaned up');
        }
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temporary file: ${ErrorSanitizer.sanitizeErrorMessage(cleanupError)}`);
      }

      this.logger.log(`Database and backup list restored successfully from backup: ${backup.filename}`);

      return {
        message: `Database restored successfully from backup: ${backup.filename}. Backup list preserved (${currentBackups.length} entries).`,
        backupInfo: backup,
      };

    } catch (error) {
      // Clean up temporary file in case of error
      const backupListFile = join(this.backupDir, 'backup_list_temp.json');
      try {
        if (existsSync(backupListFile)) {
          const fs = require('fs');
          fs.unlinkSync(backupListFile);
        }
      } catch (cleanupError) {
        this.logger.warn(`Failed to clean up temporary file after error: ${ErrorSanitizer.sanitizeErrorMessage(cleanupError)}`);
      }

      // Log full error details for debugging
      this.logger.error(`[DATABASE_RESTORE] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Backup ID: ${id}
        Filename: ${backup.filename}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'Database restore');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  private async downloadFromCloud(backup: BackupResponseDto): Promise<string> {
    const filepath = join(this.backupDir, backup.filename);
    const objectName = `backups/${backup.filename}`;

    try {
      this.logger.log(`Downloading backup from cloud: ${objectName}`);
      
      // Check if file exists in cloud storage before attempting download
      try {
        await this.minioClient.statObject(this.minioBucket, objectName);
      } catch (statError) {
        this.logger.error(`Backup file not found in cloud storage: ${objectName}`);
        throw new NotFoundException(`Backup file not found in cloud storage: ${backup.filename}`);
      }

      await this.minioClient.fGetObject(this.minioBucket, objectName, filepath);
      this.logger.log(`Backup downloaded successfully: ${backup.filename}`);
      
      return filepath;
    } catch (error) {
      this.logger.error(`Failed to download backup from cloud: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to download backup from cloud storage');
    }
  }

  private async restoreBackupListFromFile(backupListFile: string): Promise<void> {
    try {
      this.logger.log(`Reading backup list from file: ${backupListFile}`);
      
      if (!existsSync(backupListFile)) {
        this.logger.warn('Backup list file not found, skipping backup list restore');
        return;
      }

      // Read backup list from JSON file
      const fs = require('fs');
      const fileContent = fs.readFileSync(backupListFile, 'utf8');
      const backups = JSON.parse(fileContent);
      
      this.logger.log(`Restoring ${backups.length} backup records to database...`);
      
      // Double-check Prisma connection before attempting to restore
      try {
        await this.prisma.$queryRaw`SELECT 1 as test`;
        this.logger.log('Prisma connection verified before backup list restoration');
      } catch (connectionError) {
        this.logger.error(`Prisma connection test failed: ${ErrorSanitizer.sanitizeErrorMessage(connectionError)}`);
        // Try to reconnect once more
        await this.prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.prisma.$connect();
        this.logger.log('Prisma reconnected after connection test failure');
      }

      // Verify that the backup table exists
      try {
        await this.prisma.$queryRaw`SELECT COUNT(*) FROM "Backup"`;
        this.logger.log('Backup table verified to exist');
      } catch (tableError) {
        this.logger.error(`Backup table not found or not accessible: ${ErrorSanitizer.sanitizeErrorMessage(tableError)}`);
        throw new Error('Backup table not found after database restore. Schema migration may have failed.');
      }
      
      let restoredCount = 0;
      let skippedCount = 0;
      
      // Create backup records one by one to handle potential ID conflicts
      for (const backupData of backups) {
        try {
          // Remove the ID to let Prisma auto-generate new ones
          const { id, ...backupWithoutId } = backupData;
          
          this.logger.log(`Processing backup record: ${backupData.filename} (original ID: ${id}, size: ${backupData.size})`);
          
          // Check if backup with same filename already exists
          const existingBackup = await this.prisma.backup.findFirst({
            where: { filename: backupData.filename }
          });

          if (!existingBackup) {
            // Validate and clean backup data before creating record
            const cleanedBackupData = {
              ...backupWithoutId,
              // Ensure size is never null/undefined
              size: typeof backupData.size === 'number' ? backupData.size : 0,
              // Ensure dates are properly formatted
              createdAt: new Date(backupData.createdAt),
              updatedAt: new Date(backupData.updatedAt),
              // Preserve cloudUrl - only clear if explicitly null/undefined
              cloudUrl: backupData.cloudUrl || null,
              // Ensure status is valid
              status: ['in_progress', 'completed', 'failed'].includes(backupData.status) ? backupData.status : 'completed',
              // Ensure type is valid
              type: backupData.type || 'full',
              // Ensure description is not null
              description: backupData.description || 'Restored backup'
            };

            // Debug logging for cloudUrl preservation
            if (backupData.cloudUrl) {
              this.logger.log(`Preserving cloudUrl for ${backupData.filename}: ${backupData.cloudUrl.substring(0, 50)}...`);
            } else {
              this.logger.log(`No cloudUrl for ${backupData.filename}`);
            }

            const restored = await this.prisma.backup.create({
              data: cleanedBackupData
            });
            
            this.logger.log(`✅ Restored backup record: ${backupData.filename} (new ID: ${restored.id}, size: ${restored.size})`);
            restoredCount++;
          } else {
            this.logger.log(`⏭️ Backup record already exists, skipping: ${backupData.filename} (existing ID: ${existingBackup.id})`);
            
            // If existing backup has issues (0 size but original had size), update it
            if (existingBackup.size === 0 && backupData.size > 0) {
              this.logger.warn(`Updating existing backup ${backupData.filename} with correct size: ${backupData.size}`);
              
              await this.prisma.backup.update({
                where: { id: existingBackup.id },
                data: {
                  size: backupData.size,
                  cloudUrl: backupData.cloudUrl || null,
                  status: ['in_progress', 'completed', 'failed'].includes(backupData.status) ? backupData.status : 'completed'
                }
              });
              this.logger.log(`🔧 Updated existing backup with correct metadata: size=${backupData.size}, cloudUrl=${backupData.cloudUrl ? 'present' : 'null'}`);
            }
            
            skippedCount++;
          }
        } catch (backupError) {
          this.logger.error(`❌ Failed to restore backup record ${backupData.filename}: ${ErrorSanitizer.sanitizeErrorMessage(backupError)}`);
          // Continue with other backups even if one fails
        }
      }

      this.logger.log(`Backup list restoration completed: ${restoredCount} restored, ${skippedCount} skipped`);
      
      // Verify restoration by counting current backups
      const currentBackupCount = await this.prisma.backup.count();
      this.logger.log(`Total backups in database after restoration: ${currentBackupCount}`);
      
    } catch (error) {
      this.logger.error(`Failed to restore backup list from file: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      this.logger.error(`Error details: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      // Don't throw here - we want the main restore to succeed even if backup list restore fails
    }
  }

  // Helper method to check if cloudUrl is expired or will expire soon
  private isCloudUrlExpired(cloudUrl: string): boolean {
    if (!cloudUrl) return false;
    
    try {
      const url = new URL(cloudUrl);
      const expires = url.searchParams.get('X-Amz-Expires');
      const signatureDate = url.searchParams.get('X-Amz-Date');
      
      if (expires && signatureDate) {
        // Parse the signature date (format: 20251020T122259Z)
        const year = parseInt(signatureDate.substring(0, 4));
        const month = parseInt(signatureDate.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(signatureDate.substring(6, 8));
        const hour = parseInt(signatureDate.substring(9, 11));
        const minute = parseInt(signatureDate.substring(11, 13));
        const second = parseInt(signatureDate.substring(13, 15));
        
        const sigDate = new Date(year, month, day, hour, minute, second);
        const expiryTime = sigDate.getTime() + (parseInt(expires) * 1000);
        const now = Date.now();
        
        // Consider expired if it expires within 1 hour
        return (expiryTime - now) < (60 * 60 * 1000);
      }
    } catch (error) {
      this.logger.warn(`Error checking cloud URL expiry: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
    }
    
    return false; // If we can't determine, assume it's not expired
  }

  // Helper method to refresh an expired cloudUrl
  private async refreshCloudUrl(backupId: number): Promise<string | null> {
    try {
      const backup = await this.prisma.backup.findUnique({
        where: { id: backupId }
      });

      if (!backup) {
        return null;
      }

      const objectName = `backups/${backup.filename}`;
      
      // Check if file exists in cloud storage
      try {
        await this.minioClient.statObject(this.minioBucket, objectName);
      } catch (error) {
        this.logger.warn(`File not found in cloud storage: ${objectName}`);
        return null;
      }

      // Generate new presigned URL
      const newCloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket, 
        objectName, 
        7 * 24 * 60 * 60 // 7 days (MinIO maximum)
      );

      // Update backup record with new URL
      await this.prisma.backup.update({
        where: { id: backupId },
        data: { cloudUrl: newCloudUrl }
      });

      this.logger.log(`Refreshed cloud URL for backup: ${backup.filename}`);
      return newCloudUrl;
    } catch (error) {
      this.logger.error(`Failed to refresh cloud URL: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      return null;
    }
  }
}