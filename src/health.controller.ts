import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
