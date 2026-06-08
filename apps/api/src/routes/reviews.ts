import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

export const reviewsRouter = Router();
reviewsRouter.use(authenticate);

const submitReviewSchema = z.object({
  pullRequestId: z.string(),
  state: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]),
  body: z.string().optional(),
});

reviewsRouter.get("/pr/:pullRequestId", async (req: AuthRequest, res: Response) => {
  const reviews = await prisma.review.findMany({
    where: { pullRequestId: req.params.pullRequestId },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(reviews);
});

reviewsRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = submitReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const review = await prisma.review.create({
    data: {
      state: parsed.data.state,
      body: parsed.data.body,
      pullRequestId: parsed.data.pullRequestId,
      userId: req.userId!,
    },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  res.status(201).json(review);
});
