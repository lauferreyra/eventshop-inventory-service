import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import * as amqp from 'amqplib';

import {
  ChannelModel,
  ConfirmChannel,
} from 'amqplib';

import { randomUUID } from 'crypto';

@Injectable()
export class RabbitmqPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private connection: ChannelModel;

  private channel: ConfirmChannel;

  private readonly exchange =
    'eventshop.events';

  async onModuleInit() {
    this.connection =
      await amqp.connect(
        'amqp://admin:admin@localhost:5672',
      );

    /*
     * Usamos ConfirmChannel porque necesitamos
     * saber si RabbitMQ confirmó la publicación.
     */
    this.channel =
      await this.connection.createConfirmChannel();

    await this.channel.assertExchange(
      this.exchange,
      'topic',
      {
        durable: true,
      },
    );

    console.log(
      '✅ Inventory Publisher conectado a RabbitMQ',
    );
  }

  /*
   * =====================================================
   * PUBLICACIÓN NORMAL
   * =====================================================
   *
   * La seguimos utilizando temporalmente para
   * inventory.rejected.
   *
   * Más adelante también la eliminaremos y
   * pasaremos ese evento por Outbox.
   */
  publish<T>(
    eventType: string,
    data: T,
  ) {
    console.log(
      '📤 PUBLICANDO EVENTO:',
      eventType,
      data,
    );

    const event = {
      eventId:
        randomUUID(),

      eventType,

      version: 1,

      occurredAt:
        new Date().toISOString(),

      data,
    };

    /*
     * NestJS necesita recibir:
     *
     * {
     *   pattern: 'inventory.reserved',
     *   data: {...}
     * }
     */
    const message =
      Buffer.from(
        JSON.stringify({
          pattern: eventType,
          data: event,
        }),
      );

    this.channel.publish(
      this.exchange,
      eventType,
      message,
      {
        persistent: true,

        contentType:
          'application/json',
      },
    );
  }

  /*
   * =====================================================
   * PUBLICACIÓN DESDE OUTBOX
   * =====================================================
   *
   * El Outbox ya tiene generado su eventId.
   *
   * Por eso NO generamos un nuevo envelope acá.
   */
  publishRaw(
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    console.log(
      '📤 Outbox publicando:',
      eventType,
    );

    const message = {
      pattern: eventType,

      data: payload,
    };

    const buffer =
      Buffer.from(
        JSON.stringify(message),
      );

    return new Promise(
      (resolve, reject) => {
        this.channel.publish(
          this.exchange,

          eventType,

          buffer,

          {
            persistent: true,

            contentType:
              'application/json',
          },

          /*
           * ConfirmChannel ejecuta este callback
           * cuando RabbitMQ confirma o rechaza
           * la publicación.
           */
          (error) => {
            if (error) {
              console.error(
                '❌ RabbitMQ rechazó el mensaje:',
                eventType,

                error,
              );

              reject(error);

              return;
            }

            console.log(
              '✅ RabbitMQ confirmó:',
              eventType,
            );

            resolve();
          },
        );
      },
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();

    await this.connection?.close();
  }
}