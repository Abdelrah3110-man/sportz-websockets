import WebSocket, { WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

/**
 * Register a socket as a subscriber for a given match and record that subscription on the socket.
 *
 * Ensures a subscriber set exists for the matchId, adds the socket to that set, and adds the matchId
 * to the socket's `subscriptions` set.
 * @param {string|number} matchId - Identifier of the match to subscribe to.
 * @param {WebSocket} socket - The client's WebSocket connection to register.
 */
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

/**
 * Remove a socket's subscription for a given match and clean up internal subscriber tracking.
 * @param {string} matchId - The match identifier to unsubscribe from.
 * @param {WebSocket & { subscriptions?: Set<string> }} socket - The socket to remove from the match's subscriber set; may hold a `subscriptions` Set of matchIds.
 */
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

/**
 * Remove the socket from every match subscription it is recorded on.
 *
 * Iterates the socket's `subscriptions` set (if present) and unsubscribes the socket from each match ID.
 * @param {WebSocket} socket - WebSocket whose `subscriptions` (a Set of matchId strings) will be cleaned up.
 */
function cleanupSubscriptions(socket) {
  if (!socket.subscriptions) return;

  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

/**
 * Send a JSON-serializable payload to the socket if the socket is open.
 * No action is taken when the socket is not in the OPEN state.
 * @param {WebSocket} socket - The destination WebSocket.
 * @param {*} payload - The value to serialize and send. Must be JSON-serializable.
 */
function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

/**
 * Broadcasts a JSON-serializable payload to every client connected to the WebSocket server.
 * @param {import('ws').WebSocketServer} wss - The WebSocket server whose connected clients will receive the payload.
 * @param {*} payload - The value to be serialized to JSON and sent to each client.
 */
function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    sendJson(client, payload);
  }
}

/**
 * Send a JSON-serialized payload to all subscribed sockets for a given match.
 *
 * @param {string} matchId - Identifier of the match whose subscribers will receive the payload.
 * @param {any} payload - Value to serialize and send to each subscribed client.
 */
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

/**
 * Attach a WebSocket endpoint to an existing HTTP server and provide match-focused broadcasting helpers.
 *
 * The created WebSocket server listens at "/ws", manages per-connection subscriptions for matches,
 * handles "subscribe" and "unsubscribe" messages, optionally enforces wsArcjet protections on new
 * connections, and cleans up subscriptions when connections close.
 *
 * @param {import('http').Server} server - The HTTP server to attach the WebSocket endpoint to.
 * @returns {{ broadcastMatchCreated: (match: any) => void, broadcastCommentary: (matchId: string, entry: any) => void }}
 *   An object with:
 *   - broadcastMatchCreated(match): broadcast a `match_created` event to all connected clients.
 *   - broadcastCommentary(matchId, entry): broadcast a `new_commentary` event to subscribers of the given matchId.
 */
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
