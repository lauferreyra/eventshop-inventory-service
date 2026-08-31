import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module.js';

@Module({
  imports: [RabbitmqModule],
  controllers: [AppController],
})
export class AppModule {}