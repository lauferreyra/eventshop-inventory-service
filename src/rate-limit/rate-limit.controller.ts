
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';

import { RateLimitService } from './rate-limit.service.js';

@Controller('rate-limit')
export class RateLimitController {
  constructor(
    private readonly rateLimitService:
      RateLimitService,
  ) {}

  @Get(':identifier')
  async check(
    @Param('identifier')
    identifier: string,
  ) {
    const result =
      await this.rateLimitService.check(
        identifier,
        5,
        60,
      );

    /*
     * =====================================================
     * RATE LIMIT SUPERADO
     * =====================================================
     */

    if (!result.allowed) {
      throw new HttpException(
        {
          message:
            'Too many requests',

          limit:
            result.limit,

          remaining:
            result.remaining,

          retryAfter:
            result.ttl,
        },

        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    /*
     * =====================================================
     * REQUEST PERMITIDO
     * =====================================================
     */

    return result;
  }
}