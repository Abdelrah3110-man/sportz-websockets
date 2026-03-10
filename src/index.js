import express from "express";
import http from "http";
import { matcheRouter } from "./routes/matches.js";
import { CommentaryRouter } from "./routes/commentary.js";
import { attachWebsocketServer } from "./ws/server.js";
import { securityMiddelware } from "./arcjet.js";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

const { broadcastMatchCreated, broadcastCommentary } =
  attachWebsocketServer(server);

app.use(express.json());

app.use((req, res, next) => {
  res.locals.broadcastMatchCreated = broadcastMatchCreated;
  res.locals.broadcastCommentary = broadcastCommentary;
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Hello, this is a simple Express server!" });
});

app.use(securityMiddelware());

app.use("/matches", matcheRouter);
app.use("/matches/:id/commentary", CommentaryRouter);

server.listen(PORT, "0.0.0.0", () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const baseUrl = `http://${displayHost}:${PORT}`;

  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `Websocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
