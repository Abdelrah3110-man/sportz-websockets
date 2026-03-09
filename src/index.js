import express from 'express';
import { matcheRouter } from './routes/matches.js';
import http from "http";
import { attachWebsocketServer } from './ws/server.js';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0" ;

const app = express();

const server = http.createServer(app);

// Use JSON middleware
app.use(express.json());

// Route that returns a short message   
app.get('/', (req, res) => {
  res.json({ message: 'Hello, this is a simple Express server!' });
});

app.use('/matches', matcheRouter);
const { broadcastMatchCreated } = attachWebsocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;


// Start the server and log the URL
server.listen(PORT, '0.0.0.0', () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const baseUrl = `http://${displayHost}:${PORT}`;
  
  console.log(`Server is running on ${baseUrl}`);
  console.log(`Websocket Server is running on ${baseUrl.replace("http", "ws")}/ws`);
});
