import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  create(createMessageDto: CreateMessageDto, userId: number) {
    return this.prisma.message.create({
      data: {
        ...createMessageDto,
        senderId: userId,
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
}
