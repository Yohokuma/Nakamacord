// commands/trade.js
const { EmbedBuilder } = require("discord.js");
const {
  getOpenTradeForUser,
  createTrade,
  setTradeStatus,
} = require("../db/trades");

const EXPIRY_MS = 3 * 60 * 1000; // 3 minutes

function fmtOfferList(arr = []) {
  if (!arr.length) return "—";
  const map = {};
  for (const n of arr) map[n] = (map[n] || 0) + 1;
  return Object.entries(map).map(([n, c]) => `${n} x${c}`).join(", ");
}

module.exports = {
  name: "trade",
  description: "Start or view a fruit trade. Usage: n!trade @user",
  async execute(message) {
    if (!message.guild) return message.reply("❌ Use this in a server.");

    const target = message.mentions.users.first();
    const me = message.author;

    // If user already has an open trade in this channel, show it / expire if needed
    const existing = getOpenTradeForUser(me.id, message.channel.id);
    if (!target) {
      if (!existing) {
        return message.reply(
          "ℹ️ No open trade found. Use `n!trade @user` to start one.\n" +
          "Then use `n!select add <fruit>` / `n!select remove <fruit>` and `n!tradeaccept`."
        );
      }
      const { id, trade } = existing;

      // expire if inactive
      if (Date.now() - trade.lastActivity > EXPIRY_MS) {
        setTradeStatus(id, "expired");
        return message.reply("⌛ Trade expired due to 3 minutes of inactivity.");
      }

      const [a, b] = trade.users;
      const e = new EmbedBuilder()
        .setTitle("🔁 Trade (Fruits)")
        .setDescription(
          `**Users:** <@${a}> ↔ <@${b}>\n` +
          `**Status:** ${trade.status}\n\n` +
          `**Offers**\n` +
          `• <@${a}>: ${fmtOfferList(trade.offers[a]?.fruits)}\n` +
          `• <@${b}>: ${fmtOfferList(trade.offers[b]?.fruits)}\n\n` +
          `**Accept**\n` +
          `• <@${a}>: ${trade.accepted[a] ? "✅" : "❌"}\n` +
          `• <@${b}>: ${trade.accepted[b] ? "✅" : "❌"}\n\n` +
          "Use `n!select add <fruit>` / `n!select remove <fruit>`, then `n!tradeaccept`.\n" +
          "Cancel with `n!canceltrade`."
        )
        .setColor(0x3498db);
      return message.channel.send({ embeds: [e] });
    }

    // Create a brand new trade (@mention required)
    if (existing) {
      const { id, trade } = existing;
      if (Date.now() - trade.lastActivity <= EXPIRY_MS) {
        const [a, b] = trade.users;
        const e = new EmbedBuilder()
          .setTitle("🔁 Trade (Fruits)")
          .setDescription(
            `**Users:** <@${a}> ↔ <@${b}>\n` +
            `**Status:** ${trade.status}\n\n` +
            `**Offers**\n` +
            `• <@${a}>: ${fmtOfferList(trade.offers[a]?.fruits)}\n` +
            `• <@${b}>: ${fmtOfferList(trade.offers[b]?.fruits)}\n\n` +
            "Use `n!select add <fruit>` / `n!select remove <fruit>`, then `n!tradeaccept`."
          )
          .setColor(0x3498db);
        return message.channel.send({ embeds: [e] });
      } else {
        setTradeStatus(id, "expired");
      }
    }

    if (target.bot) return message.reply("❌ You can't trade with a bot.");
    if (target.id === me.id) return message.reply("❌ You can't trade with yourself.");

    const { trade } = createTrade(message.guild.id, message.channel.id, me.id, target.id);

    const e = new EmbedBuilder()
      .setTitle("🔁 Trade (Fruits) — Started")
      .setDescription(
        `**Users:** <@${me.id}> ↔ <@${target.id}>\n\n` +
        "Both players can now:\n" +
        "• `n!select add <fruit>` to add (name or alias)\n" +
        "• `n!select remove <fruit>` to remove\n" +
        "• `n!tradeaccept` (or `n!accepttrade`) to accept (both must accept)\n" +
        "• `n!canceltrade` to cancel\n\n" +
        "⏳ The trade will expire after **3 minutes** of inactivity."
      )
      .setColor(0x2ecc71);
    await message.channel.send({ embeds: [e] });
  },
};
