
import { Controller } from '@nestjs/common';

import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import { PrismaService } from './prisma/prisma.service.js';

import { RabbitmqPublisherService } from './rabbitmq/rabbitmq-publisher.service.js';

import { EventCacheService } from './events/event-cache.service.js';

import type {
  OrderCreatedEnvelope,
} from './events/events.js';

/*
 * =====================================================
 * EVENTO DE INVENTORY EN DATABASE
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
 * RESULTADO DE LA TRANSACTION
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

    private readonly eventCacheService:
      EventCacheService,
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
       * EVENTO RECIBIDO
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
       * DATOS DE LA ORDEN
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
             */

            const processedEvent =
              await tx.processedEvent.findUnique({
                where: {
                  eventId:
                    event.eventId,
                },
              });


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
             * 2. BUSCAR EVENTO + ROW LOCK
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
               * ===========================================
               * CREAR OUTBOX inventory.rejected
               * ===========================================
               */

              const outboxEventId =
                crypto.randomUUID();


              const inventoryRejectedEvent = {
                eventId:
                  outboxEventId,

                eventType:
                  'inventory.rejected',

                version: 1,

                occurredAt:
                  new Date().toISOString(),
                correlationId: event.correlationId,
                data: {
                  orderId:
                    order.id,

                  quantity:
                    order.quantity,

                  reason:
                    'INSUFFICIENT_STOCK',
                },
              };


              await tx.outboxEvent.create({
                data: {
                  eventId:
                    outboxEventId,

                  eventType:
                    'inventory.rejected',

                  payload:
                    inventoryRejectedEvent,

                  status:
                    'PENDING',
                },
              });


              console.log(
                '📦 OutboxEvent creado:',
                outboxEventId,
              );


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
             * 6. PROCESSED EVENT
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
             * 7. OUTBOX inventory.reserved
             * =============================================
             */

            const outboxEventId =
              crypto.randomUUID();


            const inventoryReservedEvent = {
              eventId:
                outboxEventId,

              eventType:
                'inventory.reserved',

              version: 1,

              occurredAt:
                new Date().toISOString(),
              correlationId: event.correlationId,
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
          '❌ inventory.rejected guardado en Outbox',
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
       */

      console.log(
        '🎟️ Reserva confirmada:',
        result.reservationId,
      );


      /*
       * =====================================================
       * INVALIDAR CACHE
       * =====================================================
       *
       * La transaction de PostgreSQL ya hizo COMMIT.
       *
       * El stock real ya fue actualizado.
       *
       * Ahora eliminamos la copia vieja de Redis.
       */

      await this.eventCacheService.invalidateEvent(
        result.event.name,
      );

      await this.eventCacheService.invalidateEvents();
      /*
       * =====================================================
       * ACK DEL MENSAJE ORIGINAL
       * =====================================================
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
       * Si algo falla:
       *
       * PostgreSQL hace ROLLBACK.
       */

      channel.nack(
        message,

        false,

        false,
      );
    }
  }
}