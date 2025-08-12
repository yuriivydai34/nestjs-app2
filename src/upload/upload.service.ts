import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma.service';

export interface FileData {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  uploadDate: Date;
}

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) { }

  async saveFile(file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    // Check if file exists and was uploaded successfully
    if (!file) {
      throw new Error('No file uploaded');
    }

    // If using diskStorage (which you are), the file is already saved to disk
    // and file.path contains the path to the saved file
    if (file.path) {
      await this.prisma.file.create({
        data: {
          filename: file.path.split('upload/')[1],
          url: file.path,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      });

      return {
        message: 'File uploaded successfully',
        data: {
          filename: file.path.split('upload/')[1],
          originalName: file.originalname,
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

  getFiles() {
    return this.prisma.file.findMany();
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