import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import {
  RabbitmqPublisherService,
} from '../rabbitmq/rabbitmq-publisher.service.js';


@Injectable()
export class OutboxPublisherService
  implements
    OnModuleInit,
    OnModuleDestroy
{
  private interval:
    NodeJS.Timeout | undefined;


  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rabbitmqPublisher:
      RabbitmqPublisherService,
  ) {}


  async onModuleInit() {

    console.log(
      '📦 Inventory Outbox Publisher iniciado',
    );


    /*
     * Intentamos procesar inmediatamente
     * los eventos pendientes.
     */

    await this.publishPendingEvents();


    /*
     * Después ejecutamos el worker
     * periódicamente.
     */

    this.interval =
      setInterval(
        () => {
          void this.publishPendingEvents();
        },

        5000,
      );
  }


  /*
   * =====================================================
   * OUTBOX WORKER
   * =====================================================
   */

  private async publishPendingEvents() {

    try {

      /*
       * =================================================
       * 1. CLAIM DE EVENTOS
       * =================================================
       *
       * Acá usamos:
       *
       * FOR UPDATE SKIP LOCKED
       *
       * para que múltiples workers
       * no tomen los mismos eventos.
       */

      const events =
        await this.prisma.$transaction(
          async (tx) => {

            const events =
              await tx.$queryRaw<
                {
                  id: string;

                  eventId: string;

                  eventType: string;

                  payload: unknown;
                }[]
              >`
                SELECT
                  id,
                  "eventId",
                  "eventType",
                  payload
                FROM outbox_events
                WHERE status = 'PENDING'
                ORDER BY "createdAt" ASC
                LIMIT 10
                FOR UPDATE SKIP LOCKED
              `;


            if (
              events.length === 0
            ) {
              return [];
            }


            console.log(
              `🔒 Inventory tomó ${events.length} eventos`,
            );


            /*
             * Marcamos los eventos como PROCESSING.
             *
             * Esto sucede dentro de la misma
             * transaction.
             */

            await tx.outboxEvent.updateMany({

              where: {
                id: {
                  in: events.map(
                    (event) =>
                      event.id,
                  ),
                },
              },

              data: {
                status:
                  'PROCESSING',
              },
            });


            /*
             * COMMIT.
             *
             * A partir de acá los locks
             * de PostgreSQL se liberan.
             */

            return events;
          },
        );


      /*
       * Si no encontramos eventos,
       * terminamos este ciclo.
       */

      if (
        events.length === 0
      ) {
        return;
      }


      /*
       * =================================================
       * 2. PUBLICAR FUERA DE LA TRANSACTION
       * =================================================
       */

      for (
        const event of events
      ) {

        try {

          console.log(
            '📤 Publicando Outbox:',
            event.eventType,
            event.eventId,
          );


          /*
           * Esperamos confirmación
           * de RabbitMQ.
           */

          await this.rabbitmqPublisher
            .publishRaw(
              event.eventType,
              event.payload,
            );


          /*
           * =================================================
           * 3. MARCAR COMO PUBLISHED
           * =================================================
           */

          await this.prisma.outboxEvent.update({

            where: {
              id:
                event.id,
            },

            data: {

              status:
                'PUBLISHED',

              publishedAt:
                new Date(),
            },
          });


          console.log(
            '✅ Outbox marcado como PUBLISHED:',
            event.eventId,
          );


        } catch (error) {

          console.error(
            '❌ Error publicando Outbox:',
            event.eventId,
            error,
          );


          /*
           * =================================================
           * 4. VOLVER A PENDING
           * =================================================
           *
           * Si RabbitMQ falló:
           *
           * PROCESSING
           *       ↓
           * PENDING
           *
           * El próximo ciclo lo intentará
           * nuevamente.
           */

          try {

            await this.prisma.outboxEvent.update({

              where: {
                id:
                  event.id,
              },

              data: {
                status:
                  'PENDING',
              },
            });

          } catch (
            updateError
          ) {

            console.error(
              '❌ No se pudo volver a PENDING:',
              event.eventId,
              updateError,
            );
          }
        }
      }

    } catch (error) {

      console.error(
        '❌ Error ejecutando Outbox Worker:',
        error,
      );
    }
  }


  async onModuleDestroy() {

    if (
      this.interval
    ) {
      clearInterval(
        this.interval,
      );
    }
  }
}