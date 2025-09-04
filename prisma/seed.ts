import { PrismaClient } from '@prisma/client'; // or '@prisma/client' if you use the default output

const prisma = new PrismaClient();

async function main() {
  const passwordHash = '$2b$10$DhFAQWDezqr/jfVpWd33M.ljBCEUC7ahpTTynVJYI1jbQzoVuGR0i';
  const userProfile = {
    create: {
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email@example.com'
    }
  };

  // Seed users
  // pass123
  await prisma.user.create({
    data: {
      username: 'admin',
      password: passwordHash,
      role: 'admin',
      UserProfile: userProfile
    }
  });

  await prisma.user.create({
    data: {
      username: 'user1',
      password: passwordHash,
      role: 'user',
      UserProfile: userProfile
    }
  });

  await prisma.user.create({
    data: {
      username: 'user2',
      password: passwordHash,
      role: 'user',
      UserProfile: userProfile
    }
  });

  await prisma.user.create({
    data: {
      username: 'user3',
      password: passwordHash,
      role: 'user',
      UserProfile: userProfile
    }
  });

  // Seed tasks
  await prisma.task.createMany({
    data: [
      {
        title: 'First Task',
        description: 'This is a seeded task',
        deadline: new Date(Date.now() + 86400000),
        userIdCreator: 1,
        userIdSupervisor: 2,
        usersIdAssociate: [3, 4],
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