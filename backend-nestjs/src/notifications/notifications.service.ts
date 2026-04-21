import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, status: 'QUEUED' } }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'DELIVERED' },
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, status: 'QUEUED' },
      data: { status: 'DELIVERED' },
    });
  }

  /**
   * Create a notification
   */
  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        channel: 'EMAIL',
        type: data.type || 'INFO',
        title: data.title,
        body: data.message,
        metadata: data.link ? { link: data.link } : null,
        status: 'QUEUED',
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }
}
