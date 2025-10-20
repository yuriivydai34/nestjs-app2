import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBackupDto, BackupResponseDto, RestoreBackupResponseDto } from './dto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import * as Minio from 'minio';
import { ErrorSanitizer } from '../utils/error-sanitizer';

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
    const filepath = join(this.backupDir, filename);

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

      // Execute pg_dump command
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      this.logger.log(`Starting backup creation: ${filename}`);
      
      // Remove Prisma-specific parameters that pg_dump doesn't understand
      const cleanDatabaseUrl = databaseUrl.split('?')[0];
      const command = `pg_dump "${cleanDatabaseUrl}" > "${filepath}"`;
      await execAsync(command);

      // Get file size
      const stats = statSync(filepath);
      const fileSize = stats.size;

      // Update backup record with size and status
      const updatedBackup = await this.prisma.backup.update({
        where: { id: backup.id },
        data: {
          size: fileSize,
          status: 'completed',
        },
      });

      this.logger.log(`Backup created successfully: ${filename} (${fileSize} bytes)`);

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

    return backups.map(backup => this.mapToResponseDto(backup));
  }

  async getBackupById(id: number): Promise<BackupResponseDto> {
    const backup = await this.prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      throw new NotFoundException(`Backup with ID ${id} not found`);
    }

    return this.mapToResponseDto(backup);
  }

  async downloadBackup(id: number): Promise<{ filepath: string; filename: string }> {
    const backup = await this.getBackupById(id);
    const filepath = join(this.backupDir, backup.filename);

    if (!existsSync(filepath)) {
      throw new NotFoundException(`Backup file not found: ${backup.filename}`);
    }

    return { filepath, filename: backup.filename };
  }

  async deleteBackup(id: number): Promise<void> {
    const backup = await this.getBackupById(id);
    const filepath = join(this.backupDir, backup.filename);

    try {
      // Delete file if exists
      if (existsSync(filepath)) {
        unlinkSync(filepath);
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
    const filepath = join(this.backupDir, backup.filename);

    if (!existsSync(filepath)) {
      throw new NotFoundException(`Backup file not found: ${backup.filename}`);
    }

    try {
      this.logger.log(`Starting cloud upload for backup: ${backup.filename}`);

      // Upload file to MinIO
      const objectName = `backups/${backup.filename}`;
      await this.minioClient.fPutObject(this.minioBucket, objectName, filepath);

      // Generate presigned URL for access (valid for 30 days for better reliability)
      const cloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket, 
        objectName, 
        30 * 24 * 60 * 60 // 30 days in seconds for better reliability
      );

      // Update backup record with cloud URL
      const updatedBackup = await this.prisma.backup.update({
        where: { id },
        data: { cloudUrl },
      });

      this.logger.log(`Backup uploaded to cloud successfully: ${backup.filename}`);
      return this.mapToResponseDto(updatedBackup);
    } catch (error) {
      // Log full error details for debugging
      this.logger.error(`[CLOUD_UPLOAD] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Backup ID: ${id}
        Filename: ${backup.filename}
        Timestamp: ${new Date().toISOString()}
      `);
      
      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'Cloud upload');
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
              // Validate cloudUrl - only keep if it's a valid string
              cloudUrl: (typeof backupData.cloudUrl === 'string' && backupData.cloudUrl.length > 0) ? backupData.cloudUrl : null,
              // Ensure status is valid
              status: ['in_progress', 'completed', 'failed'].includes(backupData.status) ? backupData.status : 'completed',
              // Ensure type is valid
              type: backupData.type || 'full',
              // Ensure description is not null
              description: backupData.description || 'Restored backup'
            };

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
                  cloudUrl: (typeof backupData.cloudUrl === 'string' && backupData.cloudUrl.length > 0) ? backupData.cloudUrl : null,
                  status: ['in_progress', 'completed', 'failed'].includes(backupData.status) ? backupData.status : 'completed'
                }
              });
              this.logger.log(`🔧 Updated existing backup with correct metadata`);
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
}