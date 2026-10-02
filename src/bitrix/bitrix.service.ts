import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BitrixTask, BitrixTaskListItem, BitrixWorkgroup } from './task.dto';

type BitrixApiResponse = {
  result?:
    | {
        task?: {
          id?: string | number;
          title?: string;
          description?: string;
          status?: string;
          groupId?: string | number;
        };
      }
    | [];
  error?: string;
  error_description?: string;
};

type BitrixTaskPayload = {
  task?: {
      id?: string | number;
      title?: string;
      description?: string;
      status?: string;
      groupId?: string | number;
  };
};

type BitrixListPayload = { tasks?: Array<{ id?: string | number; title?: string; status?: string; deadline?: string | null }> };
type BitrixWorkgroupPayload = { ID?: number; NAME?: string };

@Injectable()
export class BitrixService {
  private readonly webhookUrl: URL;

  constructor() {
    const value = process.env.BITRIX_WEBHOOK_URL;
    if (!value) {
      throw new Error('BITRIX_WEBHOOK_URL is required. Add it to .env before starting the service.');
    }

    try {
      this.webhookUrl = new URL(value.endsWith('/') ? value : `${value}/`);
    } catch {
      throw new Error('BITRIX_WEBHOOK_URL must be a valid URL.');
    }
  }

  async getTask(taskId: number): Promise<BitrixTask> {
    const body = await this.call<BitrixApiResponse>('tasks.task.get', {
      taskId,
      select: ['ID', 'TITLE', 'DESCRIPTION', 'STATUS', 'GROUP_ID'],
    });

    if (Array.isArray(body.result)) {
      throw new NotFoundException(
        `Task ${taskId} does not exist or is unavailable to the webhook user.`,
      );
    }

    const task = (body.result as BitrixTaskPayload | undefined)?.task;
    if (!task?.id || !task.title) {
      throw new BadGatewayException('Bitrix24 response did not contain a task.');
    }

    return {
      id: Number(task.id),
      title: task.title,
      description: task.description ?? '',
      status: task.status ?? '',
      groupId: task.groupId ? Number(task.groupId) : null,
    };
  }

  async getOpenGroupTasks(groupId: number): Promise<BitrixTaskListItem[]> {
    const body = await this.call<{ result?: BitrixListPayload }>('tasks.task.list', {
      order: { DEADLINE: 'asc' },
      filter: { GROUP_ID: groupId, '!REAL_STATUS': [5, 6] },
      select: ['ID', 'TITLE', 'STATUS', 'DEADLINE'],
    });
    return (body.result?.tasks ?? []).flatMap((task) => task.id && task.title ? [{
      id: Number(task.id), title: task.title, status: task.status ?? '', deadline: task.deadline ?? null,
    }] : []);
  }

  async getWorkgroup(groupId: number): Promise<BitrixWorkgroup> {
    const body = await this.call<{ result?: BitrixWorkgroupPayload }>('socialnetwork.api.workgroup.get', { params: { groupId } });
    const group = body.result;
    if (!group?.ID || !group.NAME) throw new NotFoundException(`Bitrix24 project ${groupId} was not found.`);
    return { id: group.ID, title: group.NAME };
  }

  async addElapsedTime(taskId: number, seconds: number, description: string): Promise<void> {
    await this.call('task.elapseditem.add', { taskId, fields: { SECONDS: seconds, COMMENT_TEXT: description } });
  }

  private async call<TResponse>(method: string, params: Record<string, unknown>): Promise<TResponse> {
    const requestUrl = new URL(method, this.webhookUrl);
    let response: Response;
    try {
      response = await fetch(requestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(10_000) });
    } catch {
      throw new BadGatewayException('Bitrix24 did not respond in time.');
    }
    let body: TResponse & { error?: string; error_description?: string };
    try { body = (await response.json()) as TResponse & { error?: string; error_description?: string }; }
    catch { throw new BadGatewayException('Bitrix24 returned an invalid response.'); }
    if (!response.ok || body.error) {
      if (body.error === 'ERROR_TASK_NOT_FOUND') throw new NotFoundException('The requested task was not found in Bitrix24.');
      if (body.error_description?.includes('higher privileges')) throw new ForbiddenException('The Bitrix24 webhook does not have the required access.');
      throw new BadGatewayException('Bitrix24 rejected the request.');
    }
    return body;
  }
}
