import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ChatRoomService } from './chat-room.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { UpdateChatRoomDto } from './dto/update-chat-room.dto';

@Controller('chat-room')
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @Post()
  create(@Body() createChatRoomDto: CreateChatRoomDto) {
    return this.chatRoomService.create(createChatRoomDto);
  }

  @Get()
  findAll() {
    return this.chatRoomService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatRoomService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatRoomDto: UpdateChatRoomDto) {
    return this.chatRoomService.update(id, updateChatRoomDto);
  }

  @Post(':id/members')
  addMembers(@Param('id') id: string, @Body('userIds') userIds: number[]) {
    return this.chatRoomService.addMembers(id, userIds);
  }

  @Delete(':id/members')
  removeMembers(@Param('id') id: string, @Body('userIds') userIds: number[]) {
    return this.chatRoomService.removeMembers(id, userIds);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatRoomService.remove(id);
  }
}
