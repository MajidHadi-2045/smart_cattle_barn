import { Controller, Get } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activities')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get('recent')
  async getRecent() {
    return this.activityService.getRecentLogs();
  }
}
