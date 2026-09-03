
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
     * 2. No existe en Redis.
     *
     * Esto es un CACHE MISS.
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
     * 4. Preparamos el objeto que vamos
     *    a guardar en Redis.
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
     * 6. Configuramos TTL.
     *
     * Después de 60 segundos Redis
     * eliminará automáticamente la key.
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
   * Elimina el evento de Redis.
   *
   * Esto se utiliza cuando sabemos que
   * los datos almacenados en cache pueden
   * haber quedado desactualizados.
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
   * Construye siempre la misma key
   * para un determinado evento.
   */
  private buildKey(
    name: string,
  ): string {
    return `event:${name}`;
  }
}