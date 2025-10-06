// db/fruitPool.js
const fs = require("fs");
const path = require("path");

// Probabilidades por rareza (suma ~100)
const RARITY_BUCKETS = [
  { key: "Mythical",  p: 0.5 },
  { key: "Legendary", p: 3.0 },
  { key: "Rare",      p: 30.0 },
  { key: "Common",    p: 66.5 },
];

function loadFruitMetas() {
  const dir = path.join(__dirname, "fruits");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

  const metas = [];
  for (const f of files) {
    try {
      const m = require(path.join(dir, f));
      if (!m || !m.name || !m.rarity) continue;
      metas.push({
        name: m.name,
        rarity: m.rarity,
        aliases: m.aliases || [],
        isLogia: !!m.isLogia,
        gif: m.gif || null,
      });
    } catch (e) {
      console.error("Error loading fruit meta:", f, e);
    }
  }
  return metas;
}

function _pickBucket() {
  const roll = Math.random() * 100; // 0-100
  let acc = 0;
  for (const b of RARITY_BUCKETS) {
    acc += b.p;
    if (roll <= acc) return b.key;
  }
  return "Common";
}

function pickRandomFruitMeta(metas) {
  if (!metas || metas.length === 0) return null;

  // Intentar por bucket (rareza) con fallback si no hay frutas de esa rareza
  for (let i = 0; i < 4; i++) {
    const bucket = _pickBucket();
    const pool = metas.filter(m => (m.rarity || "").toLowerCase() === bucket.toLowerCase());
    if (pool.length) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  // Fallback final: cualquiera
  return metas[Math.floor(Math.random() * metas.length)];
}

module.exports = {
  loadFruitMetas,
  pickRandomFruitMeta,
};
