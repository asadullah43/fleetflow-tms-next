/**
 * `npm run seed` / `prisma db seed`: creates the first company's admin
 * user if the database has no users yet. Safe to run repeatedly.
 * The same step runs as part of `admin_app db:prepare`.
 */
import { disconnectDatabase } from '../_core_app_connectivities/prisma.js';
import { provisioningService } from '../services/provisioning.service.js';

provisioningService
  .ensureInitialAdmin()
  .then((admin) => {
    if (!admin.created) return console.log('Users already exist — nothing to seed.');
    console.log(`Seeded admin user -> username: ${admin.username}`);
    if (admin.generatedPassword) console.log(`  one-time password (change it after signing in): ${admin.generatedPassword}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
