import { Module } from '@nestjs/common';

import { RabbitmqTopologyService } from './rabbitmq-topology.service.js';

@Module({
  providers: [RabbitmqTopologyService],
})
export class RabbitmqModule {}