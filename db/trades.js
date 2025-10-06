// db/trades.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "trades.json");

function loadTrades() {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveTrades(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("saveTrades error:", e);
  }
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Busca un trade OPEN donde participe el user. Si pasas channelId, también filtra por canal. */
function getOpenTradeForUser(userId, channelId) {
  const trades = loadTrades();
  const ids = Object.keys(trades);
  for (const id of ids) {
    const t = trades[id];
    if (!t) continue;
    if (t.status !== "open") continue;
    if (channelId && t.channelId !== channelId) continue;
    if (Array.isArray(t.users) && t.users.includes(userId)) {
      return { id, trade: t };
    }
  }
  return null;
}

function createTrade(guildId, channelId, aId, bId) {
  const trades = loadTrades();
  const id = newId();
  trades[id] = {
    id,
    status: "open",
    guildId,
    channelId,
    users: [aId, bId],
    offers: {
      [aId]: { fruits: [] },
      [bId]: { fruits: [] },
    },
    accepted: {
      [aId]: false,
      [bId]: false,
    },
    lastActivity: Date.now(),
  };
  saveTrades(trades);
  return { id, trade: trades[id] };
}

function touchTrade(id) {
  const trades = loadTrades();
  if (!trades[id]) return;
  trades[id].lastActivity = Date.now();
  saveTrades(trades);
}

function setTradeStatus(id, status) {
  const trades = loadTrades();
  if (!trades[id]) return;
  trades[id].status = status;
  trades[id].lastActivity = Date.now();
  saveTrades(trades);
}

function addFruitOffer(id, userId, fruitName) {
  const trades = loadTrades();
  const t = trades[id];
  if (!t || t.status !== "open") return false;
  t.offers[userId] = t.offers[userId] || { fruits: [] };
  t.offers[userId].fruits.push(fruitName);
  // si alguien modifica, se desaceptan
  t.accepted[t.users[0]] = false;
  t.accepted[t.users[1]] = false;
  t.lastActivity = Date.now();
  saveTrades(trades);
  return true;
}

function removeFruitOffer(id, userId, fruitName) {
  const trades = loadTrades();
  const t = trades[id];
  if (!t || t.status !== "open") return false;
  const bag = t.offers[userId]?.fruits || [];
  const i = bag.findIndex((f) => f.toLowerCase() === fruitName.toLowerCase());
  if (i === -1) return false;
  bag.splice(i, 1);
  t.offers[userId].fruits = bag;
  t.accepted[t.users[0]] = false;
  t.accepted[t.users[1]] = false;
  t.lastActivity = Date.now();
  saveTrades(trades);
  return true;
}

function setAccepted(id, userId, val) {
  const trades = loadTrades();
  const t = trades[id];
  if (!t || t.status !== "open") return null;
  t.accepted[userId] = !!val;
  t.lastActivity = Date.now();
  saveTrades(trades);
  return t;
}

module.exports = {
  loadTrades,
  saveTrades,
  getOpenTradeForUser,
  createTrade,
  touchTrade,
  setTradeStatus,
  addFruitOffer,
  removeFruitOffer,
  setAccepted,
};

