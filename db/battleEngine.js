// db/battleEngine.js
function getAvailableSkills(state, item, mastery, player = null) {
  let skills = [];

  if (!state.formActive) {
    // Skills base y transformaciones (si no hay forma activa)
    skills = (item.skills || []).filter(
      s => !s.form && (s.unlockAt ?? 1) <= mastery
    );
  } else {
    // Solo los skills de la forma activa
    skills = (item.skills || []).filter(
      s => s.form === state.formActive && (s.unlockAt ?? 1) <= mastery
    );
  }

  // --- Haki buttons ---
  if (player?.haki?.buso) {
    skills.push({
      name: "Buso Haki",
      type: "haki",
      haki: "buso",
      description: "Armament Haki: +5% damage, allows hitting Logias.",
    });
  }
  if (player?.haki?.ken && (state.kenUses || 0) < 3) {
    skills.push({
      name: "Ken Haki",
      type: "haki",
      haki: "ken",
      description: "Observation Haki: 80% dodge chance. 3 uses max.",
    });
  }
  if (player?.haki?.hao && !state.haoUsed) {
    skills.push({
      name: "Hao Haki",
      type: "haki",
      haki: "hao",
      description: "Conqueror’s Haki: stun enemy once per battle.",
    });
  }

  return skills;
}

function performTurn(state, item, chosen, enemy, mastery, player = null) {
  let logs = [];
  let gif = null;
  let damage = 0;

  // --- Transformaciones ---
  if (chosen.type === "transform") {
    if (state.formActive) {
      logs.push("⚠️ Transformation already active!");
      return { logs, gif, damage };
    }
    if (state.formCooldown > 0) {
      logs.push(`⌛ Transformation on cooldown (${state.formCooldown} turns left).`);
      return { logs, gif, damage };
    }

    // ⚡ Asignar la forma: usamos chosen.form o un fallback
    state.formActive = chosen.form || chosen.name.toLowerCase().replace(/\s+/g, "");
    state.formTurns = chosen.duration || 5;
    state.formCooldown = chosen.cooldown || 3;

    logs.push(`⚡ ${chosen.name} activated! (${state.formTurns} turns)`);
    if (chosen.gif) gif = chosen.gif;

    return { logs, gif, damage };
  }

  // --- Hakis ---
  if (chosen.type === "haki") {
    switch (chosen.haki) {
      case "buso":
        state.busoActive = true;
        logs.push("🛡️ You clad yourself in Armament Haki! (+5% damage).");
        break;
      case "ken":
        state.kenUses = (state.kenUses || 0) + 1;
        logs.push("👁️ Observation Haki active! You may dodge the next attack.");
        break;
      case "hao":
        state.haoUsed = true;
        logs.push("⚡ You unleashed Conqueror’s Haki! The enemy is stunned!");
        state.enemyStunned = 1;
        break;
    }
    return { logs, gif, damage };
  }

  // --- Ataques normales ---
  damage = Math.floor(state.attack * (chosen.multiplier ?? 1));
  if (chosen.hits) {
    damage = 0;
    for (let i = 0; i < chosen.hits; i++) {
      damage += Math.floor(state.attack * (chosen.multiplier ?? 1));
    }
  }

  // Bonus por buso
  if (state.busoActive) {
    damage = Math.floor(damage * 1.05);
  }

  enemy.hp = Math.max(0, enemy.hp - damage);

  logs.push(`💥 ${chosen.name} dealt **${damage}** damage!`);
  if (chosen.gif) gif = chosen.gif;

  return { logs, gif, damage };
}

function handleTurnProgress(state) {
  let logs = [];

  // Manejo de transformaciones
  if (state.formActive) {
    state.formTurns--;
    if (state.formTurns <= 0) {
      logs.push(`💨 ${state.formActive} ended. Cooldown starts.`);
      state.formActive = null;
    }
  } else if (state.formCooldown > 0) {
    state.formCooldown--;
    if (state.formCooldown === 0) logs.push("✅ Transformation ready again!");
  }

  // Manejo de stun por Hao
  if (state.enemyStunned) {
    state.enemyStunned--;
    logs.push("⚡ Enemy skipped turn (stunned)!");
  }

  return logs.length ? logs.join("\n") : null;
}

module.exports = {
  getAvailableSkills,
  performTurn,
  handleTurnProgress,
};
