import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookEvent, WebhookEventSchema } from './webhook-events.schema';
import { WebhookEventsService } from './webhook-events.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: WebhookEvent.name,
        schema: WebhookEventSchema,
      },
    ]),
  ],
  providers: [WebhookEventsService],
  exports: [MongooseModule, WebhookEventsService],
})
export class WebhookEventsModule {}
