import { Controller, Get, Param, Request } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}
  
  @Get()
  findAll(@Request() req) {
    return this.messageService.findAll(+req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messageService.findOne(+id);
  }
}
