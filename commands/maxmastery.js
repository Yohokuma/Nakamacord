// commands/maxmastery.js
const { loadPlayers, savePlayers } = require("../db/players");

module.exports = {
  name: "maxmastery",
  description: "Max out mastery of your equipped fruit/weapon (for testing).",
  execute(message) {
    const players = loadPlayers();
    const player = players[message.author.id];

    if (!player) {
      return message.reply("❌ You must start first with `n!start`.");
    }

    const equippedFruit = player.equipped?.fruit;
    const equippedWeapon = player.equipped?.weapon;

    if (!equippedFruit && !equippedWeapon) {
      return message.reply("❌ You have no equipped fruit/weapon.");
    }

    if (player.activeSlot === "fruit" && equippedFruit) {
      player.masteries.fruits[equippedFruit] = 100;
      savePlayers(players);
      return message.reply(`🔥 Mastery for ${equippedFruit} has been maxed!`);
    }

    if (player.activeSlot === "weapon" && equippedWeapon) {
      player.masteries.weapons[equippedWeapon] = 100;
      savePlayers(players);
      return message.reply(`🔥 Mastery for ${equippedWeapon} has been maxed!`);
    }
  },
};
