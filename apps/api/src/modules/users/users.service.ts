import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

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
      },
      create: {
        userId,
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
      },
    });
  }
}
