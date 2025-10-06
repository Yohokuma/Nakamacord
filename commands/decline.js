// commands/decline.js
const { EmbedBuilder } = require("discord.js");
const { loadPvP, savePvP, findPendingFor, removePair } = require("../db/pvp");

/**
 * Busca un pendiente donde el autor sea el retador (por si quiere cancelar su propio reto).
 * No dependemos de helpers extra: leemos directamente el store.
 */
function findOutgoingFor(store, challengerId, channelId) {
  if (!store) return null;
  const list = Array.isArray(store.pending) ? store.pending : [];
  return list.find(p =>
    p &&
    p.challenger === challengerId &&
    (!channelId || p.channelId === channelId)
  ) || null;
}

module.exports = {
  name: "decline",
  description: "Decline or cancel a pending PvP challenge in this channel.",
  async execute(message) {
    const userId    = message.author.id;
    const channelId = message.channel.id;

    const store = loadPvP();

    // 1) ¿Tienes un reto pendiente dirigido a ti? (eres oponente)
    let pending = findPendingFor(store, userId, channelId);

    // 2) Si no, ¿tienes un reto que tú enviaste? (eres retador)
    let type = "opponent";
    if (!pending) {
      pending = findOutgoingFor(store, userId, channelId);
      type = "challenger";
    }

    if (!pending) {
      return message.reply("❌ No hay ningún reto de PvP pendiente para cancelar/declinar en este canal.");
    }

    const challengerId = pending.challenger;
    const opponentId   = pending.opponent;

    // quita el par y guarda
    removePair(store, challengerId, opponentId);
    savePvP(store);

    const challengerTag = `<@${challengerId}>`;
    const opponentTag   = `<@${opponentId}>`;

    // Mensaje bonito
    const e = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle("🛑 PvP Challenge Declined")
      .setDescription(
        type === "opponent"
          ? `${opponentTag} **declined** the PvP challenge from ${challengerTag}.`
          : `${challengerTag} **cancelled** their PvP challenge to ${opponentTag}.`
      );

    await message.channel.send({ embeds: [e] });
  },
};
