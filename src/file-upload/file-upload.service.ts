import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma.service';

export interface FileData {
  id?: number;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  uploadDate: Date;
}

@Injectable()
export class FileUploadService {
  constructor(private prisma: PrismaService) { }

  async saveFile(file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    // Check if file exists and was uploaded successfully
    if (!file) {
      throw new Error('No file uploaded');
    }

    // If using diskStorage (which you are), the file is already saved to disk
    // and file.path contains the path to the saved file
    if (file.path) {
      // Use the original filename (with Cyrillic) for both DB and disk
      const uploadDir = path.dirname(file.path);
      const originalFilePath = path.join(uploadDir, file.originalname);

      // If the file was saved with a different name, rename it to the original
      if (file.path !== originalFilePath) {
        fs.renameSync(file.path, originalFilePath);
      }

      await this.prisma.file.create({
        data: {
          filename: file.originalname, // Preserve original (Cyrillic) filename
          url: originalFilePath,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      });

      return {
        message: 'File uploaded successfully',
        data: {
          filename: file.originalname,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          url: originalFilePath,
          uploadDate: new Date(),
        }
      };
    }

    // Fallback for memory storage (if file.buffer is available)
    if (file.buffer) {
      const uploadDir = './upload';

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, file.originalname);
      await fs.promises.writeFile(filePath, file.buffer);

      return {
        message: 'File saved successfully',
        data: {
          filename: filePath.split('upload/')[1],
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          url: filePath,
          uploadDate: new Date(),
        }
      };
    }

    throw new Error('File upload failed: neither path nor buffer available');
  }

  async getFile(id: number): Promise<FileData> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new Error(`File with ID ${id} not found`);
    }
    return file;
  }

  async getAllFiles(): Promise<FileData[]> {
    return this.prisma.file.findMany();
  }

  async getFilesIds(ids: number[]): Promise<FileData[]> {
    const numericIds = ids.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
    return this.prisma.file.findMany({
      where: { id: { in: numericIds } },
    });
  }

  async deleteFile(id: number) {
    // Ensure the file exists before attempting to delete
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw new Error(`File with ID ${id} not found`);
    }

    // Delete the file from the filesystem
    const filePath = path.join('./upload', file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    } else {
      throw new Error(`File not found on disk: ${filePath}`);
    }

    // Delete the file record from the database
    await this.prisma.file.delete({ where: { id } });

    return { message: 'File deleted successfully' };
  }
}