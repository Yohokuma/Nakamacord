// commands/tradeaccept.js
const { EmbedBuilder } = require("discord.js");
const {
  loadTrades,
  saveTrades,
  getOpenTradeForUser,
  setAccepted,
  setTradeStatus,
} = require("../db/trades");
const { loadPlayers, savePlayers, ensurePlayer } = require("../db/players");

const EXPIRY_MS = 3 * 60 * 1000;

function countIn(arr = [], name) {
  const n = name.toLowerCase();
  return arr.reduce((a, b) => (String(b).toLowerCase() === n ? a + 1 : a), 0);
}

function transfer(bagFrom, bagTo, name, count) {
  let moved = 0;
  for (let i = bagFrom.length - 1; i >= 0 && moved < count; i--) {
    if (String(bagFrom[i]).toLowerCase() === name.toLowerCase()) {
      bagFrom.splice(i, 1);
      bagTo.push(name);
      moved++;
    }
  }
  return moved === count;
}

module.exports = {
  name: "tradeaccept",
  aliases: ["accepttrade"],
  description: "Accept your side of the current trade. Both must accept to complete.",
  async execute(message) {
    if (!message.guild) return message.reply("❌ Use this in a server.");

    const me = message.author;
    const ref = getOpenTradeForUser(me.id, message.channel.id);
    if (!ref) return message.reply("❌ No pending trade found for you in this channel.");

    const { id, trade } = ref;

    // Expire if needed
    if (Date.now() - trade.lastActivity > EXPIRY_MS) {
      setTradeStatus(id, "expired");
      return message.reply("⌛ Trade expired due to 3 minutes of inactivity.");
    }

    // Mark me as accepted
    const t = setAccepted(id, me.id, true);
    const otherId = t.users.find((u) => u !== me.id);

    // If other not yet accepted, just confirm mine
    if (!t.accepted[otherId]) {
      return message.reply("✅ You accepted. Waiting for the other user to accept.");
    }

    // Both accepted -> FINAL VALIDATION & TRANSFER
    // Load players and verify inventory still holds offered copies
    const players = loadPlayers();
    const A = ensurePlayer(players, t.users[0]);
    const B = ensurePlayer(players, t.users[1]);

    A.inventory = A.inventory || {};
    B.inventory = B.inventory || {};
    A.inventory.fruits = Array.isArray(A.inventory.fruits) ? A.inventory.fruits : [];
    B.inventory.fruits = Array.isArray(B.inventory.fruits) ? B.inventory.fruits : [];

    const offerA = t.offers[A.id]?.fruits || [];
    const offerB = t.offers[B.id]?.fruits || [];

    // count needed per fruit
    const needA = {};
    for (const n of offerA) needA[n] = (needA[n] || 0) + 1;
    const needB = {};
    for (const n of offerB) needB[n] = (needB[n] || 0) + 1;

    // Validate A has all his offered copies
    for (const [fruit, cnt] of Object.entries(needA)) {
      if (countIn(A.inventory.fruits, fruit) < cnt) {
        setTradeStatus(id, "cancelled");
        return message.reply(`❌ Trade cancelled: <@${A.id}> no longer has **${fruit} x${cnt}**.`);
      }
    }
    // Validate B has all his offered copies
    for (const [fruit, cnt] of Object.entries(needB)) {
      if (countIn(B.inventory.fruits, fruit) < cnt) {
        setTradeStatus(id, "cancelled");
        return message.reply(`❌ Trade cancelled: <@${B.id}> no longer has **${fruit} x${cnt}**.`);
      }
    }

    // Perform transfer
    for (const [fruit, cnt] of Object.entries(needA)) {
      if (!transfer(A.inventory.fruits, B.inventory.fruits, fruit, cnt)) {
        setTradeStatus(id, "cancelled");
        return message.reply("❌ Trade failed during transfer (A).");
      }
    }
    for (const [fruit, cnt] of Object.entries(needB)) {
      if (!transfer(B.inventory.fruits, A.inventory.fruits, fruit, cnt)) {
        setTradeStatus(id, "cancelled");
        return message.reply("❌ Trade failed during transfer (B).");
      }
    }

    savePlayers(players);

    // Close trade
    setTradeStatus(id, "completed");

    const e = new EmbedBuilder()
      .setTitle("✅ Trade Completed")
      .setDescription(
        `**Users:** <@${A.id}> ↔ <@${B.id}>\n\n` +
        `**Received by <@${B.id}>:** ${offerA.length ? offerA.join(", ") : "—"}\n` +
        `**Received by <@${A.id}>:** ${offerB.length ? offerB.join(", ") : "—"}`
      )
      .setColor(0x2ecc71);
    return message.channel.send({ embeds: [e] });
  },
};
