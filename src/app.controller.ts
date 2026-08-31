import { Controller } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import { RabbitmqPublisherService } from './rabbitmq/rabbitmq-publisher.service.js';

type OrderCreatedEvent = {
  id: string;
  eventName: string;
  email: string;
  quantity: number;
  status: string;
};

@Controller()
export class AppController {
  constructor(
    private readonly rabbitmqPublisher:
      RabbitmqPublisherService,
  ) {}

  @EventPattern('order.created')
  handleOrderCreated(
    @Payload() order: OrderCreatedEvent,
    @Ctx() context: any,
  ) {
    const rmqContext = context as RmqContext;

    const channel =
      rmqContext.getChannelRef();

    const message =
      rmqContext.getMessage();

    try {
      console.log(
        '📦 Inventory recibió order.created',
      );

      console.log(order);

      const hasStock =
        order.quantity <= 4;

      if (hasStock) {
        console.log(
          '✅ Stock disponible. Reserva confirmada.',
        );

        this.rabbitmqPublisher.publish(
          'inventory.reserved',
          {
            orderId: order.id,
            quantity: order.quantity,
          },
        );
      } else {
        console.log(
          '❌ Stock insuficiente.',
        );

        this.rabbitmqPublisher.publish(
          'inventory.rejected',
          {
            orderId: order.id,
            quantity: order.quantity,
            reason: 'INSUFFICIENT_STOCK',
          },
        );
      }

      channel.ack(message);
    } catch (error) {
      console.error(
        '❌ Error procesando inventory',
        error,
      );

      channel.nack(
        message,
        false,
        false,
      );
    }
  }
}