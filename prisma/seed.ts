import { PrismaClient } from '@prisma/client'; // or '@prisma/client' if you use the default output

const prisma = new PrismaClient();

async function main() {
  // Seed users
  // pass123
  await prisma.user.createMany({
    data: [
      { username: 'admin', password: '$2b$10$DhFAQWDezqr/jfVpWd33M.ljBCEUC7ahpTTynVJYI1jbQzoVuGR0i', role: 'admin' },
      { username: 'user1', password: '$2b$10$DhFAQWDezqr/jfVpWd33M.ljBCEUC7ahpTTynVJYI1jbQzoVuGR0i', role: 'user' },
      { username: 'user2', password: '$2b$10$DhFAQWDezqr/jfVpWd33M.ljBCEUC7ahpTTynVJYI1jbQzoVuGR0i', role: 'user' },
      { username: 'user3', password: '$2b$10$DhFAQWDezqr/jfVpWd33M.ljBCEUC7ahpTTynVJYI1jbQzoVuGR0i', role: 'user' },

    ],
    skipDuplicates: true,
  });

  // Seed tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'First Task',
        description: 'This is a seeded task',
        deadline: new Date(Date.now() + 86400000),
        userIdCreator: 1,
        userIdSupervisor: 1,
        usersIdAssociate: [2],
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });