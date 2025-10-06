// db/pvp.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "pvp.json");

function loadPvP() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw || "{}");
    if (!Array.isArray(data.pending)) data.pending = [];
    return data;
  } catch {
    return { pending: [] };
  }
}

function savePvP(data) {
  try {
    if (!data || !Array.isArray(data.pending)) data = { pending: [] };
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("savePvP error:", e);
  }
}

function findPendingFor(store, userId, channelId) {
  if (!store || !Array.isArray(store.pending)) return null;
  return store.pending.find(
    (c) =>
      c.status === "pending" &&
      c.opponent === userId &&
      c.channelId === channelId
  );
}

function removePair(store, challengerId, opponentId) {
  if (!store || !Array.isArray(store.pending)) return;
  store.pending = store.pending.filter(
    (c) =>
      !(
        c.status === "pending" &&
        c.challenger === challengerId &&
        c.opponent === opponentId
      )
  );
}

function removeById(store, id) {
  if (!store || !Array.isArray(store.pending)) return;
  store.pending = store.pending.filter((c) => c.id !== id);
}

module.exports = {
  loadPvP,
  savePvP,
  findPendingFor,
  removePair,
  removeById,
};
