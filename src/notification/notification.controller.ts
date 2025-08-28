import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Put } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll(@Request() req) {
    return this.notificationService.findAll(+req.user.sub);
  }

  @Put()
  update(@Request() req, @Body() ids: number[]) {
    return this.notificationService.update(+req.user.sub, ids);
  }
}
