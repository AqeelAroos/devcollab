import jwt from "jsonwebtoken";
import { prisma } from "../src/utils/prisma";

let counter = 0;

export async function createTestUser(overrides: { githubId?: string; username?: string } = {}) {
  counter++;
  return prisma.user.create({
    data: {
      githubId: overrides.githubId ?? `github-${counter}-${Date.now()}`,
      username: overrides.username ?? `testuser${counter}`,
      name: `Test User ${counter}`,
      email: `test${counter}@example.com`,
      avatarUrl: null,
      accessToken: "fake-github-access-token",
    },
  });
}

export function generateTestToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}
