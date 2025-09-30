import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) { }

  create(createMessageDto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        ...createMessageDto,
        roomId: createMessageDto.roomId != null
          ? (typeof createMessageDto.roomId === 'string'
              ? createMessageDto.roomId
              : String(createMessageDto.roomId))
          : undefined,
        timestamp: new Date().toISOString(),
        isRead: false, // default value
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
    });
  }

  findOne(id: number) {
    return this.prisma.message.findUnique({
      where: { id },
    });
  }

  findByRoomId(roomId: string) {
    return this.prisma.message.findMany({
      where: { roomId },
    });
  }

  findByUserIds(userId: number, otherUserId: number) {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
  }

  update(ids: number[], isRead: boolean) {
    return this.prisma.message.updateMany({
      where: { id: { in: ids } },
      data: { isRead },
    });
  }
}
