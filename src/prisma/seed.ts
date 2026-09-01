import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';

import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const event =
    await prisma.event.upsert({
      where: {
        name: 'Coldplay - River Plate',
      },

      update: {},

      create: {
        name: 'Coldplay - River Plate',

        unitPrice: 50000,

        stock: 100,
      },
    });

  console.log(
    '🎫 Evento creado:',
    event,
  );
}

main()
  .catch((error) => {
    console.error(
      '❌ Error ejecutando seed:',
      error,
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });