import request from "supertest";
import { app } from "../src/app";
import { createTestUser, generateTestToken } from "./helpers";

// Prevent real GitHub API calls
jest.mock("@octokit/rest", () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      listForAuthenticatedUser: jest.fn().mockResolvedValue({
        data: [
          {
            id: 1,
            name: "test-repo",
            full_name: "testowner/test-repo",
            description: "A test repository",
            private: false,
            language: "TypeScript",
            updated_at: "2024-01-01T00:00:00Z",
            open_issues_count: 2,
          },
        ],
      }),
      get: jest.fn().mockResolvedValue({
        data: {
          id: 1,
          name: "test-repo",
          full_name: "testowner/test-repo",
          description: "A test repository",
          private: false,
        },
      }),
    },
  })),
}));

describe("GET /api/repos", () => {
  it("returns 401 when no token provided", async () => {
    const res = await request(app).get("/api/repos");
    expect(res.status).toBe(401);
  });

  it("returns 200 with repo list for a valid token", async () => {
    const user = await createTestUser();
    const token = generateTestToken(user.id);

    const res = await request(app)
      .get("/api/repos")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      name: "test-repo",
      fullName: "testowner/test-repo",
      isPrivate: false,
    });
  });
});
