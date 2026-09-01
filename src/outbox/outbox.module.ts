import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';

import { RabbitmqModule } from '../rabbitmq/rabbitmq.module.js';

import { OutboxPublisherService } from './outbox-publisher.service.js';

@Module({
  imports: [
    PrismaModule,
    RabbitmqModule,
  ],

  providers: [
    OutboxPublisherService,
  ],
})
export class OutboxModule {}