
import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module.js';

import { RateLimitService } from './rate-limit.service.js';

import { RateLimitController } from './rate-limit.controller.js';   

@Module({
  imports: [
    RedisModule,
  ],
  controllers:[RateLimitController],

  providers: [
    RateLimitService,
  ],
  exports: [
    RateLimitService,
  ],
})
export class RateLimitModule {}