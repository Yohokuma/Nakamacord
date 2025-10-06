const { loadPlayers, savePlayers, ensurePlayer, addWeaponToInventory } = require("../db/players");
const { normalizeItemName, findItem } = require("../db/itemsHelper");

module.exports = {
  name: "giveweapon",
  description: "Add a weapon to a player's inventory. Usage: n!giveweapon <weapon name> [@user]",
  async execute(message, args) {
    if (!args.length) {
      return message.reply("⚠️ Usage: `n!giveweapon <weapon name> [@user]`");
    }

    // Check for mention, default to author
    const targetUser = message.mentions.users.first() || message.author;

    // Remove mentions from args
    const mentionRegex = /^<@!?(\d+)>$/;
    const itemParts = args.filter((t) => !mentionRegex.test(t));
    if (!itemParts.length) {
      return message.reply("❌ No weapon name provided.");
    }

    const input = itemParts.join(" ");
    const itemName = normalizeItemName(input);
    if (!itemName) {
      return message.reply("❌ That weapon doesn’t exist.");
    }

    const item = findItem(input);
    if (!item || item.type !== "weapon") {
      return message.reply("❌ You can only give **weapons** with this command.");
    }

    const players = loadPlayers();
    const player = ensurePlayer(players, targetUser.id);

    addWeaponToInventory(player, itemName);
    savePlayers(players);

    // Confirmation message
    const invList = player.inventory.weapons.length
      ? player.inventory.weapons.join(", ")
      : "—";

    if (targetUser.id !== message.author.id) {
      return message.reply(
        `⚔️ **${itemName}** was added to **${targetUser.username}**'s inventory.\n` +
        `🧺 Now they have: ${invList}`
      );
    }
    return message.reply(
      `⚔️ **${itemName}** was added to your inventory.\n` +
      `🧺 Your weapons: ${invList}`
    );
  },
};
