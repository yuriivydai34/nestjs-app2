import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaService } from '../prisma.service';
import { NotificationService } from 'src/notification/notification.service';
import { UsersService } from 'src/users/users.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService, PrismaService, NotificationService, UsersService],
})
export class CommentsModule {}
