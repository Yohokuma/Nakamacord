// db/fruitIndex.js
const fs = require("fs");
const path = require("path");

const FRUITS_DIR = path.join(__dirname, "fruits");

function safeRequire(filePath) {
  try {
    const mod = require(filePath);
    return mod && mod.name && mod.rarity ? mod : null;
  } catch {
    return null;
  }
}
function normalizeKey(name) { return String(name).trim().toLowerCase(); }

function listAllFruitMeta() {
  let entries = [];
  try {
    const files = fs.readdirSync(FRUITS_DIR).filter(f => f.endsWith(".js"));
    for (const f of files) {
      const mod = safeRequire(path.join(FRUITS_DIR, f));
      if (!mod) continue;
      const key = normalizeKey(mod.name);
      entries.push({
        key,
        name: mod.name,
        rarity: mod.rarity,
        isLogia: !!mod.isLogia,
        aliases: Array.isArray(mod.aliases) ? mod.aliases : [],
        gif: mod.gif || null,
      });
    }
  } catch { entries = []; }
  return entries;
}

const RARITY_WEIGHTS = { Common: 66.5, Rare: 30.0, Legendary: 3.0, Mythical: 0.5 };

function pickRarityByWeights() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a,b)=>a+b,0);
  const r = Math.random() * total;
  let acc = 0;
  for (const [rarity, w] of Object.entries(RARITY_WEIGHTS)) {
    acc += w;
    if (r <= acc) return rarity;
  }
  return "Common";
}
function pickRandom(arr){ return !arr?.length ? null : arr[Math.floor(Math.random()*arr.length)]; }

function pickRandomFruitMeta() {
  const all = listAllFruitMeta();
  if (!all.length) return null;

  const rarity = pickRarityByWeights();
  const bucket = all.filter(x => (x.rarity || "Common") === rarity);
  if (bucket.length) return pickRandom(bucket);

  const tryOrder = ["Mythical","Legendary","Rare","Common"];
  for (const r of tryOrder) {
    const b = all.filter(x => (x.rarity || "Common") === r);
    if (b.length) return pickRandom(b);
  }
  return pickRandom(all);
}

module.exports = { listAllFruitMeta, pickRandomFruitMeta };
