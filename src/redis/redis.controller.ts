
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  RedisService,
} from './redis.service.js';


@Controller('redis')
export class RedisController {

  constructor(
    private readonly redis:
      RedisService,
  ) {}


  /*
   * =====================================================
   * SET
   * =====================================================
   *
   * POST /redis
   */

  @Post()
  async set(
    @Body()
    body: {
      key: string;
      value: string;
    },
  ) {

    await this.redis.set(
      body.key,
      body.value,
    );

    return {
      success: true,
      key: body.key,
    };
  }


  /*
   * =====================================================
   * TTL
   * =====================================================
   *
   * GET /redis/ttl/:key
   */

  @Get('ttl/:key')
  async ttl(
    @Param('key')
    key: string,
  ) {

    const ttl =
      await this.redis.ttl(
        key,
      );

    return {
      key,
      ttl,
    };
  }


  /*
   * =====================================================
   * GET
   * =====================================================
   *
   * GET /redis/:key
   */

  @Get(':key')
  async get(
    @Param('key')
    key: string,
  ) {

    const value =
      await this.redis.get(
        key,
      );

    return {
      key,
      value,
    };
  }


  /*
   * =====================================================
   * DELETE
   * =====================================================
   *
   * DELETE /redis/:key
   */

  @Delete(':key')
  async delete(
    @Param('key')
    key: string,
  ) {

    await this.redis.delete(
      key,
    );

    return {
      success: true,
      key,
    };
  }
}