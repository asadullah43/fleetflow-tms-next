import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin123!'; // change after first login

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

  console.log(`Seeded admin user -> username: ${ADMIN_USERNAME}  password: ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
