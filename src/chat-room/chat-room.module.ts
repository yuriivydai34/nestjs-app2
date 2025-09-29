import { Module } from '@nestjs/common';
import { ChatRoomService } from './chat-room.service';
import { ChatRoomController } from './chat-room.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChatRoomController],
  providers: [ChatRoomService, PrismaService],
})
export class ChatRoomModule {}
