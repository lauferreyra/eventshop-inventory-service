import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import * as amqp from 'amqplib';
import {
  Channel,
  ChannelModel,
} from 'amqplib';

@Injectable()
export class RabbitmqTopologyService
  implements OnModuleInit, OnModuleDestroy
{
  private connection: ChannelModel;
  private channel: Channel;

  async onModuleInit() {
    this.connection = await amqp.connect(
      'amqp://admin:admin@localhost:5672',
    );

    this.channel =
      await this.connection.createChannel();

    await this.createTopology();

    console.log(
      '✅ Topología RabbitMQ de Inventory configurada',
    );
  }

  private async createTopology() {
    await this.channel.assertExchange(
      'eventshop.events',
      'topic',
      {
        durable: true,
      },
    );

    await this.channel.assertQueue(
      'inventory_queue',
      {
        durable: true,
      },
    );

    await this.channel.bindQueue(
      'inventory_queue',
      'eventshop.events',
      'order.created',
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}