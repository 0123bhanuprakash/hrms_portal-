import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentAccess } from '../../common';
import type { AccessContext } from '../access/access.types';
import { NotificationsService } from './notifications.service';

class NotificationQueryDto {
  // Read the raw query value: implicit conversion would turn the string 'false' into true
  @IsOptional() @Transform(({ obj }) => obj.unreadOnly === true || obj.unreadOnly === 'true') @IsBoolean() unreadOnly?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

/** The signed-in user's own inbox (no permission needed — it is theirs). */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentAccess() access: AccessContext, @Query() query: NotificationQueryDto) {
    return this.notifications.list(access.userId, query);
  }

  @Get('unread-count')
  async unread(@CurrentAccess() access: AccessContext) {
    return { count: await this.notifications.unreadCount(access.userId) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentAccess() access: AccessContext) {
    return this.notifications.markAllRead(access.userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentAccess() access: AccessContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(access.userId, id);
  }
}
