import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { Prisma } from '@prisma/client';
import { mergeUiState } from './ui-state';
import { NOTIFICATION_TOPICS } from '../notifications/topics';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user profile details
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        isSuperAdmin: true,
        companyId: true,
        emailVerifiedAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            branding: true,
          },
        },
        preferences: true,
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                isSystemRole: true,
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update basic profile info (name, avatar)
   */
  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
  }

  /**
   * Get user preferences (or create default if none exists)
   */
  async getPreferences(userId: string) {
    let prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.userPreferences.create({
        data: {
          userId,
          theme: 'system',
          timezone: 'Asia/Kolkata',
          dateFormat: 'DD/MM/YYYY',
          notificationsEnabled: true,
          emailNotifications: true,
        },
      });
    }

    return prefs;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.assertPersonalizationAllowed(userId, dto);
    // Topic choices merge into what is saved; unknown topics / keys are dropped
    let notificationTopics: Prisma.InputJsonObject | undefined;
    if (dto.notificationTopics) {
      const saved = ((await this.prisma.userPreferences.findUnique({ where: { userId }, select: { notificationTopics: true } }))?.notificationTopics ?? {}) as Record<string, { app?: boolean; email?: boolean }>;
      const merged: Record<string, { app?: boolean; email?: boolean }> = { ...saved };
      for (const t of NOTIFICATION_TOPICS) {
        const c = dto.notificationTopics[t.key];
        if (!c) continue;
        merged[t.key] = {
          ...merged[t.key],
          ...(typeof c.app === 'boolean' && { app: c.app }),
          ...(typeof c.email === 'boolean' && { email: c.email }),
        };
      }
      notificationTopics = merged as Prisma.InputJsonObject;
    }
    const notify = {
      ...(notificationTopics && { notificationTopics }),
      ...(dto.quietHours && { quietHours: { ...dto.quietHours } }),
      ...(dto.dailySummary !== undefined && { dailySummary: dto.dailySummary }),
    };
    const personal = {
      ...(dto.colorTheme !== undefined && { colorTheme: dto.colorTheme }),
      ...(dto.menuStyle !== undefined && { menuStyle: dto.menuStyle }),
      ...(dto.backdropPack !== undefined && { backdropPack: dto.backdropPack }),
      ...(dto.backdropLevel !== undefined && { backdropLevel: dto.backdropLevel }),
    };
    return this.prisma.userPreferences.upsert({
      where: { userId },
      update: {
        ...(dto.theme && { theme: dto.theme }),
        ...(dto.timezone && { timezone: dto.timezone }),
        ...(dto.dateFormat && { dateFormat: dto.dateFormat }),
        ...(dto.notificationsEnabled !== undefined && {
          notificationsEnabled: dto.notificationsEnabled,
        }),
        ...(dto.emailNotifications !== undefined && {
          emailNotifications: dto.emailNotifications,
        }),
        ...(dto.density && { density: dto.density }),
        ...(dto.textSize && { textSize: dto.textSize }),
        ...(dto.reduceMotion !== undefined && { reduceMotion: dto.reduceMotion }),
        ...(dto.notifyNewDevice !== undefined && { notifyNewDevice: dto.notifyNewDevice }),
        ...(dto.idleTimeoutMinutes !== undefined && { idleTimeoutMinutes: dto.idleTimeoutMinutes }),
        ...(dto.reauthForRisky !== undefined && { reauthForRisky: dto.reauthForRisky }),
        ...personal,
        ...notify,
      },
      create: {
        userId,
        ...personal,
        ...notify,
        theme: dto.theme || 'system',
        timezone: dto.timezone || 'Asia/Kolkata',
        dateFormat: dto.dateFormat || 'DD/MM/YYYY',
        notificationsEnabled:
          dto.notificationsEnabled !== undefined
            ? dto.notificationsEnabled
            : true,
        emailNotifications:
          dto.emailNotifications !== undefined
            ? dto.emailNotifications
            : true,
        density: dto.density || 'theme',
        textSize: dto.textSize || 'theme',
        reduceMotion: dto.reduceMotion ?? false,
        notifyNewDevice: dto.notifyNewDevice ?? true,
        idleTimeoutMinutes: dto.idleTimeoutMinutes ?? null,
        reauthForRisky: dto.reauthForRisky ?? false,
      },
    });
  }

  /** A personal theme or menu style only when the company allows it (choosing "company default" is always fine). */
  private async assertPersonalizationAllowed(userId: string, dto: UpdatePreferencesDto) {
    if (!dto.colorTheme && !dto.menuStyle) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, company: { select: { settings: { select: { personalThemes: true, allowedThemes: true, personalMenuStyle: true } } } } },
    });
    const s = user?.company?.settings;
    if (!user?.companyId || !s) return; // platform users: no company rules
    if (dto.colorTheme) {
      if (!s.personalThemes) throw new BadRequestException('Your company doesn’t let people choose their own theme');
      if (s.allowedThemes.length && !s.allowedThemes.includes(dto.colorTheme)) throw new BadRequestException('Your company doesn’t offer that theme');
    }
    if (dto.menuStyle && !s.personalMenuStyle) throw new BadRequestException('Your company doesn’t let people choose their own menu style');
  }

  /** Merge view-setting changes into the person's saved settings. */
  async updateUiState(userId: string, changes: Record<string, unknown>) {
    const prefs = await this.getPreferences(userId);
    const uiState = mergeUiState(prefs.uiState, changes) as Prisma.InputJsonObject;
    const saved = await this.prisma.userPreferences.update({ where: { userId }, data: { uiState }, select: { uiState: true } });
    return saved.uiState;
  }

  async resetUiState(userId: string) {
    await this.getPreferences(userId);
    await this.prisma.userPreferences.update({ where: { userId }, data: { uiState: {} } });
    return {};
  }
}
