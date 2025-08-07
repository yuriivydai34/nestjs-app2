import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersService } from './user.service';
import { PostsService } from './post.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, UsersService, PostsService, PrismaService],
})
export class AppModule {}
