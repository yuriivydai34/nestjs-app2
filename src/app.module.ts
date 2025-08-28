import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UploadModule } from './upload/upload.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { UserProfileModule } from './user-profile/user-profile.module';
import { MessageModule } from './message/message.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'upload'),
      serveRoot: '/upload/',
    }),
    AuthModule,
    UsersModule,
    UploadModule,
    TasksModule,
    CommentsModule,
    UserProfileModule,
    MessageModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
