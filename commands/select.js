// commands/select.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");
const {
  loadTrades,
  getOpenTradeForUser,
  addFruitOffer,
  removeFruitOffer,
  touchTrade,
  setTradeStatus,
} = require("../db/trades");
const { resolveItemByInput } = require("../db/itemsHelper");

const EXPIRY_MS = 3 * 60 * 1000;

function countIn(arr = [], name) {
  const n = name.toLowerCase();
  return arr.reduce((a, b) => (String(b).toLowerCase() === n ? a + 1 : a), 0);
}
function fmtOfferList(arr = []) {
  if (!arr.length) return "—";
  const map = {};
  for (const n of arr) map[n] = (map[n] || 0) + 1;
  return Object.entries(map).map(([n, c]) => `${n} x${c}`).join(", ");
}

module.exports = {
  name: "select",
  description: "Add/remove fruits to your trade offer. Usage: n!select add <fruit> | n!select remove <fruit>",
  async execute(message, args) {
    if (!message.guild) return message.reply("❌ Use this in a server.");
    if (args.length < 2) {
      return message.reply("⚠️ Usage: `n!select add <fruit>` or `n!select remove <fruit>`");
    }

    const me = message.author;
    const action = args.shift().toLowerCase();
    const input = args.join(" ");

    const ref = getOpenTradeForUser(me.id, message.channel.id);
    if (!ref) return message.reply("❌ You have no open trade in this channel. Use `n!trade @user`.");

    const { id, trade } = ref;

    // Expire if inactive
    if (Date.now() - trade.lastActivity > EXPIRY_MS) {
      setTradeStatus(id, "expired");
      return message.reply("⌛ Trade expired due to 3 minutes of inactivity.");
    }

    // Resolve by alias or name (fruits only)
    const item = resolveItemByInput(input, "fruit");
    if (!item) return message.reply("❌ That fruit doesn’t exist.");
    const fruitName = item.name;

    // My inventory
    const players = loadPlayers();
    const p = ensurePlayer(players, me.id);
    p.inventory = p.inventory || {};
    p.inventory.fruits = Array.isArray(p.inventory.fruits) ? p.inventory.fruits : [];
    const bag = p.inventory.fruits;

    const myOffer = trade.offers[me.id]?.fruits || [];
    const otherId = trade.users.find((u) => u !== me.id);

    if (action === "add") {
      // cannot offer more copies than you hold
      const have = countIn(bag, fruitName);
      const already = countIn(myOffer, fruitName);
      if (have - already <= 0) {
        return message.reply(`❌ You don't have another **${fruitName}** to offer.`);
      }

      addFruitOffer(id, me.id, fruitName);
      touchTrade(id);

      const fresh = loadTrades()[id];
      const e = new EmbedBuilder()
        .setTitle("🧺 Offer Updated")
        .setDescription(
          `**You added:** ${fruitName}\n\n` +
          `**Your offer:** ${fmtOfferList(fresh.offers[me.id]?.fruits)}\n` +
          `**Their offer:** ${fmtOfferList(fresh.offers[otherId]?.fruits)}\n\n` +
          "Both must `n!tradeaccept` to complete."
        )
        .setColor(0xf1c40f);
      return message.channel.send({ embeds: [e] });
    }

    if (action === "remove") {
      const ok = removeFruitOffer(id, me.id, fruitName);
      if (!ok) return message.reply(`❌ You don't have **${fruitName}** in your offer.`);

      touchTrade(id);

      const fresh = loadTrades()[id];
      const e = new EmbedBuilder()
        .setTitle("🧺 Offer Updated")
        .setDescription(
          `**You removed:** ${fruitName}\n\n` +
          `**Your offer:** ${fmtOfferList(fresh.offers[me.id]?.fruits)}\n` +
          `**Their offer:** ${fmtOfferList(fresh.offers[otherId]?.fruits)}\n\n` +
          "Both must `n!tradeaccept` to complete."
        )
        .setColor(0xe67e22);
      return message.channel.send({ embeds: [e] });
    }

    return message.reply("⚠️ Action must be `add` or `remove`.");
  },
};
