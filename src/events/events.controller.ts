
import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';

import { EventCacheService } from './event-cache.service.js';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventCacheService: EventCacheService,
  ) {}

  @Get(':name')
  async getEvent(
    @Param('name')
    name: string,
  ) {
    const event =
      await this.eventCacheService.getEvent(
        name,
      );

    if (!event) {
      throw new NotFoundException(
        'Event not found',
      );
    }

    return event;
  }
}