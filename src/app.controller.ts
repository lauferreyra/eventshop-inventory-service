import { Controller } from '@nestjs/common';

import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

import { PrismaService } from './prisma/prisma.service.js';

import { RabbitmqPublisherService } from './rabbitmq/rabbitmq-publisher.service.js';

type OrderCreatedEvent = {
  id: string;
  eventName: string;
  email: string;
  quantity: number;
  status: string;
};

type EventRow = {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
};

type ReservationResult =
  | {
      success: true;
      event: EventRow;
      reservationId: string;
      unitPrice: number;
    }
  | {
      success: false;
      reason: 'INSUFFICIENT_STOCK';
    };

@Controller()
export class AppController {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rabbitmqPublisher:
      RabbitmqPublisherService,
  ) {}

  @EventPattern('order.created')
  async handleOrderCreated(
    @Payload()
    order: OrderCreatedEvent,

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
      console.log(
        '📦 Inventory recibió order.created',
      );

      console.log(order);

      /*
       * =====================================================
       * TRANSACTION
       * =====================================================
       *
       * Todo lo que hacemos dentro de esta función
       * pertenece a la misma transaction.
       */
      const result: ReservationResult =
        await this.prisma.$transaction(
          async (tx) => {
            /*
             * =================================================
             * 1. BUSCAR EVENTO + BLOQUEAR FILA
             * =================================================
             *
             * FOR UPDATE bloquea la fila hasta que
             * termine la transaction.
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
            if (events.length === 0) {
              throw new Error(
                `Evento no encontrado: ${order.eventName}`,
              );
            }

            const event =
              events[0];

            console.log(
              '🎫 Evento encontrado:',
              event,
            );

            /*
             * =================================================
             * 2. VERIFICAR STOCK
             * =================================================
             */
            if (
              event.stock <
              order.quantity
            ) {
              console.log(
                '❌ Stock insuficiente',
              );

              /*
               * IMPORTANTE:
               *
               * No modificamos nada.
               *
               * La transaction simplemente termina
               * sin hacer cambios.
               */
              return {
                success: false,
                reason:
                  'INSUFFICIENT_STOCK',
              };
            }

            /*
             * =================================================
             * 3. DESCONTAR STOCK
             * =================================================
             */
            const updatedEvent =
              await tx.event.update({
                where: {
                  id: event.id,
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
             * =================================================
             * 4. CREAR RESERVA
             * =================================================
             */
            const reservation =
              await tx.reservation.create({
                data: {
                  orderId:
                    order.id,

                  eventId:
                    event.id,

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
             * Devolvemos solamente los datos
             * que necesitamos después del COMMIT.
             */
            return {
              success: true,

              event,

              reservationId:
                reservation.id,

              unitPrice:
                Number(event.unitPrice),
            };
          },
        );

      /*
       * =====================================================
       * TRANSACTION TERMINÓ
       * =====================================================
       *
       * Si llegamos acá sin excepción,
       * Prisma hizo COMMIT.
       */
      console.log(
        '✅ Transaction de Inventory COMMIT',
      );

      /*
       * =====================================================
       * STOCK INSUFICIENTE
       * =====================================================
       */
      if (!result.success) {
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

        channel.ack(message);

        return;
      }

      /*
       * =====================================================
       * RESERVA CONFIRMADA
       * =====================================================
       *
       * Como result.success === true,
       * TypeScript sabe que:
       *
       * result.unitPrice
       * result.reservationId
       * result.event
       *
       * existen.
       */
      console.log(
        '✅ Reserva confirmada:',
        result.reservationId,
      );

      /*
       * Publicamos inventory.reserved
       * DESPUÉS del COMMIT.
       */
      this.rabbitmqPublisher.publish(
        'inventory.reserved',
        {
          orderId:
            order.id,

          quantity:
            order.quantity,

          unitPrice:
            result.unitPrice,
        },
      );

      /*
       * ACK después de completar
       * nuestra operación.
       */
      channel.ack(message);
    } catch (error) {
      console.error(
        '❌ Error procesando inventory',
        error,
      );

      /*
       * Si la transaction falla:
       *
       * - Prisma hace ROLLBACK
       * - no queda stock descontado
       * - no queda reservation creada
       *
       * RabbitMQ recibe NACK.
       */
      channel.nack(
        message,
        false,
        false,
      );
    }
  }
}