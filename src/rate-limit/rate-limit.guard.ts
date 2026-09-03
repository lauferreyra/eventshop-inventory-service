import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import type { Request } from 'express';

import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator.js';

import { RateLimitService } from './rate-limit.service.js';

@Injectable()
export class RateLimitGuard
  implements CanActivate
{
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const options =
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      );

    if (!options) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<Request>();

    const identifier =
      request.params.identifier;

    if (typeof identifier !== 'string') {
      throw new HttpException(
        'Identifier is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result =
      await this.rateLimitService.check(
        identifier,
        options.limit,
        options.windowSeconds,
      );

    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Too many requests',
          limit: result.limit,
          remaining: result.remaining,
          retryAfter: result.ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}