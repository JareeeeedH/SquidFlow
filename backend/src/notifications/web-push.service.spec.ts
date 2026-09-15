import { isInvalidPushSubscriptionError } from './web-push.types';
import { WebPushService } from './web-push.service';

const sendNotification = jest.fn<Promise<unknown>, unknown[]>();
const setVapidDetails = jest.fn<void, unknown[]>();

jest.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: (...args: unknown[]) => {
      setVapidDetails(...args);
    },
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

describe('isInvalidPushSubscriptionError', () => {
  it('treats 404 and 410 as invalid subscriptions', () => {
    expect(isInvalidPushSubscriptionError({ statusCode: 404 })).toBe(true);
    expect(isInvalidPushSubscriptionError({ statusCode: 410 })).toBe(true);
    expect(isInvalidPushSubscriptionError({ statusCode: 500 })).toBe(false);
    expect(isInvalidPushSubscriptionError(new Error('network'))).toBe(false);
  });
});

describe('WebPushService', () => {
  const originalEnv = { ...process.env };
  const subscription = {
    endpoint: 'https://push.example.test/sub',
    p256dh: 'p256dh',
    auth: 'auth',
  };

  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    process.env = { ...originalEnv };
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not send when VAPID keys are missing', async () => {
    const service = new WebPushService();
    await expect(service.send(subscription, '{"title":"x"}')).resolves.toEqual({
      ok: false,
      invalid: false,
    });
    expect(setVapidDetails).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends a notification when VAPID keys are configured', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:test@localhost';
    sendNotification.mockResolvedValue({});

    const service = new WebPushService();
    await expect(service.send(subscription, '{"title":"x"}')).resolves.toEqual({
      ok: true,
    });

    expect(setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@localhost',
      'public-key',
      'private-key',
    );
    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      '{"title":"x"}',
    );
  });

  it('marks 410 Gone as an invalid subscription', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    sendNotification.mockRejectedValue({ statusCode: 410 });

    const service = new WebPushService();
    await expect(service.send(subscription, '{}')).resolves.toEqual({
      ok: false,
      invalid: true,
    });
  });

  it('keeps other send failures as non-invalid', async () => {
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    sendNotification.mockRejectedValue({ statusCode: 500 });

    const service = new WebPushService();
    await expect(service.send(subscription, '{}')).resolves.toEqual({
      ok: false,
      invalid: false,
    });
  });
});
