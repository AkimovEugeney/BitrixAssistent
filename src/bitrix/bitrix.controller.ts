import { Controller, Get, Param } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import { TaskIdParams } from './task.dto';

@Controller('bitrix')
export class BitrixController {
  constructor(private readonly bitrixService: BitrixService) {}

  @Get('tasks/:id')
  async getTask(@Param() { id }: TaskIdParams): Promise<{ id: number; title: string; description: string; status: string }> {
    const { groupId: _groupId, ...task } = await this.bitrixService.getTask(id);
    return task;
  }
}
