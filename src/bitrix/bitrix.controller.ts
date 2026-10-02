import { Controller, Get, Param } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { BitrixTask, TaskIdParams } from './task.dto';

@Controller('bitrix')
export class BitrixController {
  constructor(private readonly bitrixService: BitrixService) {}

  @Get('tasks/:id')
  getTask(@Param() { id }: TaskIdParams): Promise<BitrixTask> {
    return this.bitrixService.getTask(id);
  }
}
