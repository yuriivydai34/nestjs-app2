
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
import { UploadService, FileData } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
  ) { }

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<{ message: string; data?: FileData }> {
    return await this.uploadService.saveFile(file);
  }

  @Public()
  @Get()
  async getFiles() {
    return await this.uploadService.getFiles();
  }

  @Public()
  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.uploadService.deleteFile(+id);
  }
}
