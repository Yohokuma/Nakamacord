// db/fruitResolver.js
const items = require("./items"); // tu items.js que combina todas las frutas

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const idx = (() => {
  const map = new Map();
  for (const [name, meta] of Object.entries(items.fruits || {})) {
    if (!meta) continue;
    map.set(norm(name), name);
    (meta.aliases || []).forEach((a) => map.set(norm(a), name));
  }
  return map;
})();

function resolveFruit(input) {
  const key = idx.get(norm(input));
  if (!key) return null;
  return { name: key };
}

module.exports = { resolveFruit };
