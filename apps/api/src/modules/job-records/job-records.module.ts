import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobRecord, JobRecordSchema } from './job-records.schema';
import { JobRecordsService } from './job-records.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: JobRecord.name,
        schema: JobRecordSchema,
      },
    ]),
  ],
  providers: [JobRecordsService],
  exports: [MongooseModule, JobRecordsService],
})
export class JobRecordsModule {}
