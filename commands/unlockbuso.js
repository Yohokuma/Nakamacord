const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");

module.exports = {
  name: "unlockbuso",
  description: "Unlock Buso Haki (Armament) for testing.",
  async execute(message) {
    const players = loadPlayers();
    const player = ensurePlayer(players, message.author.id);

    player.hakis = player.hakis || {};

    player.hakis = {
      ...player.hakis,
      buso: true,
    };

    savePlayers(players);

    return message.reply("🖤 You have unlocked **Buso Haki (Armament)**!");
  },
};
