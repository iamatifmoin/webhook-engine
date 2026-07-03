import { Body, Controller, Get, Post } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      service: 'debales-webhook-engine',
      status: 'ok',
    };
  }

  @Post('demo/echo')
  echo(@Body() body: Record<string, unknown>) {
    return {
      echoed: true,
      receivedAt: new Date().toISOString(),
      body,
    };
  }
}
