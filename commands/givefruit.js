// commands/givefruit.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers, savePlayers, ensurePlayer, addFruitToInventory } = require("../db/players");
const { resolveItemByInput } = require("../db/itemsHelper");

module.exports = {
  name: "givefruit",
  description: "Add a fruit to a player's inventory. Usage: n!givefruit <fruit name> [@user]",
  async execute(message, args) {
    if (!args.length) {
      return message.reply("⚠️ Usage: `n!givefruit <fruit name> [@user]`");
    }

    const mention = message.mentions.users.first();
    const target = mention ?? message.author;

    // quitar la mención de los args
    const mentionRegex = /^<@!?(\d+)>$/;
    const parts = args.filter((t) => !mentionRegex.test(t));
    if (!parts.length) {
      return message.reply("❌ No fruit name provided.");
    }

    // Resolver ítem por nombre o alias (si no es fruit ⇒ error)
    const input = parts.join(" ");
    const item = resolveItemByInput(input, "fruit");
    if (!item) {
      return message.reply("❌ That fruit doesn’t exist.");
    }

    const players = loadPlayers();
    const p = ensurePlayer(players, target.id);

    // Guardar SIEMPRE el nombre canónico
    const ok = addFruitToInventory(p, item.name);
    savePlayers(players);

    const invCount = p.inventory.fruits.reduce((m, f) => {
      m[f] = (m[f] || 0) + 1;
      return m;
    }, {});
    const invText = Object.entries(invCount)
      .map(([n, c]) => `${n} x${c}`)
      .join(", ") || "—";

    const embed = new EmbedBuilder()
      .setTitle("🍏 Fruit granted")
      .setDescription(
        `**${item.name}** *(Rarity: ${item.rarity})* has been added to **${target.username}**'s inventory.\n\n` +
        `**Inventory (fruits):** ${invText}`
      )
      .setColor(ok ? 0x00cc66 : 0xff9900);

    if (!ok) {
      embed.setFooter({ text: "This player already has 2 copies of that fruit (max 2)." });
    }

    return message.channel.send({ embeds: [embed] });
  },
};
