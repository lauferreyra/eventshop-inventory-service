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
  implements
    OnModuleInit,
    OnModuleDestroy
{
  private connection:
    ChannelModel;

  private channel:
    ConfirmChannel;

  private readonly exchange =
    'eventshop.events';


  async onModuleInit() {

    const rabbitmqUrl =
        process.env.RABBITMQ_URL ??
        'amqp://admin:admin@localhost:5672';
    
      this.connection =
        await amqp.connect(
          rabbitmqUrl,
        );


    /*
     * ConfirmChannel nos permite saber
     * si RabbitMQ confirmó la publicación.
     */

    this.channel =
      await this.connection
        .createConfirmChannel();


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
   * Actualmente queda para compatibilidad.
   *
   * Los eventos importantes de Inventory
   * ya salen mediante Outbox.
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


    const message =
      Buffer.from(
        JSON.stringify({
          pattern:
            eventType,

          data:
            event,
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
      pattern:
        eventType,

      data:
        payload,
    };


    const buffer =
      Buffer.from(
        JSON.stringify(
          message,
        ),
      );


    return new Promise(
      (
        resolve,
        reject,
      ) => {

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
           * Confirmación de RabbitMQ.
           */

          (error) => {

            if (error) {

              console.error(
                '❌ RabbitMQ rechazó el mensaje:',

                eventType,

                error,
              );


              reject(
                error,
              );

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