// bosses/morgan.js
const { makeBoss } = require("./npc");

/**
 * Crea a Captain Morgan (Shells Town).
 * Puedes pasar scale { hp: x, atk: y } para ajustar rápidamente.
 */
function makeMorgan(scale = { hp: 1, atk: 1 }) {
  const baseHp  = 3000;   // vida base (ajústalo a gusto)
  const baseAtk = 60;     // daño base (ajústalo a gusto)

  return makeBoss({
    name: "Captain Morgan",
    hpMax: Math.round(baseHp * (scale.hp || 1)),
    atk:   Math.round(baseAtk * (scale.atk || 1)),
    gif:   "https://media.discordapp.net/attachments/1422731616320753674/1424013699391160472/tumblr_mc7oiy41JC1rwgj3ko1_500.gif",
  });
}

module.exports = {
  makeMorgan,
};
