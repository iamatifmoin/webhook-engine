import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DEBUG_SLOW_JOB_KEY, WEBHOOK_ENGINE_QUEUE } from './queue.constants';

@Controller('admin/debug')
export class QueueDebugController {
  constructor(
    @InjectQueue(WEBHOOK_ENGINE_QUEUE)
    private readonly webhookEngineQueue: Queue,
  ) { }

  @Post('slow-next-job')
  async slowNextJob(): Promise<{ set: true }> {
    const redisClient = (await this.webhookEngineQueue.client) as any;
    await redisClient.set(DEBUG_SLOW_JOB_KEY, '1', 'EX', 120);

    return { set: true };
  }
}
