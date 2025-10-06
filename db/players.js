// db/players.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "players.json");

// ---------- IO ----------
function loadPlayers() {
  try {
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("players.load error:", e);
    return {};
  }
}

function savePlayers(store) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.error("players.save error:", e);
  }
}

// ---------- defaults / ensure ----------
function defaultPlayer(id) {
  return {
    id,
    belly: 0,
    _msgCount: 0, // exp por mensajes
    activeSlot: "fruit", // "fruit" | "weapon"
    equipped: { fruit: null, weapon: null },
    mastery: { fruit: {}, weapon: {} }, // { [name]: level 1..100 }
    inventory: { fruits: [], weapons: [] },
    hakis: { buso: false, ken: false, hao: false },
    starter: null,
  };
}

function ensurePlayer(store, userId) {
  if (!store[userId]) {
    store[userId] = defaultPlayer(userId);
  } else {
    const p = store[userId];
    p.equipped  = p.equipped  || { fruit: null, weapon: null };
    p.activeSlot = p.activeSlot || "fruit";
    p.inventory = p.inventory || { fruits: [], weapons: [] };
    p.inventory.fruits  = Array.isArray(p.inventory.fruits)  ? p.inventory.fruits  : [];
    p.inventory.weapons = Array.isArray(p.inventory.weapons) ? p.inventory.weapons : [];
    p.mastery = p.mastery || { fruit: {}, weapon: {} };
    p.mastery.fruit  = p.mastery.fruit  || {};
    p.mastery.weapon = p.mastery.weapon || {};
    p.hakis = p.hakis || { buso: false, ken: false, hao: false };
    if (typeof p._msgCount !== "number") p._msgCount = 0;
    if (typeof p.belly !== "number") p.belly = 0;
  }
  return store[userId];
}

// ---------- mastery ----------
function getItemMastery(player, type, name) {
  if (!player) return 1; // 🔹 default ahora es 1
  if (!player.mastery) player.mastery = { fruit: {}, weapon: {} };
  if (!player.mastery.fruit) player.mastery.fruit = {};
  if (!player.mastery.weapon) player.mastery.weapon = {};
  const bag = type === "weapon" ? player.mastery.weapon : player.mastery.fruit;

  // 🔹 Si no existe registro, retornamos 1 en vez de 0
  const lvl = bag[name];
  return typeof lvl === "number" ? lvl : 1;
}

function setItemMastery(player, type, name, v) {
  if (!player.mastery) player.mastery = { fruit: {}, weapon: {} };
  if (!player.mastery.fruit) player.mastery.fruit = {};
  if (!player.mastery.weapon) player.mastery.weapon = {};
  const bag = type === "weapon" ? player.mastery.weapon : player.mastery.fruit;
  // 🔹 Clamp 1..100 para que nunca quede en 0
  bag[name] = Math.max(1, Math.min(100, Math.floor(v)));
}

// ---------- stats efectivos ----------
/**
 * Bonus de mastery: +2% por nivel por encima de 1.
 * Mastery 1 => 0% bonus; Mastery 2 => +2%, etc.
 */
function getEffectiveStats(player, type, name, baseStats) {
  const m = getItemMastery(player, type, name) || 1;
  const mult = 1 + Math.max(0, m - 1) * 0.02;
  const hp     = Math.max(1, Math.floor((baseStats.hp     ?? 1) * mult));
  const attack = Math.max(1, Math.floor((baseStats.attack ?? 1) * mult));
  const speed  = Math.max(1, Math.floor((baseStats.speed  ?? 1) * mult));
  return { hp, attack, speed, mastery: m };
}

// ---------- inventario ----------
/**
 * Agrega una fruta con límite de 2 copias por nombre.
 * Devuelve true si se agregó, false si ya tenía 2.
 */
function addFruitToInventory(player, fruitName) {
  ensurePlayer({ [player.id]: player }, player.id);
  const list = player.inventory.fruits;
  const count = list.filter((f) => f === fruitName).length;
  if (count >= 2) return false;
  list.push(fruitName);
  return true;
}

function removeFruitFromInventory(player, fruitName) {
  const idx = player.inventory.fruits.indexOf(fruitName);
  if (idx >= 0) {
    player.inventory.fruits.splice(idx, 1);
    return true;
  }
  return false;
}

module.exports = {
  loadPlayers,
  savePlayers,
  ensurePlayer,
  getItemMastery,
  setItemMastery,
  getEffectiveStats,
  addFruitToInventory,
  removeFruitFromInventory,
};
