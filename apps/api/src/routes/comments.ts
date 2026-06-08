import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { getIO } from "../websocket/socket";

export const commentsRouter = Router();
commentsRouter.use(authenticate);

const createCommentSchema = z.object({
  body: z.string().min(1).max(10000),
  filePath: z.string().optional(),
  lineStart: z.number().int().optional(),
  lineEnd: z.number().int().optional(),
  pullRequestId: z.string(),
});

// Get comments for a PR
commentsRouter.get("/pr/:pullRequestId", async (req: AuthRequest, res: Response) => {
  const comments = await prisma.comment.findMany({
    where: { pullRequestId: req.params.pullRequestId },
    include: { user: { select: { username: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

// Post a new comment
commentsRouter.post("/", async (req: AuthRequest, res: Response) => {
  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const comment = await prisma.comment.create({
    data: {
      body: parsed.data.body,
      filePath: parsed.data.filePath,
      lineStart: parsed.data.lineStart,
      lineEnd: parsed.data.lineEnd,
      pullRequestId: parsed.data.pullRequestId,
      userId: req.userId!,
    },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });

  // Broadcast to everyone viewing this PR via WebSocket
  getIO().to(`pr:${comment.pullRequestId}`).emit("comment:new", comment);

  res.status(201).json(comment);
});

// Delete a comment (own comments only)
commentsRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

  await prisma.comment.delete({ where: { id: req.params.id } });
  getIO().to(`pr:${comment.pullRequestId}`).emit("comment:deleted", { id: req.params.id });

  res.json({ success: true });
});
