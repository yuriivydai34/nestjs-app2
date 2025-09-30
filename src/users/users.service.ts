
import { Injectable } from '@nestjs/common';
import { User } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import CreateUserDto from './dto/create';
import * as bcrypt from 'bcrypt';

export interface UserInterface {
  id: number;
  username: string;
  UserProfile: {
    name: string;
    email: string;
    role: string;
    avatarUrl: string;
  } | null;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findOne(username: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    return user ?? undefined;
  }

  findById(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  findByIds(userIds: number[]) {
    return this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });
  }

  async create(data: CreateUserDto): Promise<User> {
    const saltOrRounds = 10;
    const password = data.password;
    const hash = await bcrypt.hash(password, saltOrRounds);

    return this.prisma.user.create({
      data: {
        ...data,
        password: hash,
        UserProfile: {
          create: {
            name: 'firstName lastName',
            email: 'email@example.com',
            role: 'user',
            avatarUrl: 'https://img.heroui.chat/image/avatar?w=40&h=40&u=1'
          }
        }
      }
    });
  }

  async getAll(): Promise<UserInterface[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        UserProfile: {
          select: {
            name: true,
            email: true,
            role: true,
            avatarUrl: true
          }
        }
      }
    });

    return users.map(user => ({
      id: user.id,
      username: user.username,
      UserProfile: user.UserProfile
    }));
  }
}
