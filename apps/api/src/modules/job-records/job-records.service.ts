import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  JobRecord,
  JobRecordActionResult,
  JobRecordDocument,
  JobRecordStatus,
} from './job-records.schema';

interface CreatePendingJobRecordParams {
  ruleId: string;
  ruleName: string;
  tenantId: string;
  webhookEventId: string;
}

@Injectable()
export class JobRecordsService {
  constructor(
    @InjectModel(JobRecord.name)
    private readonly jobRecordModel: Model<JobRecordDocument>,
  ) {}

  async createOrReusePendingJobRecord(
    params: CreatePendingJobRecordParams,
  ): Promise<{ created: boolean; jobRecord: JobRecordDocument }> {
    const existingJobRecord = await this.jobRecordModel
      .findOne({
        tenantId: params.tenantId,
        webhookEventId: params.webhookEventId,
        ruleId: params.ruleId,
      })
      .exec();

    if (existingJobRecord) {
      return {
        created: false,
        jobRecord: existingJobRecord,
      };
    }

    try {
      const jobRecord = await this.jobRecordModel.create({
        tenantId: params.tenantId,
        webhookEventId: params.webhookEventId,
        ruleId: params.ruleId,
        ruleName: params.ruleName,
        bullJobId: null,
        status: JobRecordStatus.Pending,
        attempts: 0,
        lastError: null,
        actionResults: [],
        completedAt: null,
      });

      return {
        created: true,
        jobRecord,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const jobRecord = await this.jobRecordModel
        .findOne({
          tenantId: params.tenantId,
          webhookEventId: params.webhookEventId,
          ruleId: params.ruleId,
        })
        .exec();

      if (!jobRecord) {
        throw error;
      }

      return {
        created: false,
        jobRecord,
      };
    }
  }

  async findByIdForTenant(
    jobRecordId: string,
    tenantId: string,
  ): Promise<JobRecordDocument | null> {
    return this.jobRecordModel
      .findOne({
        _id: jobRecordId,
        tenantId,
      })
      .exec();
  }

  async setBullJobId(
    jobRecordId: string,
    tenantId: string,
    bullJobId: string,
  ): Promise<void> {
    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: {
            bullJobId,
          },
        },
      )
      .exec();
  }

  async markRunning(jobRecordId: string, tenantId: string): Promise<void> {
    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: {
            status: JobRecordStatus.Running,
            lastError: null,
            completedAt: null,
          },
          $inc: {
            attempts: 1,
          },
        },
      )
      .exec();
  }

  async saveActionResults(
    jobRecordId: string,
    tenantId: string,
    actionResults: JobRecordActionResult[],
  ): Promise<void> {
    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: {
            actionResults,
          },
        },
      )
      .exec();
  }

  async markCompleted(
    jobRecordId: string,
    tenantId: string,
    actionResults?: JobRecordActionResult[],
  ): Promise<void> {
    const setPayload: {
      actionResults?: JobRecordActionResult[];
      completedAt: Date;
      lastError: null;
      status: JobRecordStatus.Completed;
    } = {
      completedAt: new Date(),
      lastError: null,
      status: JobRecordStatus.Completed,
    };

    if (actionResults) {
      setPayload.actionResults = actionResults;
    }

    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: setPayload,
        },
      )
      .exec();
  }

  async markFailed(
    jobRecordId: string,
    tenantId: string,
    error: string,
  ): Promise<void> {
    await this.jobRecordModel
      .updateOne(
        { _id: jobRecordId, tenantId },
        {
          $set: {
            status: JobRecordStatus.Failed,
            lastError: error,
            completedAt: null,
          },
        },
      )
      .exec();
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
