import 'dotenv/config';
import { db } from '../src/server/db';
const email = process.argv[2]?.toLowerCase();
if (!email) throw new Error('Usage: npx tsx scripts/promote-admin.ts <registered-email>');
const user = await db.user.findUnique({ where: { email } });
if (!user) throw new Error('Register an account first. No default admin passwords are created.');
await db.$transaction(async (tx) => {
  await tx.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } });
  await tx.auditLog.create({
    data: { actorId: 'local-cli', action: 'INITIAL_ADMIN_PROMOTED', metadata: { userId: user.id } },
  });
});
console.log('Registered user promoted to SUPER_ADMIN; audit event recorded.');
await db.$disconnect();
