import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

/**
 * Sends Firebase Cloud Messaging (FCM) push notifications to vendor / delivery /
 * customer devices.
 *
 * Credentials are read once, lazily, from the environment. Either:
 *   - FIREBASE_SERVICE_ACCOUNT  — the full service-account JSON (single line), OR
 *   - FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (3 vars)
 *
 * If no credentials are configured the service becomes a no-op (logs once and
 * returns) so the API keeps working exactly as before — push is purely additive.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;
  private initialized = false;
  private disabled = false;

  private ensureApp(): admin.app.App | null {
    if (this.initialized) return this.app;
    this.initialized = true;

    const credential = this.loadCredential();
    if (!credential) {
      this.disabled = true;
      this.logger.warn(
        'FCM disabled — set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY) to enable real-time push.',
      );
      return null;
    }

    try {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({ credential });
      this.logger.log('FCM initialized — real-time push enabled.');
      return this.app;
    } catch (err) {
      this.disabled = true;
      this.logger.error(`FCM init failed: ${(err as Error).message}`);
      return null;
    }
  }

  private loadCredential(): admin.credential.Credential | null {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (json && json.trim()) {
      try {
        const parsed = JSON.parse(json) as admin.ServiceAccount & { private_key?: string };
        if (typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        return admin.credential.cert(parsed);
      } catch (err) {
        this.logger.error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${(err as Error).message}`);
        return null;
      }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      return admin.credential.cert({ projectId, clientEmail, privateKey });
    }

    return null;
  }

  /** True when credentials are configured and the SDK is ready. */
  isEnabled(): boolean {
    return this.ensureApp() !== null && !this.disabled;
  }

  /**
   * Send a push to a single device token. All `data` values are coerced to
   * strings (an FCM requirement). Returns true on success, false on any
   * failure (invalid token, no credentials, network) — never throws.
   */
  async sendToToken(
    token: string | null | undefined,
    notification: { title: string; body: string },
    data: Record<string, string | number | null | undefined> = {},
  ): Promise<boolean> {
    if (!token || !token.trim()) return false;
    const app = this.ensureApp();
    if (!app) return false;

    const stringData: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && v !== undefined) stringData[k] = String(v);
    }

    try {
      await admin.messaging(app).send({
        token,
        notification: { title: notification.title, body: notification.body },
        data: stringData,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', contentAvailable: true } },
        },
      });
      return true;
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
      return false;
    }
  }
}
