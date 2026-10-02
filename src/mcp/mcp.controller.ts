import { All, Controller, Req, Res } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { BitrixService } from '../bitrix/bitrix.service';

type RegisterTaskTool = (
  name: string,
  definition: {
    title: string;
    description: string;
    inputSchema: { taskId: z.ZodNumber };
  },
  handler: (input: { taskId: number }) => Promise<unknown>,
) => void;

@Controller()
export class McpController {
  constructor(private readonly bitrixService: BitrixService) {}

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
    const registerTaskTool = server.registerTool.bind(server) as unknown as RegisterTaskTool;

    registerTaskTool(
      'get_task',
      {
        title: 'Get Bitrix24 task',
        description: 'Returns the ID, title, description, and status of one Bitrix24 task.',
        inputSchema: { taskId: z.number().int().positive() },
      },
      async ({ taskId }) => {
        const task = await this.bitrixService.getTask(taskId);
        return {
          content: [{ type: 'text', text: JSON.stringify(task) }],
          structuredContent: task,
        };
      },
    );

    return server;
  }
}
