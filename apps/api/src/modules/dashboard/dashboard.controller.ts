import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { DashboardGuard } from './dashboard.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(DashboardGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('events')
  async getEvents(
    @Tenant('id') tenantId: string,
    @Query() query: { limit?: string; page?: string; status?: string },
  ) {
    return this.dashboardService.listEvents(tenantId, query);
  }

  @Get('jobs')
  async getJobs(
    @Tenant('id') tenantId: string,
    @Query() query: {
      limit?: string;
      page?: string;
      status?: string;
      webhookEventId?: string;
    },
  ) {
    return this.dashboardService.listJobs(tenantId, query);
  }

  @Get('rules')
  async getRules(@Tenant('id') tenantId: string) {
    return this.dashboardService.listRules(tenantId);
  }

  @Post('replay/:jobRecordId')
  async replayJob(
    @Tenant('id') tenantId: string,
    @Param('jobRecordId') jobRecordId: string,
  ) {
    return this.dashboardService.replayJob(tenantId, jobRecordId);
  }
}
