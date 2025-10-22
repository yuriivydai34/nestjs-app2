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
        files: {
          connect: createMessageDto.files?.map(fileId => ({ id: fileId })),
        },
      },
    });
  }

  findAll(userId: number) {
    return this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: { files: true },
    });
  }

  findOne(id: number) {
    return this.prisma.message.findUnique({
      where: { id },
      include: { files: true },
    });
  }

  findByRoomId(roomId: string) {
    return this.prisma.message.findMany({
      where: { roomId },
      include: { files: true },
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
      include: { files: true },
    });
  }

  update(ids: number[], isRead: boolean) {
    return this.prisma.message.updateMany({
      where: { id: { in: ids } },
      data: { isRead },
    });
  }

  async markAsRead(messageIds: number[], userId: number) {
    return this.prisma.message.updateMany({
      where: { 
        id: { in: messageIds },
        receiverId: userId // Only allow users to mark messages sent to them as read
      },
      data: { isRead: true },
    });
  }
}
