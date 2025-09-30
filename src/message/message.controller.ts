import { Body, Controller, Get, Param, Post, Put, Request } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}
  
  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messageService.create(createMessageDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.messageService.findAll(+req.user.sub);
  }

  @Get('users/:userId/:otherUserId')
  findByUserIds(@Param('userId') userId: string, @Param('otherUserId') otherUserId: string) {
    return this.messageService.findByUserIds(+userId, +otherUserId);
  }

  @Get('room/:roomId')
  findByRoomId(@Param('roomId') roomId: string) {
    return this.messageService.findByRoomId(roomId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messageService.findOne(+id);
  }

  @Put('read')
  markAsRead(@Body('ids') ids: number[]) {
    return this.messageService.update(ids, true);
  }

  @Put('unread')
  markAsUnread(@Body('ids') ids: number[]) {
    return this.messageService.update(ids, false);
  }
}
