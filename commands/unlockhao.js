const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");

module.exports = {
  name: "unlockhao",
  description: "Unlock Haoshoku Haki (Conqueror’s) for testing.",
  async execute(message) {
    const players = loadPlayers();
    const player = ensurePlayer(players, message.author.id);

    player.hakis = player.hakis || {};

    player.hakis = {
      ...player.hakis,
      hao: true,
    };

    savePlayers(players);

    return message.reply("⚡ You have unlocked **Haoshoku Haki (Conqueror’s)**!");
  },
};
