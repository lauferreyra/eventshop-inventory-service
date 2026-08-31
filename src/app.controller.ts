import { Controller } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

@Controller()
export class AppController {
  @EventPattern('order.created')
  handleOrderCreated(
    @Payload() data: unknown,
    @Ctx() context: any,
  ) {
    const rmqContext =
      context as RmqContext;

    const channel =
      rmqContext.getChannelRef();

    const message =
      rmqContext.getMessage();

    try {
      console.log(
        '📦 Inventory recibió order.created',
      );

      console.log(data);

      console.log(
        '✅ Stock reservado de forma simulada',
      );

      channel.ack(message);
    } catch (error) {
      console.error(
        '❌ Error procesando stock',
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