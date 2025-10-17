import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma.service';
import * as Minio from 'minio';
import { ErrorSanitizer } from '../utils/error-sanitizer';

export interface FileData {
  id?: number;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  cloudUrl?: string;
  uploadDate: Date;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly minioClient: Minio.Client;
  private readonly minioBucket = process.env.MINIO_BUCKET_FILES || 'files';
  private readonly localUploadDir = './upload';

  constructor(private prisma: PrismaService) {
    // Initialize MinIO client
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    // Ensure local upload directory exists (for temporary storage)
    if (!fs.existsSync(this.localUploadDir)) {
      fs.mkdirSync(this.localUploadDir, { recursive: true });
    }

    // Ensure MinIO bucket exists
    this.ensureBucketExists();
  }

  async saveFile(file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    if (!file) {
      throw new InternalServerErrorException('No file uploaded');
    }

    try {
      // Generate unique filename with proper encoding for international characters
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = path.extname(file.originalname);
      
      // Encode filename to handle Cyrillic and other international characters
      const baseFilename = path.basename(file.originalname, fileExtension);
      const encodedBaseFilename = Buffer.from(baseFilename, 'utf8').toString('base64').replace(/[+/=]/g, '_');
      const uniqueFilename = `${timestamp}_${encodedBaseFilename}${fileExtension}`;
      const objectName = `uploads/${uniqueFilename}`;

      let fileBuffer: Buffer;
      let tempFilePath: string | null = null;

      // Get file buffer
      if (file.buffer) {
        fileBuffer = file.buffer;
      } else if (file.path) {
        // Read file from disk if it was saved temporarily
        fileBuffer = await fs.promises.readFile(file.path);
        tempFilePath = file.path;
      } else {
        throw new Error('No file data available');
      }

      this.logger.log(`Uploading file to MinIO: ${objectName} (original: ${file.originalname})`);

      // Upload to MinIO with proper metadata
      await this.minioClient.putObject(
        this.minioBucket,
        objectName,
        fileBuffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
          'Original-Name': Buffer.from(file.originalname, 'utf8').toString('base64'),
          'X-File-Size': file.size.toString(),
        }
      );

      // Generate presigned URL for access (valid for 7 days)
      const cloudUrl = await this.minioClient.presignedGetObject(
        this.minioBucket,
        objectName,
        7 * 24 * 60 * 60 // 7 days in seconds
      );

      // Save file metadata to database
      const savedFile = await this.prisma.file.create({
        data: {
          filename: uniqueFilename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          url: cloudUrl, // Store the presigned URL
        },
      });

      // Clean up temporary file if it exists
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      this.logger.log(`File uploaded successfully: ${uniqueFilename} (original: ${file.originalname})`);

      return {
        message: 'File uploaded successfully to cloud storage',
        data: {
          id: savedFile.id,
          filename: savedFile.filename,
          originalName: savedFile.originalName,
          size: savedFile.size,
          mimetype: savedFile.mimetype,
          url: savedFile.url,
          cloudUrl: cloudUrl,
          uploadDate: savedFile.uploadDate,
        }
      };
    } catch (error) {
      // Log full error details for debugging
      this.logger.error(`[FILE_UPLOAD] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        Original filename: ${file.originalname}
        File size: ${file.size}
        MinIO Bucket: ${this.minioBucket}
        MinIO Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}
        Timestamp: ${new Date().toISOString()}
      `);

      // Return sanitized error message to user
      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'File upload');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  async getFile(id: number): Promise<FileData> {
    try {
      const file = await this.prisma.file.findUnique({ where: { id } });
      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      // Generate fresh presigned URL if needed (for security)
      const objectName = `uploads/${file.filename}`;
      try {
        const freshCloudUrl = await this.minioClient.presignedGetObject(
          this.minioBucket,
          objectName,
          7 * 24 * 60 * 60 // 7 days
        );

        return {
          ...file,
          cloudUrl: freshCloudUrl,
        };
      } catch (minioError) {
        this.logger.warn(`Failed to generate fresh URL for file ${id}: ${ErrorSanitizer.sanitizeErrorMessage(minioError)}`);
        return file; // Return file data without fresh URL
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get file ${id}: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve file information');
    }
  }

  async getAllFiles(): Promise<FileData[]> {
    try {
      const files = await this.prisma.file.findMany({
        orderBy: { uploadDate: 'desc' },
      });

      // Generate fresh presigned URLs for all files
      const filesWithUrls = await Promise.all(
        files.map(async (file) => {
          try {
            const objectName = `uploads/${file.filename}`;
            const cloudUrl = await this.minioClient.presignedGetObject(
              this.minioBucket,
              objectName,
              7 * 24 * 60 * 60 // 7 days
            );
            return {
              ...file,
              cloudUrl,
            };
          } catch (urlError) {
            this.logger.warn(`Failed to generate URL for file ${file.id}: ${ErrorSanitizer.sanitizeErrorMessage(urlError)}`);
            return file; // Return file without fresh URL
          }
        })
      );

      return filesWithUrls;
    } catch (error) {
      this.logger.error(`Failed to get all files: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve file list');
    }
  }

  async getFilesIds(ids: number[]): Promise<FileData[]> {
    try {
      const numericIds = ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
      const files = await this.prisma.file.findMany({
        where: { id: { in: numericIds } },
      });

      // Generate fresh presigned URLs for requested files
      const filesWithUrls = await Promise.all(
        files.map(async (file) => {
          try {
            const objectName = `uploads/${file.filename}`;
            const cloudUrl = await this.minioClient.presignedGetObject(
              this.minioBucket,
              objectName,
              7 * 24 * 60 * 60 // 7 days
            );
            return {
              ...file,
              cloudUrl,
            };
          } catch (urlError) {
            this.logger.warn(`Failed to generate URL for file ${file.id}: ${ErrorSanitizer.sanitizeErrorMessage(urlError)}`);
            return file;
          }
        })
      );

      return filesWithUrls;
    } catch (error) {
      this.logger.error(`Failed to get files by IDs: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve files');
    }
  }

  async deleteFile(id: number) {
    try {
      // Ensure the file exists before attempting to delete
      const file = await this.prisma.file.findUnique({ where: { id } });
      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      // Delete the file from MinIO
      const objectName = `uploads/${file.filename}`;
      try {
        await this.minioClient.removeObject(this.minioBucket, objectName);
        this.logger.log(`File deleted from MinIO: ${objectName}`);
      } catch (minioError) {
        this.logger.warn(`Failed to delete file from MinIO: ${ErrorSanitizer.sanitizeErrorMessage(minioError)}`);
        // Continue with database deletion even if MinIO deletion fails
      }

      // Delete the file record from the database
      await this.prisma.file.delete({ where: { id } });

      this.logger.log(`File deleted successfully: ${file.filename}`);
      return { message: 'File deleted successfully from cloud storage and database' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`[FILE_DELETE] Full error details for debugging:
        Message: ${error.message}
        Stack: ${error.stack || 'No stack trace'}
        File ID: ${id}
        Timestamp: ${new Date().toISOString()}
      `);

      const userFriendlyMessage = ErrorSanitizer.getUserFriendlyMessage(error, 'File deletion');
      throw new InternalServerErrorException(userFriendlyMessage);
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      // Test MinIO connection first
      await this.testMinIOConnection();
      
      const exists = await this.minioClient.bucketExists(this.minioBucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.minioBucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.minioBucket}`);
      } else {
        this.logger.log(`MinIO bucket verified: ${this.minioBucket}`);
      }
    } catch (error) {
      const sanitizedMessage = ErrorSanitizer.sanitizeErrorMessage(error);
      this.logger.error(`Failed to ensure bucket exists: ${sanitizedMessage}`);
      this.logger.error(`MinIO Configuration - Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}, UseSSL: ${process.env.MINIO_USE_SSL}`);
    }
  }

  private async testMinIOConnection(): Promise<void> {
    try {
      // Simple test to verify MinIO connection
      await this.minioClient.listBuckets();
      this.logger.log('MinIO connection successful');
    } catch (error) {
      this.logger.error(`MinIO connection failed: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      this.logger.error(`Check MinIO credentials and server status`);
      this.logger.error(`Current config - Endpoint: ${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}, AccessKey: ${process.env.MINIO_ACCESS_KEY}`);
      throw error;
    }
  }

  /**
   * Health check endpoint for MinIO service
   */
  async healthCheck(): Promise<{ status: string; buckets?: string[]; error?: string }> {
    try {
      const buckets = await this.minioClient.listBuckets();
      return {
        status: 'healthy',
        buckets: buckets.map(b => b.name),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: ErrorSanitizer.sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Get direct download stream from MinIO (for large files)
   */
  async getFileStream(id: number): Promise<{ stream: NodeJS.ReadableStream; filename: string; mimetype: string }> {
    try {
      const file = await this.prisma.file.findUnique({ where: { id } });
      if (!file) {
        throw new NotFoundException(`File with ID ${id} not found`);
      }

      const objectName = `uploads/${file.filename}`;
      
      // Get object info to retrieve metadata
      let originalFilename = file.originalName;
      try {
        const objectInfo = await this.minioClient.statObject(this.minioBucket, objectName);
        if (objectInfo.metaData && objectInfo.metaData['original-name']) {
          // Decode base64 encoded filename
          originalFilename = Buffer.from(objectInfo.metaData['original-name'], 'base64').toString('utf8');
        }
      } catch (metaError) {
        this.logger.warn(`Failed to get object metadata for ${objectName}: ${ErrorSanitizer.sanitizeErrorMessage(metaError)}`);
        // Use database filename as fallback
      }

      const stream = await this.minioClient.getObject(this.minioBucket, objectName);

      return {
        stream,
        filename: originalFilename,
        mimetype: file.mimetype,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get file stream ${id}: ${ErrorSanitizer.sanitizeErrorMessage(error)}`);
      throw new InternalServerErrorException('Failed to retrieve file');
    }
  }
}