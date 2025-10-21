import { Module } from '@nestjs/common';
import { FileUploadController } from './file-upload.controller';
import { FileUploadService } from './file-upload.service';
import { PrismaService } from 'src/prisma.service';
import { MulterModule } from '@nestjs/platform-express/multer';
import { extname } from 'path';
import { diskStorage } from 'multer';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './upload',
        filename: (req, file, cb) => {
          // Properly decode the original filename to handle Unicode characters
          const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const timestamp = Date.now();
          const randomSuffix = Math.round(Math.random() * 1000);
          const ext = extname(originalName);
          const nameWithoutExt = originalName.replace(ext, '');
          
          // Create a safe filename while preserving the original name structure
          const safeFilename = `${timestamp}_${randomSuffix}_${nameWithoutExt}${ext}`;
          cb(null, safeFilename);
        },
      }),
    }),
  ],
  controllers: [FileUploadController],
  providers: [FileUploadService, PrismaService],
  exports: [FileUploadService],
})
export class FileUploadModule { }
