
// db/guilds.js
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "guilds.json");

function loadGuilds() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveGuilds(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

// ----- Spawn channel config -----
function getSpawnChannelId(guildId) {
  const db = loadGuilds();
  return db[guildId]?.spawnChannelId ?? null;
}
function setSpawnChannelId(guildId, channelId) {
  const db = loadGuilds();
  if (!db[guildId]) db[guildId] = {};
  db[guildId].spawnChannelId = channelId;
  saveGuilds(db);
}

// ----- Drop chance config -----
function getSpawnDropChance(guildId) {
  const db = loadGuilds();
  return db[guildId]?.spawnDropChance ?? null; // null -> use default
}
function setSpawnDropChance(guildId, chanceFloat) {
  const db = loadGuilds();
  if (!db[guildId]) db[guildId] = {};
  db[guildId].spawnDropChance = chanceFloat; // 0.0 .. 1.0
  saveGuilds(db);
}

module.exports = {
  loadGuilds,
  saveGuilds,
  getSpawnChannelId,
  setSpawnChannelId,
  getSpawnDropChance,
  setSpawnDropChance,
};
