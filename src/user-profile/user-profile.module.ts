import { Module } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UserProfileController } from './user-profile.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [UserProfileController],
  providers: [UserProfileService, PrismaService],
})
export class UserProfileModule {}
