import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService, UsersService],
})
export class NotificationModule {}
