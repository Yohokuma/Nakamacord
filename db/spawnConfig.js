// db/spawnConfig.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "spawn-config.json");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
}

function getSpawnChannelId(guildId) {
  const cfg = loadConfig();
  return cfg.guilds?.[guildId]?.channelId || null;
}

function setSpawnChannelId(guildId, channelId) {
  const cfg = loadConfig();
  cfg.guilds[guildId] = { channelId };
  saveConfig(cfg);
}

module.exports = {
  loadConfig,
  saveConfig,
  getSpawnChannelId,
  setSpawnChannelId,
};
