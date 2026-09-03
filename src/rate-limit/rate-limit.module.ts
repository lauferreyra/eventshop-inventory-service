
import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';

import { RateLimitService } from './rate-limit.service.js';

import { RateLimitController } from './rate-limit.controller.js';   
import { RateLimitGuard } from './rate-limit.guard.js';

@Module({
  imports: [
    RedisModule,
  ],
  controllers:[RateLimitController],

  providers: [
    RateLimitService,
    RateLimitGuard
  ],
  exports: [
    RateLimitService,
  ],
})
export class RateLimitModule {}