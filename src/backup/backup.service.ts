import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBackupDto, BackupResponseDto } from './dto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = join(process.cwd(), 'backups');

  constructor(private prisma: PrismaService) {
    // Create backups directory if it doesn't exist
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
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
      
      const command = `pg_dump "${databaseUrl}" > "${filepath}"`;
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
      this.logger.error(`Failed to create backup: ${error.message}`);
      
      // Update backup status to failed if record was created
      try {
        await this.prisma.backup.updateMany({
          where: { filename, status: 'in_progress' },
          data: { status: 'failed' },
        });
      } catch (updateError) {
        this.logger.error(`Failed to update backup status: ${updateError.message}`);
      }

      throw new InternalServerErrorException(`Failed to create backup: ${error.message}`);
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
      this.logger.error(`Failed to delete backup: ${error.message}`);
      throw new InternalServerErrorException(`Failed to delete backup: ${error.message}`);
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

  // Future method for uploading to cloud storage
  async uploadToCloud(id: number): Promise<BackupResponseDto> {
    // TODO: Implement MinIO/S3 upload logic
    const backup = await this.getBackupById(id);
    
    // Placeholder for cloud upload implementation
    this.logger.log(`Cloud upload not implemented yet for backup: ${backup.filename}`);
    
    return backup;
  }
}