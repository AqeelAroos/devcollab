import { Router, Response } from "express";
import { Octokit } from "@octokit/rest";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

export const reposRouter = Router();
reposRouter.use(authenticate);

// List user's GitHub repos
reposRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const octokit = new Octokit({ auth: user!.accessToken });

    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 50,
    });

    res.json(data.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      isPrivate: r.private,
      language: r.language,
      updatedAt: r.updated_at,
      openIssues: r.open_issues_count,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// Get a single repo and sync it to DB
reposRouter.get("/:owner/:repo", async (req: AuthRequest, res: Response) => {
  const { owner, repo } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const octokit = new Octokit({ auth: user!.accessToken });

    const { data } = await octokit.repos.get({ owner, repo });

    const repository = await prisma.repository.upsert({
      where: { githubRepoId: data.id },
      update: { description: data.description, isPrivate: data.private },
      create: {
        githubRepoId: data.id,
        owner,
        name: repo,
        fullName: data.full_name,
        description: data.description,
        isPrivate: data.private,
      },
    });

    res.json(repository);
  } catch {
    res.status(404).json({ error: "Repository not found" });
  }
});
