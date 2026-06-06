import request from "supertest";
import { app } from "../src/app";
import { createTestUser, generateTestToken } from "./helpers";

// Prevent real Groq API calls
jest.mock("groq-sdk", () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () =>
          // Return a minimal async iterable that behaves like a Groq stream
          (async function* () {
            yield { choices: [{ delta: { content: "FILE: src/app.ts\n" } }] };
            yield { choices: [{ delta: { content: "SEVERITY: info\nCATEGORY: style\nSUGGESTION: Consider adding types.\n---\n" } }] };
          })()
        ),
      },
    },
  }))
);

describe("POST /api/ai/review", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/ai/review")
      .send({ pullRequestId: "test-id", diff: "some diff" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .post("/api/ai/review")
      .set("Authorization", `Bearer ${token}`)
      .send({}); // missing pullRequestId and diff

    expect(res.status).toBe(400);
  });

  it("returns 400 when diff exceeds max length", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .post("/api/ai/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ pullRequestId: "test-id", diff: "x".repeat(50001) });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/ai/suggestions/:pullRequestId", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/ai/suggestions/some-id");
    expect(res.status).toBe(401);
  });

  it("returns empty array for a PR with no suggestions", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .get("/api/ai/suggestions/nonexistent-pr")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
