
import { Injectable } from '@nestjs/common';
import { User } from '../../generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import CreateUserDto from './dto/create';
import * as bcrypt from 'bcrypt';

export interface UserInterface {
  id: number;
  username: string;
  UserProfile: {
    firstName: string;
    lastName: string;
    email: string;
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
            firstName: 'firstName',
            lastName: 'lastName',
            email: 'email@example.com'
          }
        }
      }
    });
  }

  getAll(): Promise<UserInterface[]> {
    return this.prisma.user.findMany(
      {
        select: {
          id: true,
          username: true,
          UserProfile: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }
    );
  }
}
