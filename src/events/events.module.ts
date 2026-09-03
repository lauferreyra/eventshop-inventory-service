
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { RedisModule } from '../redis/redis.module.js';

import { EventCacheService } from './event-cache.service.js';
import { EventsController } from './events.controller.js';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
  ],
  controllers: [
    EventsController,
  ],
  providers: [
    EventCacheService,
  ],
  exports: [
    EventCacheService,
  ],
})
export class EventsModule {}