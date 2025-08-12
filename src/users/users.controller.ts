import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from 'generated/prisma/client';
import CreateUserDto from './dto/create';
import { Public } from 'src/auth/decorators';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Public()
    @Post()
    async create(@Body() createUserDto: CreateUserDto): Promise<User> {
        return this.usersService.create(createUserDto);
    }
}
