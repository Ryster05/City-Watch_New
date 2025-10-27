import nodemailer, { Transporter } from 'nodemailer';
import webpush from 'web-push';
import { Notification, NotificationTemplate, INotification, INotificationPreferences } from '../models/Notification';
import { User } from '../models/User';
import { logger } from '../config/logger';
import { env } from '../config/environment';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
}

interface NotificationData {
  userId: string;
  type: INotification['type'];
  title: string;
  message: string;
  metadata?: INotification['metadata'] | Record<string, any>;
  priority?: INotification['priority'];
  scheduledFor?: Date;
  expiresAt?: Date;
  channels?: ('email' | 'push' | 'inApp')[];
}

export class NotificationService {
  private emailTransporter?: Transporter;
  private isEmailConfigured: boolean = false;
  private isPushConfigured: boolean = false;

  constructor() {
    this.initializeEmailService();
    this.initializePushService();
  }

    // Send Email Verification Code
    async sendVerificationEmail(userId: string, email: string, name: string, verificationCode: string): Promise<INotification> {
      try {
        const notificationData: NotificationData = {
          userId,
          type: 'email_verification',
          title: 'Verify Your Email',
          message: `Your email verification code is: ${verificationCode}`,
          metadata: {
            verificationCode,
            email
          },
          priority: 'high',
          channels: ['email']
        };

        // Override the standard variables for email template
        const notification = await this.createNotification({
          ...notificationData,
          metadata: {
            ...notificationData.metadata,
            userName: name,
            verificationCode: verificationCode
          }
        });

        logger.info(`Verification email sent to ${email}`);
        return notification;
      } catch (error) {
        logger.error('Failed to send verification email:', error);
        throw error;
      }
    }

  // Initialize email service
  private initializeEmailService(): void {
    try {
      if (env.email?.host && env.email?.user && env.email?.pass) {
        this.emailTransporter = nodemailer.createTransport({
          host: env.email.host,
          port: env.email.port || 587,
          secure: env.email.secure || false,
          auth: {
            user: env.email.user,
            pass: env.email.pass
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        // Verify email connection
        this.emailTransporter?.verify()
          .then(() => {
            this.isEmailConfigured = true;
            logger.info('Email service initialized successfully');
          })
          .catch((error) => {
            logger.warn('Email service verification failed:', error.message);
            this.isEmailConfigured = false;
          });
      } else {
        logger.warn('Email service not configured - missing environment variables');
      }
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isEmailConfigured = false;
    }
  }

  // Initialize push notification service (Web Push)
  private initializePushService(): void {
    try {
      if (env.webPush?.publicKey && env.webPush?.privateKey) {
        // Set VAPID details for web-push
        webpush.setVapidDetails(
          env.webPush.contact || 'mailto:admin@clarifai.com',
          env.webPush.publicKey,
          env.webPush.privateKey
        );
        this.isPushConfigured = true;
        logger.info('Push notification service initialized successfully');
      } else {
        logger.warn('Push notification service not configured - missing VAPID keys');
      }
    } catch (error) {
      logger.error('Failed to initialize push notification service:', error);
      this.isPushConfigured = false;
    }
  }

  // Send password reset notification
  async sendForgotPasswordNotification(userId: string, email: string, token: string): Promise<INotification> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const notificationData: NotificationData = {
        userId,
        type: 'password_reset',
        title: 'Password Reset Requested',
        message: `A password reset has been requested for your account. If this wasn't you, please secure your account immediately.`,
        metadata: {
          resetToken: token,
          email,
          userName: user.name
        },
        priority: 'high',
        channels: ['email', 'inApp']
      };

      const notification = await this.createNotification(notificationData);

      logger.info(`Forgot password notification sent for user ${userId}`);
      return notification;
    } catch (error) {
      logger.error('Failed to send forgot password notification:', error);
      throw error;
    }
  }

  // Create a new notification
  async createNotification(data: NotificationData): Promise<INotification> {
    try {
      // Get user preferences
      const user = await User.findById(data.userId).select('preferences');
      if (!user) {
        throw new Error('User not found');
      }

      const preferences = user.preferences?.notifications as INotificationPreferences || {
        email: true,
        push: true,
        inApp: true,
        anomalyDetection: true,
        dataChanges: true,
        collaborationUpdates: true,
        systemAlerts: true,
        frequency: 'instant'
      };

      // Check if user wants this type of notification
      if (!this.shouldSendNotification(data.type, preferences)) {
        logger.debug(`Notification skipped for user ${data.userId} - disabled in preferences`);
        return null as any;
      }

      // Determine which channels to use based on preferences and availability
      const channels = this.determineChannels(data.channels, preferences);

      // Create notification document
      const notification = new Notification({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        priority: data.priority || 'normal',
        scheduledFor: data.scheduledFor,
        expiresAt: data.expiresAt,
        channels: {
          email: { sent: false },
          push: { sent: false },
          inApp: { sent: false, read: false }
        }
      });

      await notification.save();

      // Send notification immediately if not scheduled
      if (!data.scheduledFor || data.scheduledFor <= new Date()) {
        await this.sendNotification(notification, channels);
      }

      logger.info(`Notification created for user ${data.userId}: ${data.title}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Send notification through specified channels
  async sendNotification(notification: INotification, channels: string[] = ['inApp']): Promise<void> {
    const results: { channel: string; success: boolean; error?: string }[] = [];

    // Process channels sequentially to avoid parallel document saves
    if (channels.includes('inApp')) {
      try {
        await this.sendInAppNotification(notification);
        results.push({ channel: 'inApp', success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Notification channel inApp failed:`, error);
        results.push({ channel: 'inApp', success: false, error: errorMessage });
      }
    }

    // Send email if configured and requested
    if (channels.includes('email') && this.isEmailConfigured) {
      try {
        await this.sendEmailNotification(notification);
        results.push({ channel: 'email', success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Notification channel email failed:`, error);
        results.push({ channel: 'email', success: false, error: errorMessage });
      }
    }

    // Send push notification if configured and requested
    if (channels.includes('push') && this.isPushConfigured) {
      try {
        await this.sendPushNotification(notification);
        results.push({ channel: 'push', success: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Notification channel push failed:`, error);
        results.push({ channel: 'push', success: false, error: errorMessage });
      }
    }

    // Update overall notification status
    try {
      // Get the latest version of the document to check if all channels are sent
      const updatedNotification = await Notification.findById(notification._id);
      if (updatedNotification) {
        const allSent = Object.values(updatedNotification.channels).some(ch => ch.sent);
        if (allSent && updatedNotification.status === 'pending') {
          await Notification.findByIdAndUpdate(
            notification._id,
            { $set: { status: 'sent' } }
          );
        }
      }
    } catch (error) {
      logger.error('Failed to update notification status:', error);
    }
  }

  // Send in-app notification
  private async sendInAppNotification(notification: INotification): Promise<void> {
    try {
      // Use atomic update to avoid parallel save issues
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.inApp.sent': true,
            'channels.inApp.sentAt': new Date()
          }
        }
      );
      
      // Emit socket event for real-time notification
      if (global.socketService) {
        global.socketService.emitToUser(notification.userId.toString(), 'notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
          priority: notification.priority,
          createdAt: notification.createdAt
        });
      } else {
        logger.debug('No active sockets found for user ' + notification.userId.toString());
      }

      logger.debug(`In-app notification sent to user ${notification.userId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Use atomic update for error as well
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.inApp.error': errorMessage
          }
        }
      );
      
      throw error;
    }
  }

  // Send email notification
  private async sendEmailNotification(notification: INotification): Promise<void> {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email service not configured');
      }

      // Get user email
      const user = await User.findById(notification.userId).select('email firstName lastName');
      if (!user) {
        throw new Error('User not found');
      }

      // Get or create email template
      const template = await this.getEmailTemplate(notification.type);
      const { subject, html } = this.renderEmailTemplate(template, notification, user);

      const emailOptions: EmailOptions = {
        to: user.email,
        subject,
        html,
        text: notification.message
      };

      const result = await this.emailTransporter.sendMail({
        from: env.email?.from || 'ClarifAI <noreply@clarifai.com>',
        ...emailOptions
      });

      // Use atomic update to avoid parallel save issues
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.email.sent': true,
            'channels.email.sentAt': new Date(),
            'channels.email.emailId': result.messageId
          }
        }
      );
      
      logger.debug(`Email notification sent to ${user.email}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Use atomic update for error as well
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.email.error': errorMessage
          }
        }
      );
      
      throw error;
    }
  }

  // Send push notification
  private async sendPushNotification(notification: INotification): Promise<void> {
    try {
      // This is a placeholder for actual push notification implementation
      // You would typically use libraries like web-push for browser notifications
      // or FCM for mobile notifications
      
      const pushData: PushNotificationOptions = {
        userId: notification.userId.toString(),
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          metadata: notification.metadata
        },
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png'
      };

      // Simulate push notification sending
      // In real implementation, you would use web-push or similar service
      logger.debug('Push notification would be sent:', pushData);

      const pushId = `push_${Date.now()}`;
      
      // Use atomic update to avoid parallel save issues
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.push.sent': true,
            'channels.push.sentAt': new Date(),
            'channels.push.pushId': pushId
          }
        }
      );
      
      logger.debug(`Push notification sent to user ${notification.userId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Use atomic update for error as well
      await Notification.findByIdAndUpdate(
        notification._id,
        {
          $set: {
            'channels.push.error': errorMessage
          }
        }
      );
      
      throw error;
    }
  }

  // Get email template for notification type
  private async getEmailTemplate(type: string): Promise<any> {
    try {
      let template = await NotificationTemplate.findOne({ type, isActive: true });
      
      if (!template) {
        // Create default template if none exists
        template = await this.createDefaultTemplate(type);
      }

      return template;
    } catch (error) {
      logger.error('Failed to get email template:', error);
      return this.getDefaultEmailTemplate(type);
    }
  }

  // Create default template for notification type
  private async createDefaultTemplate(type: string): Promise<any> {
    const templates = {
      password_reset: {
        name: 'Password Reset',
        subject: 'Reset Your City Watch Password',
        emailTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2a65f5;">Password Reset Request</h2>
            <p>Hello {{userName}},</p>
            <p>We received a request to reset your City Watch password.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p>To reset your password, please use this code: </p>
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #2a65f5;">{{resetToken}}</p>
            </div>
            <p>This reset code will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email and ensure your account is secure.</p>
            <p>Best regards,<br>City Watch Team</p>
          </div>
        `,
        pushTemplate: 'Your City Watch password reset code: {{resetToken}}',
        inAppTemplate: 'Password reset requested. Check your email for instructions.'
      },
      email_verification: {
        name: 'Email Verification',
        subject: 'Verify Your City Watch Account',
        emailTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2a65f5;">Verify Your Email</h2>
            <p>Hello {{userName}},</p>
            <p>Welcome to City Watch! Please use the following verification code to complete your registration:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #2a65f5;">{{verificationCode}}</p>
            </div>
            <p>This code will expire in 1 hour.</p>
            <p>If you didn't create a City Watch account, you can safely ignore this email.</p>
            <p>Best regards,<br>City Watch Team</p>
          </div>
        `,
        pushTemplate: 'Your City Watch verification code: {{verificationCode}}',
        inAppTemplate: 'Please verify your email using code: {{verificationCode}}'
      },
      data_change: {
        name: 'Data Change Alert',
        subject: 'Data Change Detected - {{datasetName}}',
        emailTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Data Change Alert</h2>
            <p>Hello {{userName}},</p>
            <p>We detected changes in your dataset <strong>{{datasetName}}</strong>.</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Details:</strong> {{message}}</p>
            </div>
            <p><a href="{{actionUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Dataset</a></p>
            <p>Best regards,<br>ClarifAI Team</p>
          </div>
        `,
        pushTemplate: 'Data change detected in {{datasetName}}',
        inAppTemplate: '{{message}}'
      },
      anomaly_detected: {
        name: 'Anomaly Detection Alert',
        subject: 'Anomaly Detected - {{datasetName}}',
        emailTemplate: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">Anomaly Alert</h2>
            <p>Hello {{userName}},</p>
            <p>An anomaly has been detected in your dataset <strong>{{datasetName}}</strong>.</p>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Severity:</strong> {{severity}}</p>
              <p><strong>Details:</strong> {{message}}</p>
            </div>
            <p><a href="{{actionUrl}}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Investigate</a></p>
            <p>Best regards,<br>ClarifAI Team</p>
          </div>
        `,
        pushTemplate: 'Anomaly detected in {{datasetName}} - {{severity}} severity',
        inAppTemplate: '{{message}}'
      }
    };

    const templateData = templates[type as keyof typeof templates] || templates.data_change;
    
    const template = new NotificationTemplate({
      name: templateData.name,
      type,
      subject: templateData.subject,
      emailTemplate: templateData.emailTemplate,
      pushTemplate: templateData.pushTemplate,
      inAppTemplate: templateData.inAppTemplate,
      variables: ['userName', 'datasetName', 'message', 'actionUrl', 'severity'],
      isActive: true
    });

    await template.save();
    return template;
  }

  // Get default email template fallback
  private getDefaultEmailTemplate(type: string): any {
    return {
      subject: 'ClarifAI Notification',
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>{{title}}</h2>
          <p>{{message}}</p>
          <p>Best regards,<br>ClarifAI Team</p>
        </div>
      `
    };
  }

  // Render email template with data
  private renderEmailTemplate(template: any, notification: INotification, user: any): { subject: string; html: string } {
    const variables = {
      userName: user.firstName + ' ' + user.lastName,
      title: notification.title,
      message: notification.message,
      datasetName: (notification.metadata?.relatedData as any)?.datasetName || 'Unknown Dataset',
      severity: notification.metadata?.severity || 'medium',
      actionUrl: notification.metadata?.actionUrl || env.cors.frontendUrl
    };

    let subject = template.subject;
    let html = template.emailTemplate;

    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
    });

    return { subject, html };
  }

  // Check if notification should be sent based on user preferences
  private shouldSendNotification(type: INotification['type'], preferences: INotificationPreferences): boolean {
    switch (type) {
      case 'data_change':
        return preferences.dataChanges;
      case 'anomaly_detected':
        return preferences.anomalyDetection;
      case 'collaboration_update':
        return preferences.collaborationUpdates;
      case 'system_alert':
        return preferences.systemAlerts;
      default:
        return true;
    }
  }

  // Determine which channels to use
  private determineChannels(requestedChannels?: string[], preferences?: INotificationPreferences): string[] {
    const defaultChannels = ['inApp'];
    
    if (!requestedChannels) {
      if (preferences?.email && this.isEmailConfigured) defaultChannels.push('email');
      if (preferences?.push && this.isPushConfigured) defaultChannels.push('push');
      return defaultChannels;
    }

    const availableChannels = requestedChannels.filter(channel => {
      switch (channel) {
        case 'email':
          return this.isEmailConfigured && preferences?.email !== false;
        case 'push':
          return this.isPushConfigured && preferences?.push !== false;
        case 'inApp':
          return preferences?.inApp !== false;
        default:
          return false;
      }
    });

    return availableChannels.length > 0 ? availableChannels : ['inApp'];
  }

  // Process pending notifications (for scheduled notifications)
  async processPendingNotifications(): Promise<void> {
    try {
      const pendingNotifications = await (Notification as any).findPendingNotifications();
      
      for (const notification of pendingNotifications) {
        try {
          await this.sendNotification(notification);
        } catch (error) {
          logger.error(`Failed to send notification ${notification._id}:`, error);
        }
      }

      if (pendingNotifications.length > 0) {
        logger.info(`Processed ${pendingNotifications.length} pending notifications`);
      }
    } catch (error) {
      logger.error('Failed to process pending notifications:', error);
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await Notification.findOne({ _id: notificationId, userId });
      if (notification) {
        await notification.markAsRead();
      }
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for user
  async markAllAsReadForUser(userId: string): Promise<void> {
    try {
      await (Notification as any).markAllAsReadForUser(userId);
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Get user notifications
  async getUserNotifications(userId: string, options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  } = {}): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    try {
      const { page = 1, limit = 20, unreadOnly = false, type } = options;
      const skip = (page - 1) * limit;

      const query: any = { userId };
      if (unreadOnly) {
        query['channels.inApp.read'] = false;
      }
      if (type) {
        query.type = type;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments(query),
        Notification.countDocuments({ userId, 'channels.inApp.read': false })
      ]);

     return { notifications: notifications as unknown as INotification[], total, unreadCount };
    } catch (error) {
      logger.error('Failed to get user notifications:', error);
      throw error;
    }
  }

  // Service status check
  getServiceStatus(): { email: boolean; push: boolean; inApp: boolean } {
    return {
      email: this.isEmailConfigured,
      push: this.isPushConfigured,
      inApp: true // Always available
    };

    
  }
}

export const notificationService = new NotificationService();
