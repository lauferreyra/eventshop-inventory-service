import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  RedisService,
} from '../redis/redis.service.js';


type CachedEvent = {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
};


@Injectable()
export class EventCacheService {

  /*
   * TTL del cache.
   *
   * 60 segundos.
   */

  private readonly ttl =
    60;


  constructor(
    private readonly prisma:
      PrismaService,

    private readonly redis:
      RedisService,
  ) {}


  /*
   * =====================================================
   * GET EVENT
   * =====================================================
   */

  async getEvent(
    name: string,
  ): Promise<CachedEvent | null> {

    /*
     * ===================================================
     * 1. CONSTRUIR KEY
     * ===================================================
     */

    const key =
      this.buildKey(name);


    /*
     * ===================================================
     * 2. BUSCAR EN REDIS
     * ===================================================
     */

    const cached =
      await this.redis.get(
        key,
      );


    /*
     * ===================================================
     * CACHE HIT
     * ===================================================
     */

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
     * ===================================================
     * CACHE MISS
     * ===================================================
     */

    console.log(
      '🟡 Redis CACHE MISS:',
      key,
    );


    /*
     * ===================================================
     * 3. BUSCAR EN POSTGRESQL
     * ===================================================
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
     * ===================================================
     * 4. CONVERTIR DECIMAL
     * ===================================================
     */

    const cachedEvent:
      CachedEvent = {

      id:
        event.id,

      name:
        event.name,

      unitPrice:
        Number(
          event.unitPrice,
        ),

      stock:
        event.stock,
    };


    /*
     * ===================================================
     * 5. GUARDAR EN REDIS
     * ===================================================
     */

    await this.redis.set(
      key,

      JSON.stringify(
        cachedEvent,
      ),
    );


    /*
     * ===================================================
     * 6. ASIGNAR TTL
     * ===================================================
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
   * =====================================================
   * BUILD KEY
   * =====================================================
   */

  private buildKey(
    name: string,
  ): string {

    return `event:${name}`;
  }

  async invalidateEvent(name: string): Promise<void> {
  const key = this.buildKey(name);

  await this.redis.delete(key);

  console.log(
    '🗑️ Cache invalidated:',
    key,
  );
}
}