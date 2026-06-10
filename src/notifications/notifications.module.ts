import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';

/**
 * Global so any service (orders, ops, chat, …) can inject FcmService to send
 * real-time push without importing this module explicitly.
 */
@Global()
@Module({
  providers: [FcmService],
  exports: [FcmService],
})
export class NotificationsModule {}
