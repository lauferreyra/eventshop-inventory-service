
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  Redis,
} from 'ioredis';

@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy
{
  private redis!: Redis;

  /*
   * =====================================================
   * CONEXIÓN
   * =====================================================
   */

  async onModuleInit() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
    });

    await this.redis.ping();

    console.log(
      '✅ Redis conectado',
    );
  }

  /*
   * =====================================================
   * SET
   * =====================================================
   */

  async set(
    key: string,
    value: string,
  ): Promise<void> {
    await this.redis.set(
      key,
      value,
    );
  }

  /*
   * =====================================================
   * GET
   * =====================================================
   */

  async get(
    key: string,
  ): Promise<string | null> {
    return this.redis.get(
      key,
    );
  }

  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  async delete(
    key: string,
  ): Promise<void> {
    await this.redis.del(
      key,
    );
  }

  /*
   * =====================================================
   * EXPIRE
   * =====================================================
   */

  async expire(
    key: string,
    seconds: number,
  ): Promise<void> {
    await this.redis.expire(
      key,
      seconds,
    );
  }

  /*
   * =====================================================
   * TTL
   * =====================================================
   */

  async ttl(
    key: string,
  ): Promise<number> {
    return this.redis.ttl(
      key,
    );
  }

  /*
   * =====================================================
   * CERRAR CONEXIÓN
   * =====================================================
   */

  async onModuleDestroy() {
    await this.redis.quit();
  }
}