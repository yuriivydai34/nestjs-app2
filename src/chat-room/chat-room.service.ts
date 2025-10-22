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

  findOne(id: string) {
    return this.prisma.chatRoom.findUnique({
      where: { id },
    });
  }

  update(id: string, updateChatRoomDto: UpdateChatRoomDto) {
    return this.prisma.chatRoom.update({
      where: { id },
      data: updateChatRoomDto,
    });
  }

  remove(id: string) {
    return this.prisma.chatRoom.delete({
      where: { id },
    });
  }

  removeMembers(roomId: string, userIds: number[]) {
    // return this.prisma.chatRoom.update({
    //   where: { id: roomId },
    //   data: {
    //     members: {
    //       disconnect: userIds.map(id => ({ id })),
    //     },
    //   },
    // });
    throw new Error('Not implemented yet');
  }

  async findUserRooms(userId: number) {
    return this.prisma.chatRoom.findMany({
      where: {
        members: {
          has: userId
        }
      }
    });
  }

  async addMembers(roomId: string, userIds: number[]) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId }
    });
    
    if (!room) {
      throw new Error('Room not found');
    }

    const updatedMembers = [...new Set([...room.members, ...userIds])];
    
    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        members: updatedMembers
      }
    });
  }
}
