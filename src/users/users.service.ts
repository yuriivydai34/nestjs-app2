
import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import CreateUserDto from './dto/create';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findOne(username: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    return user ?? undefined;
  }

  async create(data: CreateUserDto): Promise<User> {
    const saltOrRounds = 10;
    const password = data.password;
    const hash = await bcrypt.hash(password, saltOrRounds);
    return this.prisma.user.create({
      data: {
        ...data,
        password: hash
      }
    });
  }
}
