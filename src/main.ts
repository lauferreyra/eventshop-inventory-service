/* import { NestFactory } from '@nestjs/core';
import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app =
    await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule,
      {
        transport: Transport.RMQ,
        options: {
           urls: [
            process.env.RABBITMQ_URL ??
              'amqp://admin:admin@localhost:5672',
          ],

          queue: 'inventory_queue',

          queueOptions: {
            durable: true,
          },

          noAck: false,
        },
      },
    );

  await app.listen();
}

bootstrap(); */

import { NestFactory } from '@nestjs/core';

import {
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

import { AppModule } from './app.module.js';


async function bootstrap() {

  /*
   * =====================================================
   * APLICACIÓN HTTP
   * =====================================================
   *
   * Esto nos permite tener endpoints HTTP
   * para probar Redis.
   */

  const app =
    await NestFactory.create(
      AppModule,
    );


  /*
   * =====================================================
   * MICROSERVICIO RABBITMQ
   * =====================================================
   *
   * Mantenemos exactamente nuestra
   * configuración actual de RabbitMQ.
   */

  app.connectMicroservice<MicroserviceOptions>({
    transport:
      Transport.RMQ,

    options: {

      urls: [
        process.env.RABBITMQ_URL ??
          'amqp://admin:admin@localhost:5672',
      ],
      queue:
        'inventory_queue',

      queueOptions: {
        durable: true,
      },

      noAck:
        false,
    },
  });


  /*
   * =====================================================
   * ARRANCAR MICROSERVICIO
   * =====================================================
   */

  await app.startAllMicroservices();


  /*
   * =====================================================
   * ARRANCAR HTTP
   * =====================================================
   *
   * Inventory ahora escucha HTTP en:
   *
   * http://localhost:3002
   */

  await app.listen(
    3002,
  );


  console.log(
    '🚀 Inventory HTTP escuchando en http://localhost:3002',
  );

  console.log(
    '📨 Inventory RabbitMQ conectado',
  );
}


bootstrap();