// commands/choose.js
const { loadPlayers, savePlayers, ensurePlayer, addFruitToInventory } = require("../db/players");
const starters = require("../db/starters");

// normaliza palabra corta a nombre oficial
function resolveChoice(arg) {
  if (!arg) return null;
  const key = arg.toLowerCase();
  if (key.startsWith("bara")) return { kind: "fruit", name: "Bara Bara no Mi" };
  if (key.startsWith("ginga")) return { kind: "weapon", name: "Ginga Pachinko" };
  return null;
}

module.exports = {
  name: "choose",
  description: "Choose your starter (bara / ginga). Usage: n!choose bara",
  async execute(message, args) {
    const choice = resolveChoice(args[0]);
    if (!choice) {
      return message.reply("⚠️ Usage: `n!choose bara` o `n!choose ginga`");
    }

    const players = loadPlayers();
    const p = ensurePlayer(players, message.author.id);

    if (p.starter) {
      return message.reply("❌ You already chose a starter. Use your inventory/eat flow to change later.");
    }

    // obtener stats base desde starters
    let base;
    if (choice.kind === "fruit") {
      base = starters.fruits[choice.name];
      if (!base) return message.reply("❌ Starter config not found (fruit).");
      // equipa y setea starter
      p.equipped.fruit = choice.name;
      p.starter = { name: choice.name, type: "fruit", stats: { ...base.stats } };
      // opcional: añade también al inventario, por si quieres tenerla registrada
      addFruitToInventory(p, choice.name);
    } else {
      base = starters.weapons[choice.name];
      if (!base) return message.reply("❌ Starter config not found (weapon).");
      p.equipped.weapon = choice.name;
      p.starter = { name: choice.name, type: "weapon", stats: { ...base.stats } };
      // si luego haces inventario de armas, aquí podrías añadir al inventario de armas
      // p.inventory.weapons.push(choice.name) evitando duplicados
    }

    savePlayers(players);

    return message.reply(`✅ Starter chosen: **${choice.name}**. Good luck, nakama!`);
  },
};
