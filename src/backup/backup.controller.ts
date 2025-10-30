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
import { CreateBackupDto, BackupResponseDto, RestoreBackupResponseDto } from './dto';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators';
import { createReadStream } from 'fs';

@ApiTags('backups')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new database backup (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Backup created successfully',
    type: BackupResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - backup creation failed',
  })
  async createBackup(@Body() createBackupDto: CreateBackupDto): Promise<BackupResponseDto> {
    return await this.backupService.createBackup(createBackupDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all backups (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of all backups',
    type: [BackupResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async getAllBackups(): Promise<BackupResponseDto[]> {
    return await this.backupService.getAllBackups();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backup by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Backup details',
    type: BackupResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Backup not found',
  })
  async getBackupById(@Param('id', ParseIntPipe) id: number): Promise<BackupResponseDto> {
    return await this.backupService.getBackupById(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download backup file (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Backup file download',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
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

    @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore database from backup' })
  @ApiResponse({ status: 200, description: 'Database restored successfully', type: RestoreBackupResponseDto })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  @ApiResponse({ status: 500, description: 'Restore failed' })
  async restoreBackup(@Param('id', ParseIntPipe) id: number): Promise<RestoreBackupResponseDto> {
    return await this.backupService.restoreBackup(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete backup (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Backup deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
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