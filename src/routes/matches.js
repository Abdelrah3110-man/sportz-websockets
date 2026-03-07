import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";


export const matcheRouter = Router();


matcheRouter.get('/', async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
        return res.status(400).json({ 
            error: 'invalid query params', 
            details: parsed.error.format() 
        });
    }

    const limit = Math.min(parsed.data.limit ?? 50, 100);

    try {
        const allMatches = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit);

        return res.status(200).json({ data: allMatches });
    } catch (error) {
        console.error("Fetch Error:", error); 
        return res.status(500).json({ 
            error: 'failed to fetch matches', 
            details: error.message 
        });
    }
});

matcheRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid data' , details: JSON.stringify(parsed.error) });
    }
    
    const {data: {startTime, endTime , homeScore, awayScore}} = parsed;
    try {
        const [event] = await db.insert(matches).values({
            ...parsed.data,
           startTime: new Date(startTime),
           endTime: new Date(endTime),
           homeScore: homeScore ?? 0,
           awayScore: awayScore ?? 0,
           status: getMatchStatus(startTime, endTime),
       }).returning();
       return res.status(201).json({data: event });
    } catch (error) {
        return res.status(500).json({ error: 'failed to create match' , details: JSON.stringify(error) });
    }
});