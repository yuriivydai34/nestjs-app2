import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prismaService: PrismaService) {}

  create(createNotificationDto: CreateNotificationDto) {
    return this.prismaService.notification.create({
      data: { ...createNotificationDto },
    });
  }

  findAll(userId: number) {
    return this.prismaService.notification.findMany({
      where: { userId },
    });
  }

  update(userId, ids: number[]) {
    return this.prismaService.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { read: true },
    });
  }
}
