import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

type CachedEvent = {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
};

@Injectable()
export class EventCacheService {
  private readonly ttl = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /*
   * Obtiene todos los eventos.
   *
   * Cache-Aside:
   *
   * 1. Redis
   * 2. PostgreSQL si no existe
   * 3. Guardamos el resultado en Redis
   */
  async getEvents(): Promise<CachedEvent[]> {
    const key = 'events';

    /*
     * 1. Intentamos obtener los eventos desde Redis.
     */
    const cached =
      await this.redis.get(key);

    if (cached) {
      console.log(
        '🟢 Redis CACHE HIT:',
        key,
      );

      return JSON.parse(
        cached,
      ) as CachedEvent[];
    }

    /*
     * 2. CACHE MISS.
     */
    console.log(
      '🟡 Redis CACHE MISS:',
      key,
    );

    /*
     * 3. Buscamos los eventos en PostgreSQL.
     */
    const events =
      await this.prisma.event.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

    /*
     * 4. Convertimos Decimal de Prisma
     *    a number para nuestra API.
     */
    const cachedEvents: CachedEvent[] =
      events.map((event) => ({
        id: event.id,
        name: event.name,
        unitPrice: Number(
          event.unitPrice,
        ),
        stock: event.stock,
      }));

    /*
     * 5. Guardamos el listado en Redis.
     */
    await this.redis.set(
      key,
      JSON.stringify(cachedEvents),
    );

    /*
     * 6. TTL de 60 segundos.
     */
    await this.redis.expire(
      key,
      this.ttl,
    );

    console.log(
      '💾 Eventos guardados en Redis:',
      key,
    );

    return cachedEvents;
  }

  /*
   * Obtiene un evento por nombre.
   *
   * Cache-Aside:
   *
   * Redis → PostgreSQL → Redis
   */
  async getEvent(
    name: string,
  ): Promise<CachedEvent | null> {
    const key = this.buildKey(name);

    /*
     * 1. Intentamos obtener el evento desde Redis.
     */
    const cached =
      await this.redis.get(key);

    if (cached) {
      console.log(
        '🟢 Redis CACHE HIT:',
        key,
      );

      return JSON.parse(
        cached,
      ) as CachedEvent;
    }

    /*
     * 2. CACHE MISS.
     */
    console.log(
      '🟡 Redis CACHE MISS:',
      key,
    );

    /*
     * 3. Buscamos el evento en PostgreSQL.
     */
    const event =
      await this.prisma.event.findUnique({
        where: {
          name,
        },
      });

    if (!event) {
      return null;
    }

    /*
     * 4. Preparamos el objeto
     *    que guardaremos en Redis.
     */
    const cachedEvent: CachedEvent = {
      id: event.id,
      name: event.name,
      unitPrice: Number(
        event.unitPrice,
      ),
      stock: event.stock,
    };

    /*
     * 5. Guardamos el evento en Redis.
     */
    await this.redis.set(
      key,
      JSON.stringify(cachedEvent),
    );

    /*
     * 6. TTL.
     */
    await this.redis.expire(
      key,
      this.ttl,
    );

    console.log(
      '💾 Evento guardado en Redis:',
      key,
    );

    return cachedEvent;
  }

  /*
   * Elimina el evento individual de Redis.
   */
  async invalidateEvent(
    name: string,
  ): Promise<void> {
    const key = this.buildKey(name);

    await this.redis.delete(key);

    console.log(
      '🗑️ Cache invalidated:',
      key,
    );
  }

  /*
   * Elimina el cache del listado completo.
   */
  async invalidateEvents(): Promise<void> {
    await this.redis.delete('events');

    console.log(
      '🗑️ Events list cache invalidated',
    );
  }

  /*
   * Construye la key del evento.
   */
  private buildKey(
    name: string,
  ): string {
    return `event:${name}`;
  }
}