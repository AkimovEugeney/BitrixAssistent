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
};
