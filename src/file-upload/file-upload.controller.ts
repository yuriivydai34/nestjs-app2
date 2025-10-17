
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { FileUploadService, FileData } from './file-upload.service';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('file-upload')
@Controller('file-upload')
export class FileUploadController {
  constructor(
    private readonly uploadService: FileUploadService,
  ) { }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check MinIO service health' })
  @ApiResponse({ status: 200, description: 'MinIO service health status' })
  async healthCheck() {
    return await this.uploadService.healthCheck();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata by ID' })
  @ApiResponse({ status: 200, description: 'File metadata retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(@Param('id') id: string): Promise<FileData> {
    return await this.uploadService.getFile(+id);
  }

  @Public()
  @Get(':id/download')
  @ApiOperation({ summary: 'Download file directly from MinIO' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { stream, filename, mimetype } = await this.uploadService.getFileStream(+id);
      
      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      stream.pipe(res);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all files metadata' })
  @ApiResponse({ status: 200, description: 'Files list retrieved successfully' })
  async getAllFiles(): Promise<FileData[]> {
    return await this.uploadService.getAllFiles();
  }

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file to MinIO cloud storage' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 500, description: 'File upload failed' })
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    return await this.uploadService.saveFile(file);
  }

  @Public()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete file from MinIO and database' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('id') id: string) {
    return await this.uploadService.deleteFile(+id);
  }
}
