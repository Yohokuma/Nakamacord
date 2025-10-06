// commands/canceltrade.js
const { loadTrades, saveTrades } = require("../db/trades");

module.exports = {
  name: "canceltrade",
  description: "Cancel your current open trade session in this channel.",
  async execute(message) {
    const trades = loadTrades(); // <- SOLO UNA VEZ

    const openTradeId = Object.keys(trades).find((id) => {
      const t = trades[id];
      return (
        t.status === "open" &&
        t.channelId === message.channel.id &&
        t.users.includes(message.author.id)
      );
    });

    if (!openTradeId) {
      return message.reply("⚠️ No open trade session found for you in this channel.");
    }

    trades[openTradeId].status = "cancelled";
    saveTrades(trades);

    return message.channel.send({
      embeds: [
        {
          title: "⛔ Trade Cancelled",
          description: `The trade session has been cancelled by <@${message.author.id}>.`,
          color: 0xe74c3c,
          footer: { text: `Trade ID: ${openTradeId}` },
        },
      ],
    });
  },
};
