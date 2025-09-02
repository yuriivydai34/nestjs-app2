import { Module } from '@nestjs/common';
import { TaskTemplateService } from './task-template.service';
import { TaskTemplateController } from './task-template.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TaskTemplateController],
  providers: [TaskTemplateService, PrismaService],
})
export class TaskTemplateModule {}
