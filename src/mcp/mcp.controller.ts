import { All, Controller, HttpException, Logger, Req, Res } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { TaskApplicationService } from '../application/task-application.service';
import { BitrixService } from '../bitrix/bitrix.service';

type RegisterTool = (
  name: string,
  definition: Record<string, unknown> & {
    title: string;
    description: string;
  },
  handler: (input: Record<string, unknown>) => Promise<unknown>,
) => void;

@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);
  constructor(private readonly bitrixService: BitrixService, private readonly tasks: TaskApplicationService) {}

  @All('mcp')
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id');
    response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    if (!['POST', 'GET', 'DELETE'].includes(request.method)) {
      response.status(405).end();
      return;
    }

    const server = this.createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    response.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) {
        response.status(500).json({ error: 'Unable to process the MCP request.' });
      }
    }
  }

  private createServer(): McpServer {
    const server = new McpServer({ name: 'bitrix-assistant', version: '0.1.0' });
    // The SDK's inferred Zod type is too deep for TypeScript 5.9 here.
    // Keep the public tool boundary explicit while preserving runtime validation.
    const registerTool = server.registerTool.bind(server) as unknown as RegisterTool;

    registerTool(
      'get_task',
      {
        title: 'Get Bitrix24 task',
        description: 'Returns the ID, title, description, and status of one Bitrix24 task.',
        inputSchema: { taskId: z.number().int().positive() },
      },
      async (input) => this.result(async () => {
        const { groupId: _groupId, ...task } = await this.bitrixService.getTask(this.number(input, 'taskId'));
        return task;
      }),
    );

    registerTool('get_project_tasks', {
      title: 'Get project tasks', description: 'Use when the user asks for active tasks in a specific project alias.',
      inputSchema: { projectAlias: z.string().trim().min(1) },
    }, async (input) => this.result(() => this.tasks.getProjectTasks(this.string(input, 'projectAlias'))));

    registerTool('get_current_context', {
      title: 'Get current task context', description: 'Use before actions that depend on the currently selected task.', inputSchema: {},
    }, async () => this.result(() => this.tasks.getContext()));

    registerTool('set_current_task', {
      title: 'Select current task', description: 'Use only when the user explicitly chooses a task.', inputSchema: { taskId: z.number().int().positive() },
    }, async (input) => this.result(() => this.tasks.selectTask(this.number(input, 'taskId'))));

    registerTool('clear_current_task', {
      title: 'Clear current task', description: 'Clears the currently selected task.', inputSchema: {},
    }, async () => this.result(() => this.tasks.clearCurrentTask()));

    registerTool('add_elapsed_time', {
      title: 'Add elapsed time', description: 'Write time to Bitrix24 only after the user explicitly confirms the task, duration, and description.',
      inputSchema: { taskId: z.number().int().positive().optional(), seconds: z.number().int().positive(), description: z.string().trim().min(1) },
    }, async (input) => this.result(() => this.tasks.addElapsedTime(this.optionalNumber(input, 'taskId'), this.number(input, 'seconds'), this.string(input, 'description'))));

    registerTool('get_project_aliases', {
      title: 'Get project aliases', description: 'Lists configured project aliases.', inputSchema: {},
    }, async () => this.result(() => this.tasks.getProjectAliases()));

    registerTool('bind_project_alias', {
      title: 'Bind project alias', description: 'Validates and saves an alias for a Bitrix24 project.', inputSchema: { alias: z.string().trim().min(1), bitrixGroupId: z.number().int().positive() },
    }, async (input) => this.result(() => this.tasks.bindProjectAlias(this.string(input, 'alias'), this.number(input, 'bitrixGroupId'))));

    return server;
  }

  private async result(operation: () => Promise<unknown>): Promise<unknown> {
    try {
      const value = await operation();
      return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
    } catch (error: unknown) {
      if (error instanceof HttpException) return { isError: true, content: [{ type: 'text', text: error.message }] };
      this.logger.error('MCP tool failed', error instanceof Error ? error.stack : undefined);
      return { isError: true, content: [{ type: 'text', text: 'The requested Bitrix24 action could not be completed.' }] };
    }
  }

  private string(input: Record<string, unknown>, key: string): string {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim()) throw new HttpException(`Invalid ${key}.`, 400);
    return value;
  }

  private number(input: Record<string, unknown>, key: string): number {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new HttpException(`Invalid ${key}.`, 400);
    return value;
  }

  private optionalNumber(input: Record<string, unknown>, key: string): number | undefined {
    return input[key] === undefined ? undefined : this.number(input, key);
  }
}
