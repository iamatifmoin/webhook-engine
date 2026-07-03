import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookSource, WebhookSourceSchema } from './webhook-sources.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: WebhookSource.name,
        schema: WebhookSourceSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class WebhookSourcesModule {}

