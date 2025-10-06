// db/fruitRegistry.js
// Global registry of fruits and their meta (rarity, alias, gif). Add more here.

const FRUITS = [
  // Common (resto del porcentaje)
  { name: "Bara Bara no Mi", rarity: "Common",  aliases: ["bara","barabara","bara bara no mi"], isLogia: false,
    gif: "https://i.makeagif.com/media/9-13-2015/2oVyV8.gif" },

  // Rare (30% del pool rare total, se reparte entre las rare que tengas)
  { name: "Gomu Gomu no Mi", rarity: "Rare",    aliases: ["gomu","gomu gomu","gomu gomu no mi"], isLogia: false,
    gif: "https://media.discordapp.net/attachments/1423102773951594537/1423159315233112146/1759377993320.png" },
  { name: "Moku Moku no Mi", rarity: "Rare",    aliases: ["moku","moku moku","smoke","smoker","moku moku no mi"], isLogia: true,
    gif: "https://media.discordapp.net/attachments/1423103647119384576/smoker-smoke.gif" },

  // Legendary (3% total)
  { name: "Hie Hie no Mi",  rarity: "Legendary", aliases: ["hie","hie hie","aokiji","hie hie no mi"], isLogia: true,
    gif: "https://media.discordapp.net/attachments/1422731616320753674/1422733366482046976/ice-age.gif" },

  // Mythical (0.5% total)
  { name: "Tori Tori no Mi: Model Phoenix", rarity: "Mythical", aliases: ["tori","phoenix","fenix","tori tori"], isLogia: false,
    gif: "https://media.discordapp.net/attachments/1422731616320753674/1422756417982566410/tumblr_mgbrs6O3OC1r2sqylo1_500.gif" },
];

// Rarity weights (global): Mythical 0.5%, Legendary 3%, Rare 30%, Common resto (66.5%)
const RARITY_WEIGHTS = {
  Mythical: 0.005,
  Legendary: 0.03,
  Rare: 0.30,
  Common: 0.665,
};

// Returns a fruit meta by rarity lottery weighted globally.
function pickRandomFruitMeta() {
  const r = Math.random();
  let acc = 0;
  let pickedRarity = "Common";
  for (const [rarity, w] of Object.entries(RARITY_WEIGHTS)) {
    acc += w;
    if (r < acc) { pickedRarity = rarity; break; }
  }
  const pool = FRUITS.filter(f => f.rarity === pickedRarity);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getFruitMetaByName(name) {
  return FRUITS.find(f => f.name.toLowerCase() === String(name).toLowerCase()) || null;
}

function listAllFruitNames() {
  return FRUITS.map(f => f.name);
}

module.exports = {
  FRUITS,
  pickRandomFruitMeta,
  getFruitMetaByName,
  listAllFruitNames,
};
