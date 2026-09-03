import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';
//type vs interface
//Ambos permiten definir tipos de objetos. Prefiero interface cuando estoy definiendo contratos de objetos que pueden extenderse, y type cuando necesito uniones, intersecciones o composiciones de tipos. Para objetos simples, cualquiera de los dos puede ser apropiado

export type RateLimitOptions = {
  limit: number;
  windowSeconds: number;
};

export const RateLimit = (
  options: RateLimitOptions,
) => SetMetadata(RATE_LIMIT_KEY, options);