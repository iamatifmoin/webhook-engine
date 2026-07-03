import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      service: 'debales-webhook-engine',
      status: 'ok',
    };
  }
}

