import { Module } from '@nestjs/common';
import { TaskChecklistsService } from './task-checklists.service';
import { TaskChecklistsController } from './task-checklists.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TaskChecklistsController],
  providers: [TaskChecklistsService, PrismaService],
})
export class TaskChecklistsModule {}
