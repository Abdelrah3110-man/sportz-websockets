import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { eq, desc } from "drizzle-orm";

export const CommentaryRouter = Router({ mergeParams: true });

CommentaryRouter.get("/", async (req, res) => {
  const matchIdParsed = matchIdParamSchema.safeParse(req.params);
  if (!matchIdParsed.success) {
    return res.status(400).json({
      error: "invalid match parameter",
      details: matchIdParsed.error.format(),
    });
  }

  const parsed = listCommentaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid query configuration",
      details: parsed.error.format(),
    });
  }

  try {
    const { id: matchId } = matchIdParsed.data;
    const limit = Math.min(parsed.data.limit ?? 100, 100);

    const commentaryList = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.status(200).json({ data: commentaryList });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "failed to fetch commentary",
      details: error.message,
    });
  }
});

CommentaryRouter.post("/", async (req, res) => {
  const matchIdParsed = matchIdParamSchema.safeParse(req.params);
  if (!matchIdParsed.success) {
    return res.status(400).json({
      error: "invalid match parameter",
      details: matchIdParsed.error.format(),
    });
  }

  const parsed = createCommentarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid data",
      details: parsed.error.format(),
    });
  }

  try {
    const { id: matchId } = matchIdParsed.data;

    const [entry] = await db
      .insert(commentary)
      .values({
        matchId,
        ...parsed.data,
      })
      .returning();

    if (res.locals.broadcastCommentary) {
      res.locals.broadcastCommentary(entry.matchId, entry);
    }

    return res.status(201).json({ data: entry });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "failed to create commentary",
      details: error.message,
    });
  }
});
