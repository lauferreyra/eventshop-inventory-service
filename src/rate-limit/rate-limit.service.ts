
import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

type RateLimitResult = {
  count: number;
  limit: number;
  remaining: number;
  ttl: number;
  allowed: boolean;
};

@Injectable()
export class RateLimitService {
  /*
   * =====================================================
   * LUA SCRIPT
   * =====================================================
   *
   * KEYS[1]
   *   -> key del rate limiter
   *
   * ARGV[1]
   *   -> duración de la ventana en segundos
   *
   * ARGV[2]
   *   -> límite máximo de requests
   */

  private readonly script = `
    local count = redis.call(
      'INCR',
      KEYS[1]
    )

    if count == 1 then
      redis.call(
        'EXPIRE',
        KEYS[1],
        ARGV[1]
      )
    end

    local ttl = redis.call(
      'TTL',
      KEYS[1]
    )

    local limit = tonumber(
      ARGV[2]
    )

    local allowed = 1

    if count > limit then
      allowed = 0
    end

    return {
      count,
      ttl,
      allowed
    }
  `;

  constructor(
    private readonly redis: RedisService,
  ) {}

  async check(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key =
      `rate-limit:${identifier}`;

    const result =
      await this.redis.eval(
        this.script,

        [key],

        [
          String(windowSeconds),
          String(limit),
        ],
      ) as [number, number, number];

    const count =
      Number(result[0]);

    const ttl =
      Number(result[1]);

    const allowed =
      Number(result[2]) === 1;

    const remaining =
      Math.max(
        0,
        limit - count,
      );

    return {
      count,
      limit,
      remaining,
      ttl,
      allowed,
    };
  }
}