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

    // Properly decode the original filename to handle Unicode characters
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // If using diskStorage (which you are), the file is already saved to disk
    // and file.path contains the path to the saved file
    if (file.path) {
      await this.prisma.file.create({
        data: {
          filename: originalName, // Use properly decoded filename
          url: file.path, // Keep the actual file path on disk
          originalName: originalName,
          size: file.size,
          mimetype: file.mimetype,
        },
      });

      return {
        message: 'File uploaded successfully',
        data: {
          filename: originalName,
          originalName: originalName,
          size: file.size,
          mimetype: file.mimetype,
          url: file.path,
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

      const filePath = path.join(uploadDir, originalName);
      await fs.promises.writeFile(filePath, file.buffer);

      await this.prisma.file.create({
        data: {
          filename: originalName,
          url: filePath,
          originalName: originalName,
          size: file.size,
          mimetype: file.mimetype,
        },
      });

      return {
        message: 'File saved successfully',
        data: {
          filename: originalName,
          originalName: originalName,
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

    // Use the actual file path stored in the database (file.url)
    // instead of constructing it from the filename
    const filePath = file.url;
    console.log(`Attempting to delete file at path: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted file: ${filePath}`);
    } else {
      console.warn(`File not found on disk (may have been manually deleted): ${filePath}`);
      // Don't throw an error - just log a warning and continue with DB cleanup
    }

    // Delete the file record from the database
    await this.prisma.file.delete({ where: { id } });

    return {
      message: 'File deleted successfully',
      filename: file.filename
    };
  }
}