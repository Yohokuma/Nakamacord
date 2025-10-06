// db/spawnChannels.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "spawnChannels.json");

function loadSpawnChannels() {
  try {
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function saveSpawnChannels(map) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(map, null, 2), "utf8");
  } catch (e) {
    console.error("saveSpawnChannels error:", e);
  }
}

module.exports = { loadSpawnChannels, saveSpawnChannels };
