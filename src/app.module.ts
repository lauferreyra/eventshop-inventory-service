import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';

import { RabbitmqModule } from './rabbitmq/rabbitmq.module.js';

import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RabbitmqModule,
    PrismaModule,
  ],

  controllers: [
    AppController,
  ],
})
export class AppModule {}