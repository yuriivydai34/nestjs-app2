
import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Public } from '../auth/decorators';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
  ) { }

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return await this.uploadService.saveFile(file);
  }

  @Public()
  @Get()
  async getFiles() {
    return {
      message: 'Files can be uploaded using POST /upload',
      instructions: 'Use POST /upload to upload a file',
    };
  }
}
