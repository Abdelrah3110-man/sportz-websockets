import WebSocket, { WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);

  if (!socket.subscriptions) {
    socket.subscriptions = new Set();
  }
  socket.subscriptions.add(matchId);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }

  if (socket.subscriptions) {
    socket.subscriptions.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  if (!socket.subscriptions) return;

  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    sendJson(client, payload);
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (socket, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Too Many Requests"
            : "access denied";
          socket.close(code, reason);
          return;
        }
      } catch (error) {
        console.error(error);
        socket.close(1011, "Internal Server Error");
        return;
      }
    }

    sendJson(socket, { type: "welcome" });

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data);

        if (message.type === "subscribe" && message.matchId) {
          subscribe(message.matchId, socket);
          sendJson(socket, { type: "subscribed", matchId: message.matchId });
        } else if (message.type === "unsubscribe" && message.matchId) {
          unsubscribe(message.matchId, socket);
          sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
        }
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });

    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId, entry) {
    broadcastToMatch(matchId, {
      type: "new_commentary",
      data: entry,
    });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
