// commands/whereplayers.js
const { getPlayersPath } = require("../db/players");
module.exports = {
  name: "whereplayers",
  description: "Show absolute path of players.json used by the bot",
  async execute(message) {
    return message.reply("📁 players.json path:\n```\n" + getPlayersPath() + "\n```");
  },
};
