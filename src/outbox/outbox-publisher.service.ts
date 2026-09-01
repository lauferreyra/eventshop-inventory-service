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


  /*
   * Tiempo máximo que un evento puede
   * permanecer PROCESSING.
   *
   * Después de este tiempo asumimos
   * que el worker que lo estaba procesando
   * murió.
   */

  private readonly processingTimeoutMs =
    60_000;


  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rabbitmqPublisher:
      RabbitmqPublisherService,
  ) {}


  /*
   * =====================================================
   * MODULE INIT
   * =====================================================
   */

  async onModuleInit() {

    console.log(
      '📦 Inventory Outbox Publisher iniciado',
    );


    /*
     * Primero recuperamos eventos
     * PROCESSING abandonados.
     */

    await this.recoverStuckEvents();


    /*
     * Intentamos publicar inmediatamente
     * los eventos pendientes.
     */

    await this.publishPendingEvents();


    /*
     * Después ejecutamos el worker
     * cada 5 segundos.
     */

    this.interval =
      setInterval(
        () => {
          void this.runWorker();
        },

        5000,
      );
  }


  /*
   * =====================================================
   * WORKER
   * =====================================================
   */

  private async runWorker() {

    try {

      /*
       * Primero recuperamos eventos
       * PROCESSING demasiado antiguos.
       */

      await this.recoverStuckEvents();


      /*
       * Después intentamos procesar
       * nuevos eventos.
       */

      await this.publishPendingEvents();

    } catch (error) {

      console.error(
        '❌ Error ejecutando Outbox Worker:',
        error,
      );
    }
  }


  /*
   * =====================================================
   * RECUPERAR EVENTOS ABANDONADOS
   * =====================================================
   *
   * Busca eventos que quedaron PROCESSING
   * durante demasiado tiempo.
   */

  private async recoverStuckEvents() {

    const timeout =
      new Date(
        Date.now() -
          this.processingTimeoutMs,
      );


    try {

      const result =
        await this.prisma.outboxEvent.updateMany({

          where: {

            status:
              'PROCESSING',

            processingAt: {
              lt:
                timeout,
            },
          },

          data: {

            status:
              'PENDING',

            processingAt:
              null,
          },
        });


      if (
        result.count > 0
      ) {

        console.log(
          `♻️ Recuperados ${result.count} eventos PROCESSING`,
        );
      }

    } catch (error) {

      console.error(
        '❌ Error recuperando eventos PROCESSING:',
        error,
      );
    }
  }


  /*
   * =====================================================
   * PUBLICAR EVENTOS PENDING
   * =====================================================
   */

  private async publishPendingEvents() {

    try {

      /*
       * =================================================
       * 1. CLAIM
       * =================================================
       *
       * Buscamos eventos PENDING utilizando
       *
       * FOR UPDATE SKIP LOCKED
       *
       * para evitar que dos workers
       * tomen los mismos eventos.
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
             * Marcamos los eventos como
             * PROCESSING.
             *
             * También guardamos cuándo
             * comenzó el procesamiento.
             */

            await tx.outboxEvent.updateMany({

              where: {

                id: {
                  in:
                    events.map(
                      (event) =>
                        event.id,
                    ),
                },
              },

              data: {

                status:
                  'PROCESSING',

                processingAt:
                  new Date(),
              },
            });


            /*
             * COMMIT.
             *
             * Los locks de PostgreSQL
             * se liberan acá.
             */

            return events;
          },
        );


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
           * Publicamos y esperamos
           * confirmación de RabbitMQ.
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

              processingAt:
                null,
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
           * Si RabbitMQ falla:
           *
           * PROCESSING
           *      ↓
           * PENDING
           *
           * El próximo ciclo volverá
           * a intentarlo.
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

                processingAt:
                  null,
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
        '❌ Error leyendo Outbox:',

        error,
      );
    }
  }


  /*
   * =====================================================
   * MODULE DESTROY
   * =====================================================
   */

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