const WebSocket = require("ws");
const redis = require("redis");
let publisher;
let redisClient;

const redisExpireTimeInSeconds = 10;

let clients = [];

// Initialisiere den WebSocket-Server
const initializeWebsocketServer = async (server) => {
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || "6379",
    },
  });
  await redisClient.connect();
  // Dies ist der Teil für den Subscriber
  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  // Dies ist der Teil für den Publisher
  publisher = redisClient.duplicate();
  await publisher.connect();

  const websocketServer = new WebSocket.Server({ server });
  websocketServer.on("connection", onConnection);
  websocketServer.on("error", console.error);
  await subscriber.subscribe("newMessage", onRedisMessage);
  // Starte das Heartbeat, sobald der Server initialisiert ist
  heartbeat();
};

// Wenn eine neue Verbindung hergestellt wird, wird die Funktion onConnection aufgerufen
const onConnection = (ws) => {
  console.log("Neue WebSocket-Verbindung");
  ws.on("close", () => onClose(ws));
  ws.on("message", (message) => onClientMessage(ws, message));
};

// Hole alle Benutzer aus Redis
const getUsersFromRedis = async () => {
  let userKeys = await redisClient.keys("user:*");

  let users = [];
  for (let i = 0; i < userKeys.length; i++) {
    let user = await redisClient.get(userKeys[i]);
    if (user) {
      users.push(JSON.parse(user));
    }
  }

  return users;
};

// Wenn eine neue Nachricht empfangen wird, wird die Funktion onClientMessage aufgerufen
const onClientMessage = async (ws, message) => {
  const messageObject = JSON.parse(message);
  console.log("Nachricht von Client empfangen: " + messageObject.type);
  switch (messageObject.type) {
    case "user":
      clients = clients.filter((client) => client.ws !== ws);
      clients.push({ ws, user: messageObject.user });
      console.log("Anzahl der Clients: " + clients.length);
      redisClient.set(
        `user:${messageObject.user.id}`,
        JSON.stringify(messageObject.user)
      );
      redisClient.expire(
        `user:${messageObject.user.id}`,
        redisExpireTimeInSeconds
      );
      const message = {
        type: "pushUsers",
      };
      publisher.publish("newMessage", JSON.stringify(message));
      break;
    case "message":
      publisher.publish("newMessage", JSON.stringify(messageObject));
      break;
    default:
      console.error("Unbekannter Nachrichtentyp: " + messageObject.type);
  }
};

// Wenn eine neue Nachricht aus dem Redis-Kanal empfangen wird, wird die Funktion onRedisMessage aufgerufen
const onRedisMessage = async (message) => {
  const messageObject = JSON.parse(message);
  console.log("Nachricht aus dem Redis-Kanal empfangen: " + messageObject.type);
  switch (messageObject.type) {
    case "message":
      clients.forEach((client) => {
        client.ws.send(JSON.stringify(messageObject));
      });
      break;
    case "pushUsers":
      await pushUsers();
      break;
    default:
      console.error("Unbekannter Nachrichtentyp: " + messageObject.type);
  }
};

// Wenn eine Verbindung geschlossen wird, wird die Funktion onClose aufgerufen
const onClose = async (ws) => {
  console.log("WebSocket-Verbindung geschlossen");
  const client = clients.find((client) => client.ws === ws);
  if (!client) return;
  redisClient.del(`user:${client.user.id}`);
  const message = {
    type: "pushUsers",
  };
  publisher.publish("newMessage", JSON.stringify(message));
  clients = clients.filter((client) => client.ws !== ws);
};

// Die Heartbeat-Funktion wird alle 5 Sekunden aufgerufen
const heartbeat = async () => {
  for (let i = 0; i < clients.length; i++) {
    redisClient.expire(`user:${clients[i].user.id}`, redisExpireTimeInSeconds);
  }
  await pushUsers();
  setTimeout(heartbeat, (redisExpireTimeInSeconds * 1000) / 2);
};

// Sende die Benutzer an alle verbundenen Clients
const pushUsers = async () => {
  const users = await getUsersFromRedis();
  const message = {
    type: "users",
    users,
  };
  clients.forEach((client) => {
    client.ws.send(JSON.stringify(message));
  });
};

module.exports = { initializeWebsocketServer };
