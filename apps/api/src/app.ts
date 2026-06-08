import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { authRouter } from "./routes/auth";
import { reposRouter } from "./routes/repos";
import { prsRouter } from "./routes/prs";
import { reviewsRouter } from "./routes/reviews";
import { commentsRouter } from "./routes/comments";
import { aiRouter } from "./routes/ai";
import { webhooksRouter } from "./routes/webhooks";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";

export const app = express();
export const httpServer = createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (origin === process.env.WEB_URL) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(rateLimiter);

app.use("/api/auth", authRouter);
app.use("/api/repos", reposRouter);
app.use("/api/prs", prsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/webhooks", webhooksRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(errorHandler);

export default app;
