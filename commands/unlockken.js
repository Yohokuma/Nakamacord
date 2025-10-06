const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");

module.exports = {
  name: "unlockken",
  description: "Unlock Kenbunshoku Haki (Observation) for testing.",
  async execute(message) {
    const players = loadPlayers();
    const player = ensurePlayer(players, message.author.id);

    player.hakis = player.hakis || {};

    // 🔥 No borramos lo anterior, solo agregamos/actualizamos Ken
    player.hakis = {
      ...player.hakis,
      ken: 3, // con 3 usos
    };

    savePlayers(players);

    return message.reply("👁️ You have unlocked **Kenbunshoku Haki (Observation)** (3 uses per battle)!");
  },
};
