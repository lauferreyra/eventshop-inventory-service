
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

   async onModuleInit() {
    this.redis = new Redis({
      host:
        process.env.REDIS_HOST ??
        'localhost',

      port:
        Number(
          process.env.REDIS_PORT ??
            6379,
        ),
    });

    console.log(
      `✅ Redis conectado a ${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379}`,
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
   * EVAL - LUA SCRIPT
   * =====================================================
   *
   * Ejecuta un script Lua directamente en Redis.
   *
   * keys:
   *   Son las KEYS[] que recibe Lua.
   *
   * args:
   *   Son los ARGV[] que recibe Lua.
   *
   */

  async eval(
    script: string,
    keys: string[],
    args: string[],
  ): Promise<unknown> {
    return this.redis.eval(
      script,
      keys.length,
      ...keys,
      ...args,
    );
  }

  /*
   * =====================================================
   * DESTROY
   * =====================================================
   */

  async onModuleDestroy() {
    await this.redis.quit();
  }
}