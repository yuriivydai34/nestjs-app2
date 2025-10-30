import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FileUploadModule } from './file-upload/file-upload.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { MessageModule } from './message/message.module';
import { NotificationModule } from './notification/notification.module';
import { ChatGateway } from './gateways/chat/chat.gateway';
import { MessageService } from './message/message.service';
import { ChatRoomService } from './chat-room/chat-room.service';
import { UsersService } from './users/users.service';
import { PrismaService } from './prisma.service';
import { TaskTemplateModule } from './task-template/task-template.module';
import { TaskChecklistsModule } from './task-checklists/task-checklists.module';
import { ChatRoomModule } from './chat-room/chat-room.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'upload'),
      serveRoot: '/upload/',
    }),
    AuthModule,
    UsersModule,
    FileUploadModule,
    TasksModule,
    CommentsModule,
    UserProfileModule,
    MessageModule,
    NotificationModule,
    TaskTemplateModule,
    TaskChecklistsModule,
    ChatRoomModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService, MessageService, ChatRoomService, UsersService, PrismaService, ChatGateway],
})
export class AppModule { }
