import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('health')
  async getHealth() {
    return this.dashboardService.getHealth();
  }
}
