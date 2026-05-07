import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { UserRole } from '../../src/common/constants/user-role.constant';
import { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import { Roles } from '../../src/common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { JwtPayload } from '../../src/common/interfaces/jwt-payload.interface';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('analytics/me/:period')
  getMyAnalytics(
    @CurrentUser() user: JwtPayload,
    @Param('period') period: string,
  ) {
    return this.analyticsService.getUserAnalytics(user.sub, period);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/analytics/:period')
  getAdminAnalytics(@Param('period') period: string) {
    return this.analyticsService.getAdminAnalytics(period);
  }
}
