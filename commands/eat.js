// commands/eat.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers, savePlayers, ensurePlayer, removeFruitFromInventory } = require("../db/players");
const { resolveItemByInput, norm } = require("../db/itemsHelper");

module.exports = {
  name: "eat",
  description: "Consume a fruit from your inventory. Usage: n!eat <fruit name>",
  async execute(message, args) {
    if (!args.length) {
      return message.reply("⚠️ Usage: `n!eat <fruit name>`");
    }

    const input = args.join(" ");

    const players = loadPlayers();
    const p = ensurePlayer(players, message.author.id);

    // Resolver la fruta por alias o nombre
    const item = resolveItemByInput(input, "fruit");
    if (!item) {
      return message.reply("❌ That fruit doesn’t exist.");
    }

    // Buscar en inventario por cualquier alias o el nombre canónico
    const possible = new Set([norm(item.name), ...(item.aliases || []).map(norm)]);
    const idx = p.inventory.fruits.findIndex((f) => possible.has(norm(f)));

    if (idx === -1) {
      return message.reply(`❌ You don't have **${item.name}** in your inventory.`);
    }

    // Consumir una (quita 1 copia)
    p.inventory.fruits.splice(idx, 1);

    // Equiparla automáticamente (si quieres)
    p.equipped.fruit = item.name;
    p.activeSlot = "fruit";

    savePlayers(players);

    const embed = new EmbedBuilder()
      .setTitle("🍽️ You ate a Devil Fruit!")
      .setDescription(`You ate **${item.name}**.\nIt is now **equipped**.`)
      .setColor(0x00aaff);

    return message.channel.send({ embeds: [embed] });
  },
};
