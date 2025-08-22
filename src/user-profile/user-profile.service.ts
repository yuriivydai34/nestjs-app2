import { Injectable } from '@nestjs/common';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class UserProfileService {
  constructor(private prisma: PrismaService) { }
  
  findMe(userId: number) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  updateMy(userId: number, updateUserProfileDto: UpdateUserProfileDto) {
    return this.prisma.userProfile.update({
      where: { userId },
      data: updateUserProfileDto,
    });
  }
}
