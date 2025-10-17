import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBackupDto, BackupResponseDto } from './dto';
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

      // Generate presigned URL for access (valid for 7 days)
      const cloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket, 
        objectName, 
        7 * 24 * 60 * 60 // 7 days in seconds
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
}