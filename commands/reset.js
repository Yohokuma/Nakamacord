// commands/reset.js
const { loadPlayers, savePlayers } = require("../db/players");

module.exports = {
  name: "reset",
  description: "Reset your player progress (for testing).",
  async execute(message) {
    const players = loadPlayers();

    if (!players[message.author.id]) {
      return message.reply("❌ You don’t have any saved progress yet.");
    }

    // eliminar al jugador de la base
    delete players[message.author.id];
    savePlayers(players);

    return message.reply("🗑️ Your progress has been **reset**. You can start fresh with `n!start`.");
  },
};
