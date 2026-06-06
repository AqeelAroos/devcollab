import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Octokit } from "@octokit/rest";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

export const authRouter = Router();

// Step 1: Redirect user to GitHub OAuth
authRouter.get("/github", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_CALLBACK_URL!,
    scope: "read:user user:email repo",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Step 2: GitHub redirects back with a code
authRouter.get("/github/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.WEB_URL}/auth/error`);

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const { access_token } = await tokenRes.json() as { access_token: string };

    // Fetch GitHub user profile
    const octokit = new Octokit({ auth: access_token });
    const { data: ghUser } = await octokit.users.getAuthenticated();

    // Upsert user in DB
    const user = await prisma.user.upsert({
      where: { githubId: String(ghUser.id) },
      update: {
        username: ghUser.login,
        name: ghUser.name,
        email: ghUser.email,
        avatarUrl: ghUser.avatar_url,
        accessToken: access_token,
      },
      create: {
        githubId: String(ghUser.id),
        username: ghUser.login,
        name: ghUser.name,
        email: ghUser.email,
        avatarUrl: ghUser.avatar_url,
        accessToken: access_token,
      },
    });

    // Issue JWT
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.redirect(`${process.env.WEB_URL}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("OAuth error:", err);
    res.redirect(`${process.env.WEB_URL}/auth/error`);
  }
});

// Get current user
authRouter.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, username: true, name: true, avatarUrl: true, email: true },
  });
  res.json(user);
});

// Logout (client-side token removal, but we can track refresh tokens here later)
authRouter.post("/logout", authenticate, (_req: AuthRequest, res: Response) => {
  res.json({ success: true });
});
