
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../auth/decorators';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { FileUploadService, FileData } from './file-upload.service';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    private readonly uploadService: FileUploadService,
  ) { }

  @Public()
  @Get(':id')
  async getFile(@Param('id') id: string): Promise<FileData> {
    return await this.uploadService.getFile(+id);
  }

  @Public()
  @Get()
  async getAllFiles(): Promise<FileData[]> {
    return await this.uploadService.getAllFiles();
  }

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    return await this.uploadService.saveFile(file);
  }

  @Public()
  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.uploadService.deleteFile(+id);
  }
}
