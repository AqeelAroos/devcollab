import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";

export interface AuthRequest extends Request {
  userId?: string;
  user?: { id: string; username: string; githubId: string };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) return res.status(401).json({ error: "User not found" });

    req.userId = user.id;
    req.user = { id: user.id, username: user.username, githubId: user.githubId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};
