import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { EmailNotifyHandler } from './handlers/email-notify.handler';
import { HttpDispatchHandler } from './handlers/http-dispatch.handler';

@Module({
  providers: [ActionsService, HttpDispatchHandler, EmailNotifyHandler],
  exports: [ActionsService],
})
export class ActionsModule {}
