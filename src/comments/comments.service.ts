import { Injectable } from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) { }
  
  create(createCommentDto: CreateCommentDto, userId: number) {
    return this.prisma.comment.create({
      data: {
        ...createCommentDto,
        userId,
      },
    });
  }

  findAll() {
    return this.prisma.comment.findMany();
  }

  findOne(id: number) {
    return this.prisma.comment.findUnique({
      where: { id },
    });
  }

  findByTaskId(taskId: number) {
    return this.prisma.comment.findMany({
      where: { taskId },
    });
  }

  update(id: number, updateCommentDto: UpdateCommentDto) {
    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
    });
  }

  remove(id: number) {
    return this.prisma.comment.delete({
      where: { id },
    });
  }
}
