// db/activeSpawns.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "activeSpawns.json");

function loadActiveSpawns() {
  try {
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw || "{}");
    // safety: auto-prune expired
    const now = Date.now();
    for (const [gid, s] of Object.entries(data)) {
      if (s && s.expiresAt && now > s.expiresAt && !s.caughtBy) {
        delete data[gid];
      }
    }
    return data;
  } catch {
    return {};
  }
}

function saveActiveSpawns(obj) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("saveActiveSpawns error:", e);
  }
}

module.exports = { loadActiveSpawns, saveActiveSpawns };
