import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Put } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller('user-profile')
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Get()
  findMe(@Request() req) {
    return this.userProfileService.findMe(req.user.sub);
  }

  @Put()
  updateMy(@Request() req, @Body() updateUserProfileDto: UpdateUserProfileDto) {
    return this.userProfileService.updateMy(req.user.sub, updateUserProfileDto);
  }
}
