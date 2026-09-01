import { Controller } from '@nestjs/common';

import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import { PrismaService } from './prisma/prisma.service.js';

import {
  RabbitmqPublisherService,
} from './rabbitmq/rabbitmq-publisher.service.js';

import type {
  OrderCreatedEnvelope,
} from './events/events.js';


/*
 * =====================================================
 * DATABASE EVENT
 * =====================================================
 */

type EventRow = {
  id: string;

  name: string;

  unitPrice: number;

  stock: number;
};


/*
 * =====================================================
 * TRANSACTION RESULT
 * =====================================================
 */

type ReservationResult =
  | {
      success: true;

      duplicate: true;
    }
  | {
      success: true;

      duplicate: false;

      reservationId: string;

      event: EventRow;
    }
  | {
      success: false;

      reason:
        | 'INSUFFICIENT_STOCK';
    };


@Controller()
export class AppController {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rabbitmqPublisher:
      RabbitmqPublisherService,
  ) {}


  /*
   * =====================================================
   * ORDER.CREATED
   * =====================================================
   */

  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload()
    event: OrderCreatedEnvelope,

    @Ctx()
    context: any,
  ) {
    const rmqContext =
      context as RmqContext;

    const channel =
      rmqContext.getChannelRef();

    const message =
      rmqContext.getMessage();


    try {
      /*
       * =================================================
       * EVENT RECIBIDO
       * =================================================
       */

      console.log(
        '📦 Inventory recibió order.created',
      );

      console.log(
        JSON.stringify(
          event,
          null,
          2,
        ),
      );


      /*
       * =================================================
       * DATOS DEL EVENTO
       * =================================================
       */

      const order =
        event.data;


      /*
       * =================================================
       * TRANSACTION
       * =================================================
       */

      const result:
        ReservationResult =
        await this.prisma.$transaction(
          async (tx) => {


            /*
             * =============================================
             * 1. IDEMPOTENCIA
             * =============================================
             *
             * Usamos event.eventId.
             *
             * NO usamos order.id.
             */

            const processedEvent =
              await tx.processedEvent.findUnique({
                where: {
                  eventId:
                    event.eventId,
                },
              });


            /*
             * Si ya existe significa que RabbitMQ
             * nos entregó nuevamente el mismo evento.
             */

            if (
              processedEvent
            ) {
              console.log(
                '♻️ Evento ya procesado:',
                event.eventId,
              );

              return {
                success: true,

                duplicate: true,
              };
            }


            /*
             * =============================================
             * 2. BUSCAR EVENTO + FOR UPDATE
             * =============================================
             */

            const events =
              await tx.$queryRaw<EventRow[]>`
                SELECT
                  id,
                  name,
                  "unitPrice",
                  stock
                FROM events
                WHERE name = ${order.eventName}
                FOR UPDATE
              `;


            /*
             * El evento no existe.
             */

            if (
              events.length === 0
            ) {
              throw new Error(
                `Evento no encontrado: ${order.eventName}`,
              );
            }


            const inventoryEvent =
              events[0];


            console.log(
              '🎫 Evento encontrado:',
              inventoryEvent,
            );


            /*
             * =============================================
             * 3. VERIFICAR STOCK
             * =============================================
             */

            if (
              inventoryEvent.stock <
              order.quantity
            ) {
              console.log(
                '❌ Stock insuficiente',
              );


              /*
               * Registramos el evento como procesado.
               *
               * Así no procesamos nuevamente
               * el mismo order.created.
               */

              await tx.processedEvent.create({
                data: {
                  eventId:
                    event.eventId,

                  eventType:
                    event.eventType,
                },
              });


              return {
                success: false,

                reason:
                  'INSUFFICIENT_STOCK',
              };
            }


            /*
             * =============================================
             * 4. DESCONTAR STOCK
             * =============================================
             */

            const updatedEvent =
              await tx.event.update({
                where: {
                  id:
                    inventoryEvent.id,
                },

                data: {
                  stock: {
                    decrement:
                      order.quantity,
                  },
                },
              });


            console.log(
              '📦 Stock actualizado:',
              updatedEvent.stock,
            );


            /*
             * =============================================
             * 5. CREAR RESERVATION
             * =============================================
             */

            const reservation =
              await tx.reservation.create({
                data: {
                  orderId:
                    order.id,

                  eventId:
                    inventoryEvent.id,

                  quantity:
                    order.quantity,

                  status:
                    'RESERVED',
                },
              });


            console.log(
              '🎟️ Reserva creada:',
              reservation.id,
            );


            /*
             * =============================================
             * 6. REGISTRAR PROCESSED EVENT
             * =============================================
             */

            await tx.processedEvent.create({
              data: {
                eventId:
                  event.eventId,

                eventType:
                  event.eventType,
              },
            });


            /*
             * =============================================
             * 7. CREAR OUTBOX EVENT
             * =============================================
             */

            const outboxEventId =
              crypto.randomUUID();


            /*
             * Creamos el envelope COMPLETO.
             *
             * Este es el evento que eventualmente
             * viajará por RabbitMQ.
             */

            const inventoryReservedEvent = {
              eventId:
                outboxEventId,

              eventType:
                'inventory.reserved',

              version: 1,

              occurredAt:
                new Date().toISOString(),

              data: {
                orderId:
                  order.id,

                quantity:
                  order.quantity,

                unitPrice:
                  Number(
                    inventoryEvent.unitPrice,
                  ),
              },
            };


            await tx.outboxEvent.create({
              data: {
                eventId:
                  outboxEventId,

                eventType:
                  'inventory.reserved',

                payload:
                  inventoryReservedEvent,

                status:
                  'PENDING',
              },
            });


            console.log(
              '📦 OutboxEvent creado:',
              outboxEventId,
            );


            /*
             * =============================================
             * TRANSACTION OK
             * =============================================
             *
             * Al salir de esta función Prisma
             * hará COMMIT.
             */

            return {
              success: true,

              duplicate: false,

              reservationId:
                reservation.id,

              event:
                inventoryEvent,
            };
          },
        );


      /*
       * =====================================================
       * TRANSACTION COMMIT
       * =====================================================
       */

      console.log(
        '✅ Transaction de Inventory COMMIT',
      );


      /*
       * =====================================================
       * DUPLICADO
       * =====================================================
       */

      if (
        result.success &&
        result.duplicate
      ) {
        console.log(
          '♻️ order.created duplicado. ACK.',
        );

        channel.ack(
          message,
        );

        return;
      }


      /*
       * =====================================================
       * STOCK INSUFICIENTE
       * =====================================================
       */

      if (
        !result.success
      ) {
        console.log(
          '❌ Publicando inventory.rejected',
        );


        /*
         * TEMPORALMENTE lo publicamos directamente.
         *
         * Más adelante también lo pasaremos
         * por Outbox.
         */

        this.rabbitmqPublisher.publish(
          'inventory.rejected',

          {
            orderId:
              order.id,

            quantity:
              order.quantity,

            reason:
              result.reason,
          },
        );


        channel.ack(
          message,
        );

        return;
      }


      /*
       * =====================================================
       * RESERVA EXITOSA
       * =====================================================
       *
       * inventory.reserved YA está guardado
       * en outbox_events.
       */

      console.log(
        '🎟️ Reserva confirmada:',
        result.reservationId,
      );


      /*
       * ACK del order.created.
       */

      channel.ack(
        message,
      );


    } catch (error) {

      console.error(
        '❌ Error procesando inventory',
        error,
      );


      /*
       * Si algo falla dentro de la transaction:
       *
       * ROLLBACK.
       *
       * No queda:
       *
       * - stock descontado
       * - Reservation
       * - ProcessedEvent
       * - OutboxEvent
       */

      channel.nack(
        message,

        false,

        false,
      );
    }
  }
}