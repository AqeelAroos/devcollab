import { Router, Response } from "express";
import { Octokit } from "@octokit/rest";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

export const prsRouter = Router();
prsRouter.use(authenticate);

// List PRs for a repo
prsRouter.get("/:owner/:repo", async (req: AuthRequest, res: Response) => {
  const { owner, repo } = req.params;
  const state = (req.query.state as "open" | "closed" | "all") || "open";

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const octokit = new Octokit({ auth: user!.accessToken });

    const { data } = await octokit.pulls.list({ owner, repo, state, per_page: 30 });

    res.json(data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login,
      authorAvatar: pr.user?.avatar_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      additions: pr.additions,
      deletions: pr.deletions,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch pull requests" });
  }
});

// Get single PR with diff — also upserts into DB so comments FK works
prsRouter.get("/:owner/:repo/:number", async (req: AuthRequest, res: Response) => {
  const { owner, repo, number } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const octokit = new Octokit({ auth: user!.accessToken });

    const [{ data: pr }, { data: files }] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number: Number(number) }),
      octokit.pulls.listFiles({ owner, repo, pull_number: Number(number) }),
    ]);

    // Sync into DB so comments (which have a FK) can reference a real CUID
    let pullRequestDbId: string | null = null;
    try {
      const fullName = `${owner}/${repo}`;
      // INT max is 2147483647; cap so we don't exceed PostgreSQL INT range
      const safeRepoId = Math.min(pr.base.repo.id, 2147483647);
      const prState = (pr.merged_at ? "MERGED" : pr.state === "closed" ? "CLOSED" : "OPEN") as "OPEN" | "CLOSED" | "MERGED";

      let dbRepo = await prisma.repository.findUnique({ where: { fullName } });
      if (!dbRepo) {
        try {
          dbRepo = await prisma.repository.create({
            data: {
              githubRepoId: safeRepoId,
              owner,
              name: repo,
              fullName,
              description: pr.base.repo.description ?? null,
              isPrivate: pr.base.repo.private,
            },
          });
        } catch {
          // Race condition or ID conflict — find by fullName
          dbRepo = await prisma.repository.findUnique({ where: { fullName } });
        }
      }

      if (dbRepo) {
        const dbPr = await prisma.pullRequest.upsert({
          where: { repositoryId_number: { repositoryId: dbRepo.id, number: pr.number } },
          create: {
            githubPrId: pr.number,
            number: pr.number,
            title: pr.title,
            body: pr.body ?? null,
            state: prState,
            authorLogin: pr.user?.login ?? "",
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            repositoryId: dbRepo.id,
          },
          update: {
            title: pr.title,
            state: prState,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          },
        });
        pullRequestDbId = dbPr.id;
      }
    } catch (syncErr) {
      console.warn("PR DB sync warning (non-fatal):", syncErr);
    }

    res.json({
      id: pullRequestDbId ?? String(pr.id),
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      author: pr.user?.login,
      authorAvatar: pr.user?.avatar_url,
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      additions: pr.additions,
      deletions: pr.deletions,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    });
  } catch {
    res.status(404).json({ error: "Pull request not found" });
  }
});
