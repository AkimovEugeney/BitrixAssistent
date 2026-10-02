import { Module } from '@nestjs/common';
import { BitrixController } from './bitrix/bitrix.controller';
import { BitrixClientProvider } from './bitrix/bitrix-client.provider';
import { BitrixService } from './bitrix/bitrix.service';
import { TaskApplicationService } from './application/task-application.service';
import { HealthController } from './health.controller';
import { McpController } from './mcp/mcp.controller';
import { ProjectAliasService } from './projects/project-alias.service';
import { LocalStateService } from './storage/local-state.service';
import { WorkContextService } from './work-context/work-context.service';

@Module({
  controllers: [HealthController, BitrixController, McpController],
  providers: [BitrixService, BitrixClientProvider, LocalStateService, ProjectAliasService, WorkContextService, TaskApplicationService],
})
export class AppModule {}
