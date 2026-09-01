import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { RabbitmqPublisherService } from '../rabbitmq/rabbitmq-publisher.service.js';

@Injectable()
export class OutboxPublisherService
  implements OnModuleInit
{
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

    await this.publishPendingEvents();

    /*
     * Después podemos convertir esto
     * en un worker periódico.
     */
    setInterval(
      () => {
        this.publishPendingEvents();
      },
      5000,
    );
  }

  private async publishPendingEvents() {
    try {
      /*
       * Buscamos eventos que todavía
       * no fueron publicados.
       */
      const events =
        await this.prisma.outboxEvent.findMany({
          where: {
            status: 'PENDING',
          },

          orderBy: {
            createdAt: 'asc',
          },

          take: 10,
        });

      if (
        events.length === 0
      ) {
        return;
      }

      console.log(
        `📦 Inventory encontró ${events.length} eventos pendientes`,
      );

      for (const event of events) {
        try {
          console.log(
            '📤 Publicando Outbox:',
            event.eventType,
            event.eventId,
          );

          /*
           * Esperamos la confirmación de RabbitMQ.
           */
          await this.rabbitmqPublisher.publishRaw(
            event.eventType,
            event.payload,
          );

          /*
           * RabbitMQ confirmó.
           *
           * Ahora podemos marcar el evento
           * como PUBLISHED.
           */
          await this.prisma.outboxEvent.update({
            where: {
              id: event.id,
            },

            data: {
              status: 'PUBLISHED',

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
           * MUY IMPORTANTE:
           *
           * No eliminamos el evento.
           *
           * Sigue PENDING.
           *
           * En la próxima ejecución
           * volveremos a intentarlo.
           */
        }
      }
    } catch (error) {
      console.error(
        '❌ Error leyendo Outbox:',
        error,
      );
    }
  }
}