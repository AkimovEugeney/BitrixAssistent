import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class TaskIdParams {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}

export type BitrixTask = {
  id: number;
  title: string;
  description: string;
  status: string;
  groupId: number | null;
};

export type BitrixTaskListItem = Pick<BitrixTask, 'id' | 'title' | 'status'> & {
  deadline: string | null;
};

export type BitrixWorkgroup = { id: number; title: string };
