import { Module } from '@nestjs/common';

import { RabbitmqPublisherService } from './rabbitmq-publisher.service.js';
import { RabbitmqTopologyService } from './rabbitmq-topology.service.js';

@Module({
  providers: [
    RabbitmqTopologyService,
    RabbitmqPublisherService,
  ],
  exports: [
    RabbitmqPublisherService,
  ],
})
export class RabbitmqModule {}