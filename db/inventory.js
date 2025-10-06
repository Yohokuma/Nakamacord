// db/inventory.js
function ensureInv(p) {
  if (!p.inventory) p.inventory = { fruits: [], weapons: [] };
  if (!Array.isArray(p.inventory.fruits)) p.inventory.fruits = [];
  if (!Array.isArray(p.inventory.weapons)) p.inventory.weapons = [];
  return p.inventory;
}

// -------- FRUITS ----------
function countFruit(p, name) {
  const inv = ensureInv(p);
  return inv.fruits.reduce((acc, f) => acc + (f === name ? 1 : 0), 0);
}

function addFruit(p, name, cap = 2) {
  const inv = ensureInv(p);
  if (countFruit(p, name) >= cap) return false; // cap reached
  inv.fruits.push(name);
  return true;
}

function removeOneFruit(p, name) {
  const inv = ensureInv(p);
  const idx = inv.fruits.indexOf(name);
  if (idx === -1) return false;
  inv.fruits.splice(idx, 1); // remove only ONE
  return true;
}

function hasFruit(p, name) {
  return countFruit(p, name) > 0;
}

// -------- WEAPONS (opcional, misma idea) ----------
function addWeapon(p, name, cap = 99) {
  const inv = ensureInv(p);
  if (inv.weapons.length >= cap) return false;
  inv.weapons.push(name);
  return true;
}

function removeOneWeapon(p, name) {
  const inv = ensureInv(p);
  const idx = inv.weapons.indexOf(name);
  if (idx === -1) return false;
  inv.weapons.splice(idx, 1);
  return true;
}

module.exports = {
  ensureInv,
  countFruit,
  addFruit,
  removeOneFruit,
  hasFruit,
  addWeapon,
  removeOneWeapon,
};
