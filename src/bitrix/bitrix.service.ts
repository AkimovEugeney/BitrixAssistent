import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BitrixTask } from './task.dto';

type BitrixApiResponse = {
  result?:
    | {
        task?: {
          id?: string | number;
          title?: string;
          description?: string;
          status?: string;
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
  };
};

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
    const requestUrl = new URL('tasks.task.get', this.webhookUrl);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          taskId,
          select: ['ID', 'TITLE', 'DESCRIPTION', 'STATUS'],
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('Bitrix24 did not respond in time.');
    }

    let body: BitrixApiResponse;
    try {
      body = (await response.json()) as BitrixApiResponse;
    } catch {
      throw new BadGatewayException('Bitrix24 returned an invalid response.');
    }

    if (!response.ok || body.error) {
      if (body.error === 'ERROR_TASK_NOT_FOUND') {
        throw new NotFoundException(`Task ${taskId} was not found in Bitrix24.`);
      }
      if (body.error_description?.includes('higher privileges')) {
        throw new ForbiddenException('The Bitrix24 webhook does not have Tasks access.');
      }
      throw new BadGatewayException(body.error_description ?? 'Bitrix24 rejected the request.');
    }

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
    };
  }
}
