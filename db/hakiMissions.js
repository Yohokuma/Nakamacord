// db/hakiMissions.js
// In-memory lobby store (simple y suficiente para esta misión co-op)
const lobbies = new Map(); // channelId -> lobby

function now() { return Date.now(); }

function createLobby(channelId, leaderId) {
  const lobby = {
    channelId,
    leaderId,
    status: "open",   // open | started | done | cancelled
    users: [leaderId],
    createdAt: now(),
    lastActivity: now(),
  };
  lobbies.set(channelId, lobby);
  return lobby;
}

function getLobby(channelId) {
  return lobbies.get(channelId) || null;
}

function touchLobby(channelId) {
  const l = lobbies.get(channelId);
  if (l) l.lastActivity = now();
}

function setLobbyStatus(channelId, status) {
  const l = lobbies.get(channelId);
  if (l) { l.status = status; l.lastActivity = now(); }
  return l;
}

function addUser(channelId, userId) {
  const l = lobbies.get(channelId);
  if (!l) return null;
  if (!l.users.includes(userId)) l.users.push(userId);
  l.lastActivity = now();
  return l;
}

function removeUser(channelId, userId) {
  const l = lobbies.get(channelId);
  if (!l) return null;
  l.users = l.users.filter(u => u !== userId);
  l.lastActivity = now();
  if (l.users.length === 0) {
    lobbies.delete(channelId);
    return null;
  }
  return l;
}

function deleteLobby(channelId) {
  lobbies.delete(channelId);
}

module.exports = {
  createLobby,
  getLobby,
  addUser,
  removeUser,
  setLobbyStatus,
  deleteLobby,
  touchLobby,
};
