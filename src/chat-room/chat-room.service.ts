import { Injectable } from '@nestjs/common';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { UpdateChatRoomDto } from './dto/update-chat-room.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ChatRoomService {
  constructor(private prisma: PrismaService) {}

  create(createChatRoomDto: CreateChatRoomDto) {
    return this.prisma.chatRoom.create({
      data: createChatRoomDto,
    });
  }

  findAll() {
    return this.prisma.chatRoom.findMany();
  }

  findOne(id: number) {
    return this.prisma.chatRoom.findUnique({
      where: { id },
    });
  }

  update(id: number, updateChatRoomDto: UpdateChatRoomDto) {
    return this.prisma.chatRoom.update({
      where: { id },
      data: updateChatRoomDto,
    });
  }

  remove(id: number) {
    return this.prisma.chatRoom.delete({
      where: { id },
    });
  }
}
