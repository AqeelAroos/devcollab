import { prisma } from "../src/utils/prisma";

// Clean all tables before each test in reverse FK-dependency order
beforeEach(async () => {
  await prisma.comment.deleteMany();
  await prisma.aiSuggestion.deleteMany();
  await prisma.review.deleteMany();
  await prisma.pullRequest.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
