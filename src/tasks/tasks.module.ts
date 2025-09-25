import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from '../prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { UsersService } from 'src/users/users.service';

@Module({
  imports: [],
  controllers: [TasksController],
  providers: [TasksService, PrismaService, NotificationService, UsersService],
})
export class TasksModule {}
