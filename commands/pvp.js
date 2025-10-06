// commands/pvp.js
const { EmbedBuilder } = require("discord.js");
const { loadPlayers } = require("../db/players");
const { loadPvP, savePvP, findPendingFor } = require("../db/pvp");

// Helpers
const cleanId = (s) => {
  if (!s) return null;
  const m = s.match(/^<@!?(\d{17,20})>$/) || s.match(/^(\d{17,20})$/);
  return m ? m[1] : null;
};
const hasEquipped = (p) =>
  (p.activeSlot === "fruit" && p.equipped?.fruit) ||
  (p.activeSlot === "weapon" && p.equipped?.weapon);
const makeLocalId = (a, b, channelId) =>
  `pending:${a}:${b}:${channelId}:${Date.now()}`;

function pushPending(store, payload) {
  if (!store || typeof store !== "object") store = {};
  if (!Array.isArray(store.pending)) store.pending = [];

  const exists = store.pending.some(
    (c) =>
      c.status === "pending" &&
      c.challenger === payload.challenger &&
      c.opponent === payload.opponent &&
      c.channelId === payload.channelId
  );
  if (!exists) store.pending.push({ ...payload, status: "pending", createdAt: Date.now() });
  return store;
}

module.exports = {
  name: "pvp",
  description: "Challenge another player to a PvP battle.",
  async execute(message, args = []) {
    const mentioned = message.mentions.users.first();
    const targetId = mentioned?.id || cleanId(args[0]);
    if (!targetId) return message.reply("❌ Usage: `n!pvp @user`");
    if (targetId === message.author.id) return message.reply("❌ You can’t challenge yourself.");

    const players = loadPlayers();
    const A = players[message.author.id];
    const B = players[targetId];
    if (!A || !B) return message.reply("❌ Both players must `n!start` first.");
    if (!hasEquipped(A) || !hasEquipped(B))
      return message.reply("❌ Both players must have something equipped with `n!equip`.");

    let store = loadPvP();

    // ¿El oponente ya tiene pending aquí?
    const oppPending = typeof findPendingFor === "function"
      ? findPendingFor(store, targetId, message.channel.id)
      : (Array.isArray(store?.pending)
          ? store.pending.find(
              (c) =>
                c.status === "pending" &&
                c.opponent === targetId &&
                c.channelId === message.channel.id
            )
          : null);
    if (oppPending) {
      return message.reply(`⚠️ <@${targetId}> already has a pending challenge in this channel.`);
    }

    // ¿Yo ya tengo pending en este canal?
    const iHavePendingHere = Array.isArray(store?.pending)
      ? store.pending.some(
          (c) =>
            c.status === "pending" &&
            c.channelId === message.channel.id &&
            (c.challenger === message.author.id || c.opponent === message.author.id)
        )
      : false;
    if (iHavePendingHere) {
      return message.reply("⚠️ You already have a pending challenge in this channel.");
    }

    const id = makeLocalId(message.author.id, targetId, message.channel.id);
    const payload = {
      id,
      challenger: message.author.id,
      opponent: targetId,
      channelId: message.channel.id,
      guildId: message.guild?.id || null,
    };

    store = pushPending(store, payload);
    savePvP(store);

    const embed = new EmbedBuilder()
      .setTitle("⚔️ PvP Challenge")
      .setColor(0xffa500)
      .setDescription(
        [
          `**Challenger:** <@${message.author.id}>`,
          `**Opponent:** <@${targetId}>`,
          "",
          "Type **`n!accept`** to fight or **`n!decline`** to refuse.",
          "_Rules:_",
          "• Transforming consumes your action.",
          "• Ken: 1 use → 3 guaranteed dodges.",
          "• Buso: +5% dmg & hits **Logias**.",
          "• Hao: creates a **clash window** for rival on next turn.",
        ].join("\n")
      );

    await message.channel.send({ embeds: [embed] });
  },
};
