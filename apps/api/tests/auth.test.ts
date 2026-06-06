import request from "supertest";
import { app } from "../src/app";
import { createTestUser, generateTestToken } from "./helpers";

describe("GET /api/auth/github", () => {
  it("redirects to GitHub OAuth URL", async () => {
    const res = await request(app).get("/api/auth/github");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("github.com/login/oauth/authorize");
    expect(res.headers.location).toContain(process.env.GITHUB_CLIENT_ID);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when no token provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer totally-invalid-token");
    expect(res.status).toBe(401);
  });

  it("returns user data when a valid JWT is provided", async () => {
    const user = await createTestUser({ username: "authtestuser" });
    const token = generateTestToken(user.id);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe("authtestuser");
    // Access token must never be exposed
    expect(res.body.accessToken).toBeUndefined();
  });
});
