import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserInterface, UsersService } from './users.service';
import { User } from '../../generated/prisma/client';
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

    @Public()
    @Get()
    async findAll(): Promise<UserInterface[]> {
        return this.usersService.getAll();
    }
}
