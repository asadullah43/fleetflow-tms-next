import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
// Override with SEED_ADMIN_PASSWORD; the default is public (it's in the README), so change it after first login.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function main() {
  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full system access' },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@fleetflow.local',
      username: ADMIN_USERNAME,
      passwordHash,
      role: 'ADMIN',
      roleId: role.id,
      status: 'ACTIVE',
      language: 'en',
    },
  });

  console.log(`Seeded admin user -> username: ${ADMIN_USERNAME}${process.env.SEED_ADMIN_PASSWORD ? '' : `  password: ${ADMIN_PASSWORD}`}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
