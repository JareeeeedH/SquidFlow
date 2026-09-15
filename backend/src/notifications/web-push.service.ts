import { Injectable } from '@nestjs/common';
import webpush from 'web-push';
import {
  isInvalidPushSubscriptionError,
  PushDeliveryTarget,
  WebPushSendResult,
} from './web-push.types';

@Injectable()
export class WebPushService {
  private readonly enabled: boolean;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject =
      process.env.VAPID_SUBJECT?.trim() || 'mailto:squidflow@localhost';
    this.enabled = Boolean(publicKey && privateKey);
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    }
  }

  async send(
    subscription: PushDeliveryTarget,
    payload: string,
  ): Promise<WebPushSendResult> {
    if (!this.enabled) {
      return { ok: false, invalid: false };
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload,
      );
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        invalid: isInvalidPushSubscriptionError(error),
      };
    }
  }
}
