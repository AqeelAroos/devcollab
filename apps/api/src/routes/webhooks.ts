import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";

export const webhooksRouter = Router();

// GitHub sends events here when a PR is opened/updated
webhooksRouter.post("/github", async (req: Request, res: Response) => {
  const event = req.headers["x-github-event"] as string;

  if (event === "pull_request") {
    const { action, pull_request, repository } = req.body;

    if (["opened", "synchronize", "reopened"].includes(action)) {
      try {
        // Find or create repo
        const repo = await prisma.repository.upsert({
          where: { githubRepoId: repository.id },
          update: {},
          create: {
            githubRepoId: repository.id,
            owner: repository.owner.login,
            name: repository.name,
            fullName: repository.full_name,
            isPrivate: repository.private,
          },
        });

        // Upsert the PR
        await prisma.pullRequest.upsert({
          where: { repositoryId_number: { repositoryId: repo.id, number: pull_request.number } },
          update: {
            title: pull_request.title,
            body: pull_request.body,
            state: pull_request.state.toUpperCase(),
            additions: pull_request.additions || 0,
            deletions: pull_request.deletions || 0,
          },
          create: {
            githubPrId: pull_request.id,
            number: pull_request.number,
            title: pull_request.title,
            body: pull_request.body,
            state: "OPEN",
            authorLogin: pull_request.user.login,
            baseBranch: pull_request.base.ref,
            headBranch: pull_request.head.ref,
            repositoryId: repo.id,
          },
        });
      } catch (err) {
        console.error("Webhook processing error:", err);
      }
    }
  }

  res.status(200).json({ received: true });
});
