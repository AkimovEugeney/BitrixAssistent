import { Module } from '@nestjs/common';
import { BitrixController } from './bitrix/bitrix.controller';
import { BitrixService } from './bitrix/bitrix.service';
import { HealthController } from './health.controller';
import { McpController } from './mcp/mcp.controller';

@Module({
  controllers: [HealthController, BitrixController, McpController],
  providers: [BitrixService],
})
export class AppModule {}
