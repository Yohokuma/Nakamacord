// commands/whoami.js
module.exports = {
  name: "whoami",
  description: "Show your user id as the bot sees it",
  async execute(message) {
    return message.reply(`🪪 Your ID: \`${message.author.id}\` • Username: **${message.author.tag}**`);
  },
};
