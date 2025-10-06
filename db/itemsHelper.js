// db/itemsHelper.js
// Unifica items de db/items.js y TODOS los fruits de db/fruits/*.js.
// Así evitamos “Missing item data” cuando el jugador tiene equipada
// una fruta que solo existe en /db/fruits/.

const itemsDB = require("./items"); // opcional: si no existe, asegúrate de que exporte { fruits, weapons }
const { getAllFruitDefs } = require("./fruits"); // lee ./fruits/*.js

// --- Normalizer (para comparar nombres/aliases) ---
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Cache de índices
let _cache = null;

function buildIndex() {
  if (_cache) return _cache;

  const byCanonical = new Map();       // name canónico -> item (con .name y .type)
  const aliasToCanonical = new Map();  // alias normalizado -> name canónico

  // 1) Cargar desde db/items.js si existe estructura
  const fruitsFromItems = itemsDB?.fruits || {};
  const weaponsFromItems = itemsDB?.weapons || {};

  // ===== Frutas de items.js =====
  Object.entries(fruitsFromItems).forEach(([name, item]) => {
    const obj = {
      name,
      type: "fruit",
      // conservamos todo lo que viniera del item
      ...item,
      // asegures:
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      skills: Array.isArray(item.skills) ? item.skills : [],
      stats: item.stats || {}, // puede estar vacío: getEffectiveStats se encarga
    };
    byCanonical.set(name, obj);
    aliasToCanonical.set(norm(name), name);
    obj.aliases.forEach(a => aliasToCanonical.set(norm(a), name));
  });

  // ===== Armas de items.js =====
  Object.entries(weaponsFromItems).forEach(([name, item]) => {
    const obj = {
      name,
      type: "weapon",
      ...item,
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      skills: Array.isArray(item.skills) ? item.skills : [],
      stats: item.stats || {},
    };
    byCanonical.set(name, obj);
    aliasToCanonical.set(norm(name), name);
    obj.aliases.forEach(a => aliasToCanonical.set(norm(a), name));
  });

  // 2) Fusionar con TODO lo que haya en /db/fruits/*.js
  //    Si la fruta ya está en items.js, la respetamos y solo agregamos aliases extra si no estaban.
  const defs = getAllFruitDefs(); // [{name, rarity, aliases, isLogia, image|gif}, ...]
  for (const def of defs) {
    const name = def.name;
    const exists = byCanonical.get(name);

    if (exists) {
      // Completar metadatos que no estén en items.js
      if (exists.type == null) exists.type = "fruit";
      if (exists.rarity == null) exists.rarity = def.rarity;
      if (exists.isLogia == null) exists.isLogia = !!def.isLogia;
      if (exists.image == null && def.image) exists.image = def.image;
      if (exists.gif == null && def.gif) exists.gif = def.gif;

      // Mezclar aliases
      const cur = new Set(exists.aliases || []);
      (def.aliases || []).forEach(a => cur.add(a));
      exists.aliases = Array.from(cur);

      // Reindexar alias
      aliasToCanonical.set(norm(name), name);
      exists.aliases.forEach(a => aliasToCanonical.set(norm(a), name));

      // Mantener stats/skills existentes. Si no hay, asegurar defaults:
      if (!exists.stats) exists.stats = {};
      if (!Array.isArray(exists.skills)) exists.skills = [];
    } else {
      // Crear un item mínimo para que PVP no caiga aunque no haya skills en items.js
      const obj = {
        name,
        type: "fruit",
        rarity: def.rarity || "Common",
        isLogia: !!def.isLogia,
        image: def.image || def.gif || null,
        gif: def.gif || null,
        aliases: Array.isArray(def.aliases) ? def.aliases : [],
        // Defaults seguros por si no está definida en items.js
        stats: {},     // getEffectiveStats te cubrirá con base del comando
        skills: [],    // PVP funcionará (sin skills especiales)
      };
      byCanonical.set(name, obj);

      aliasToCanonical.set(norm(name), name);
      obj.aliases.forEach(a => aliasToCanonical.set(norm(a), name));
    }
  }

  _cache = { byCanonical, aliasToCanonical };
  return _cache;
}

/**
 * resolveItemByInput(input, typeFilter?)
 * - Devuelve el objeto del ítem (con .name canónico) resolviendo por nombre o alias.
 * - typeFilter opcional: 'fruit' | 'weapon'
 */
function resolveItemByInput(input, typeFilter) {
  if (!input) return null;
  const { byCanonical, aliasToCanonical } = buildIndex();
  const key = aliasToCanonical.get(norm(input));
  if (!key) return null;

  const item = byCanonical.get(key);
  if (!item) return null;

  if (typeFilter && item.type !== typeFilter) return null;
  return item;
}

/** Compat: findItem(nameOrAlias) */
function findItem(input) {
  return resolveItemByInput(input); // sin filtro
}

/** Devuelve nombre canónico (o null si no existe) */
function normalizeItemName(input) {
  const it = resolveItemByInput(input);
  return it ? it.name : null;
}

/** Skills desbloqueadas segun forma/mastery (útil para menús) */
function getAvailableSkills(item, player, form, masteryOverride) {
  if (!item || !Array.isArray(item.skills)) return [];
  const mastery = typeof masteryOverride === "number" ? masteryOverride : 100;
  return item.skills.filter((s) => {
    if ((s.unlockAt ?? 1) > mastery) return false;
    if (form) return s.form === form;
    return !s.form && s.type !== "transform";
  });
}

/** De p.hakis → lista simple para menú/validaciones */
function getHakiSkills(p) {
  const out = [];
  if (p?.hakis?.buso) out.push("buso");
  if (p?.hakis?.ken)  out.push("ken");
  if (p?.hakis?.hao)  out.push("hao");
  return out;
}

module.exports = {
  norm,
  findItem,
  resolveItemByInput,
  normalizeItemName,
  getAvailableSkills,
  getHakiSkills,
};
