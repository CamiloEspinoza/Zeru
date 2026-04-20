import { PrismaClient } from '@prisma/client';
import { seedCitolabValidation } from './citolab-validation.seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedCitolabValidation(prisma);
    console.log('Seed completado:', result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
