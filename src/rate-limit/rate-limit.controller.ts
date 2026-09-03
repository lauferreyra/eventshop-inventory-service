import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { RateLimit } from './rate-limit.decorator.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Controller('rate-limit')
export class RateLimitController {

  @Get(':identifier')
  @UseGuards(RateLimitGuard)
   @RateLimit({
    limit: 5,
    windowSeconds: 60,
  })
  async check() {
    return {
      success: true,
      message: 'Request allowed',
    };
  }
}