
import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(username: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    return user ?? undefined;
  }
}
