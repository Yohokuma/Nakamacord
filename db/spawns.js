// db/spawns.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "spawns.json");

function loadSpawns() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { byChannel: {} };
  }
}

function saveSpawns(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getActiveSpawn(channelId) {
  const data = loadSpawns();
  const spawn = data.byChannel[channelId];
  if (!spawn) return null;
  if (spawn.claimed) return null;
  if (spawn.expiresAt && Date.now() > spawn.expiresAt) return null;
  return spawn;
}

function setSpawn(channelId, spawn) {
  const data = loadSpawns();
  data.byChannel[channelId] = spawn;
  saveSpawns(data);
}

function clearSpawn(channelId) {
  const data = loadSpawns();
  delete data.byChannel[channelId];
  saveSpawns(data);
}

module.exports = {
  loadSpawns,
  saveSpawns,
  getActiveSpawn,
  setSpawn,
  clearSpawn,
};
