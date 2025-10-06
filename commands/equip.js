const { loadPlayers, savePlayers } = require("../db/players");
const { normalizeItemName, findItem } = require("../db/itemsHelper");

module.exports = {
  name: "equip",
  description: "Equip a fruit or weapon for combat.",
  async execute(message, args) {
    const players = loadPlayers();
    const player = players[message.author.id];
    if (!player) return message.reply("❌ You must start first with `n!start`.");

    if (!args.length) {
      return message.reply(
        "⚠️ Usage: `n!equip <fruit|weapon> <name>`\n" +
        "Example: `n!equip fruit bara` or `n!equip weapon ginga`."
      );
    }

    const input = args.join(" ");
    const itemName = normalizeItemName(input);
    if (!itemName) {
      return message.reply("❌ That item doesn’t exist.");
    }

    const item = findItem(input);
    if (!item) {
      return message.reply("❌ Could not find that item.");
    }

    // Check if the player owns it
    const ownsFruit = player.inventory?.fruits?.some(f => f.toLowerCase() === itemName.toLowerCase());
    const ownsWeapon = player.inventory?.weapons?.some(w => w.toLowerCase() === itemName.toLowerCase());

    if (item.type === "fruit") {
      if (!ownsFruit && player.equipped?.fruit !== itemName) {
        return message.reply(`❌ You don't own **${itemName}**.`);
      }
      player.equipped.fruit = itemName;
      player.activeSlot = "fruit";
      savePlayers(players);
      return message.reply(`🍎 Equipped **${itemName}** for combat.`);
    }

    if (item.type === "weapon") {
      if (!ownsWeapon && player.equipped?.weapon !== itemName) {
        return message.reply(`❌ You don't own **${itemName}**.`);
      }
      player.equipped.weapon = itemName;
      player.activeSlot = "weapon";
      savePlayers(players);
      return message.reply(`⚔️ Equipped **${itemName}** for combat.`);
    }

    return message.reply("❌ Invalid type. Only fruits or weapons can be equipped.");
  },
};

