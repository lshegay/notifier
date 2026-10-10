export enum NotificationType {
  TELEGRAM = 'telegram',
}

export type NotificationPayload = {
  templateId: string;
  args: Record<string, unknown>;
};

export type NotificationResult = {
  templateId: string;
  providerId: string;
  renderedContent: string;
  args: Record<string, unknown>;
  sentAt: Date;
};

export { renderTemplate } from './template';
