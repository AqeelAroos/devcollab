import request from "supertest";
import { app } from "../src/app";
import { createTestUser, generateTestToken } from "./helpers";
import { prisma } from "../src/utils/prisma";

// Prevent real Socket.io / Redis usage
jest.mock("../src/websocket/socket", () => ({
  getIO: jest.fn(() => ({
    to: jest.fn(() => ({ emit: jest.fn() })),
  })),
  setupWebSocket: jest.fn(),
}));

// ---- helpers ----

async function seedPR(authorUsername: string, repoSuffix: number) {
  const owner = await createTestUser({ username: `owner${repoSuffix}` });
  const repo = await prisma.repository.create({
    data: {
      githubRepoId: 10000 + repoSuffix,
      owner: "testorg",
      name: `repo${repoSuffix}`,
      fullName: `testorg/repo${repoSuffix}`,
      isPrivate: false,
    },
  });
  const pr = await prisma.pullRequest.create({
    data: {
      githubPrId: repoSuffix,
      number: repoSuffix,
      title: `Test PR ${repoSuffix}`,
      state: "OPEN",
      authorLogin: authorUsername,
      baseBranch: "main",
      headBranch: "feature",
      repositoryId: repo.id,
    },
  });
  return { owner, repo, pr };
}

// ---- tests ----

describe("GET /api/comments/pr/:id", () => {
  it("returns empty array for a PR with no comments", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .get("/api/comments/pr/nonexistent-pr-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/comments", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/comments")
      .send({ pullRequestId: "some-id", body: "Hello" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when body field is missing", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({ pullRequestId: "some-id" }); // missing body

    expect(res.status).toBe(400);
  });

  it("creates a comment and returns 201 with user data", async () => {
    const commenter = await createTestUser({ username: "commenter" });
    const token = generateTestToken(commenter.id);
    const { pr } = await seedPR(commenter.username, 1);

    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pullRequestId: pr.id,
        body: "Great change!",
        filePath: "src/index.ts",
      });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe("Great change!");
    expect(res.body.filePath).toBe("src/index.ts");
    expect(res.body.user.username).toBe("commenter");
    expect(res.body.pullRequestId).toBe(pr.id);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("returns 403 when deleting another user's comment", async () => {
    const owner = await createTestUser({ username: "commentowner" });
    const attacker = await createTestUser({ username: "attacker" });
    const attackerToken = generateTestToken(attacker.id);
    const { pr } = await seedPR(owner.username, 2);

    const comment = await prisma.comment.create({
      data: { body: "Owner's comment", pullRequestId: pr.id, userId: owner.id },
    });

    const res = await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set("Authorization", `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 200 when the comment owner deletes their own comment", async () => {
    const owner = await createTestUser({ username: "selfdeleter" });
    const token = generateTestToken(owner.id);
    const { pr } = await seedPR(owner.username, 3);

    const comment = await prisma.comment.create({
      data: { body: "My comment", pullRequestId: pr.id, userId: owner.id },
    });

    const res = await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
