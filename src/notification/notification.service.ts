import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from '../users/users.service';

interface TaskCreatedNotification {
  title: string;
  userIdCreator: number;
  userIdSupervisor: number;
  usersIdAssociate: number[];
}

@Injectable()
export class NotificationService {
  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService) { }

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

  async sendTaskCreatedNotification(notification: TaskCreatedNotification) {
    const userCreator = await this.usersService.findById(notification.userIdCreator);
    if (!userCreator) throw new Error('User creator not found');

    const content = `New task created: ${notification.title} \nCreatedBy: ${userCreator.username}`;
    const userSupervisor = await this.usersService.findById(notification.userIdSupervisor);

    if (!userSupervisor) throw new Error('User supervisor not found');

    await this.prismaService.notification.create({
      data: {
        content: `${content} \nSupervisor: ${userSupervisor.username}`,
        userId: userSupervisor.id
      }
    });

    const userAssociates = await this.usersService.findByIds(notification.usersIdAssociate);
    if (userAssociates.length === 0) throw new Error('No associates found');
    
    const userAssociatesNames = userAssociates.map(user => user.username);
    
    for (const user of userAssociates) {
      await this.prismaService.notification.create({
        data: {
          content: `${content} \nAssociate${userAssociates.length > 1 ? 's' : ''}: ${userAssociatesNames.join(', ')}`,
          userId: user.id
        }
      });
    }
  }
}
