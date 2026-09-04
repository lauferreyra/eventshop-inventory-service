import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const events = [
  {
    name: 'Coldplay - River Plate',
    unitPrice: 50000,
    stock: 100,
  },
  {
    name: 'Metallica - Buenos Aires',
    unitPrice: 65000,
    stock: 80,
  },
  {
    name: 'Imagine Dragons - Buenos Aires',
    unitPrice: 45000,
    stock: 120,
  },
  {
    name: 'The Weeknd - Buenos Aires',
    unitPrice: 55000,
    stock: 90,
  },
  {
    name: 'Arctic Monkeys - Buenos Aires',
    unitPrice: 48000,
    stock: 75,
  },
  {
    name: 'Bruno Mars - Buenos Aires',
    unitPrice: 60000,
    stock: 110,
  },
  {
    name: 'Linkin Park - Buenos Aires',
    unitPrice: 52000,
    stock: 85,
  },
  {
    name: "Guns N' Roses - Buenos Aires",
    unitPrice: 70000,
    stock: 60,
  },
  {
    name: 'Foo Fighters - Buenos Aires',
    unitPrice: 58000,
    stock: 95,
  },
  {
    name: 'Taylor Swift - Buenos Aires',
    unitPrice: 75000,
    stock: 50,
  },
];

async function main() {
  for (const eventData of events) {
    const event = await prisma.event.upsert({
      where: {
        name: eventData.name,
      },

      update: {
        unitPrice: eventData.unitPrice,
        stock: eventData.stock,
      },

      create: eventData,
    });

    console.log('🎫 Evento creado:', event.name);
  }
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