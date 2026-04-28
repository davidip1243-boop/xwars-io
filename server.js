const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const rooms = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  if (req.url !== "/ws") {
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.id = crypto.randomUUID();
  socket.on("data", (buffer) => handleFrame(socket, buffer));
  socket.on("close", () => leaveRoom(socket));
  socket.on("error", () => leaveRoom(socket));
});

function handleFrame(socket, buffer) {
  const message = decodeFrame(buffer);
  if (!message) return;
  let data;
  try {
    data = JSON.parse(message);
  } catch {
    return;
  }
  if (data.type === "join") joinRoom(socket, data);
  if (!socket.room) return;
  if (data.type === "state") {
    socket.roomState = data.state;
    rooms.get(socket.room).state = data.state;
    broadcast(socket.room, socket, data);
  }
  if (data.type === "move" || data.type === "profile" || data.type === "new-game") {
    broadcast(socket.room, socket, data);
  }
}

function joinRoom(socket, data) {
  leaveRoom(socket);
  const roomName = String(data.room || "xwars").slice(0, 24);
  if (!rooms.has(roomName)) rooms.set(roomName, { clients: [], state: null });
  const room = rooms.get(roomName);
  room.clients = room.clients.filter((client) => !client.destroyed);
  if (room.clients.length >= 2) {
    send(socket, { type: "full" });
    return;
  }
  socket.room = roomName;
  socket.profile = data.profile || {};
  socket.owner = room.clients.length === 0 ? "player" : "bot";
  room.clients.push(socket);
  send(socket, {
    type: "assigned",
    owner: socket.owner,
    peers: room.clients.length,
    state: room.state,
    profiles: room.clients.map((client) => ({ owner: client.owner, profile: client.profile })),
  });
  broadcast(roomName, socket, {
    type: "peer",
    owner: socket.owner,
    peers: room.clients.length,
    profile: socket.profile,
  });
}

function leaveRoom(socket) {
  if (!socket.room || !rooms.has(socket.room)) return;
  const room = rooms.get(socket.room);
  room.clients = room.clients.filter((client) => client !== socket);
  broadcast(socket.room, socket, { type: "peer-left", peers: room.clients.length });
  if (room.clients.length === 0) rooms.delete(socket.room);
  socket.room = null;
}

function broadcast(roomName, sender, data) {
  const room = rooms.get(roomName);
  if (!room) return;
  for (const client of room.clients) {
    if (client !== sender) send(client, data);
  }
}

function send(socket, data) {
  socket.write(encodeFrame(JSON.stringify(data)));
}

function decodeFrame(buffer) {
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x8) return null;
  let offset = 2;
  let length = buffer[1] & 0x7f;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    length = Number(buffer.readBigUInt64BE(offset));
    offset += 8;
  }
  const mask = buffer.slice(offset, offset + 4);
  offset += 4;
  const payload = buffer.slice(offset, offset + length);
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] ^= mask[index % 4];
  }
  return payload.toString("utf8");
}

function encodeFrame(message) {
  const payload = Buffer.from(message);
  const header = payload.length < 126 ? Buffer.alloc(2) : payload.length <= 65535 ? Buffer.alloc(4) : Buffer.alloc(10);
  header[0] = 0x81;
  if (payload.length < 126) {
    header[1] = payload.length;
  } else if (payload.length <= 65535) {
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  return Buffer.concat([header, payload]);
}

server.listen(PORT, () => {
  console.log(`Xwars online server running at http://localhost:${PORT}`);
});
