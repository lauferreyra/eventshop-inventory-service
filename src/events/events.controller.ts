
import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';

import { EventCacheService } from './event-cache.service.js';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventCacheService: EventCacheService,
  ) {}

  @Get()
  async findAll() {
    return this.eventCacheService.getEvents();
  }

  /*
   * Obtiene un evento.
   *
   * Primero intenta obtenerlo desde Redis.
   * Si no existe, consulta PostgreSQL
   * y guarda el resultado en Redis.
   */
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

  /*
   * Elimina manualmente el evento
   * de Redis.
   *
   * Este endpoint es principalmente
   * para aprendizaje y testing.
   */
  @Delete(':name/cache')
  async invalidateCache(
    @Param('name')
    name: string,
  ) {
    await this.eventCacheService.invalidateEvent(
      name,
    );

    return {
      success: true,
      message: 'Event cache invalidated',
      key: `event:${name}`,
    };
  }
}