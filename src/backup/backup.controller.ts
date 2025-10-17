import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Res,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { CreateBackupDto, BackupResponseDto } from './dto';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { createReadStream } from 'fs';

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new database backup' })
  @ApiResponse({
    status: 201,
    description: 'Backup created successfully',
    type: BackupResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - backup creation failed',
  })
  async createBackup(@Body() createBackupDto: CreateBackupDto): Promise<BackupResponseDto> {
    return await this.backupService.createBackup(createBackupDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all backups' })
  @ApiResponse({
    status: 200,
    description: 'List of all backups',
    type: [BackupResponseDto],
  })
  async getAllBackups(): Promise<BackupResponseDto[]> {
    return await this.backupService.getAllBackups();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backup by ID' })
  @ApiResponse({
    status: 200,
    description: 'Backup details',
    type: BackupResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Backup not found',
  })
  async getBackupById(@Param('id', ParseIntPipe) id: number): Promise<BackupResponseDto> {
    return await this.backupService.getBackupById(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download backup file' })
  @ApiResponse({
    status: 200,
    description: 'Backup file download',
  })
  @ApiResponse({
    status: 404,
    description: 'Backup or file not found',
  })
  async downloadBackup(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { filepath, filename } = await this.backupService.downloadBackup(id);
      
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = createReadStream(filepath);
      fileStream.pipe(res);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Post(':id/upload-cloud')
  @ApiOperation({ summary: 'Upload backup to cloud storage (MinIO/S3)' })
  @ApiResponse({
    status: 200,
    description: 'Backup uploaded to cloud storage',
    type: BackupResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Backup not found',
  })
  @ApiResponse({
    status: 501,
    description: 'Cloud upload not implemented yet',
  })
  async uploadToCloud(@Param('id', ParseIntPipe) id: number): Promise<BackupResponseDto> {
    return await this.backupService.uploadToCloud(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete backup' })
  @ApiResponse({
    status: 200,
    description: 'Backup deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Backup not found',
  })
  async deleteBackup(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.backupService.deleteBackup(id);
    return { message: 'Backup deleted successfully' };
  }
}