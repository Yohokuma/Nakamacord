// loot/tables.js
/**
 * Tablas de drop por boss. Las probabilidades son en % (suman <=100).
 * Si no cae nada en la tirada de dropTable, el jugador igual recibe la recompensa fija de la misión (belly/exp).
 */

const tables = {
  morgan: [
    // chance: 8% para el hacha (ejemplo)
    { id: "weapon:morgan_axe", name: "Morgan's Axe", type: "weapon", chance: 8 },
    // chance: 15% para un emblema cosmético
    { id: "cosmetic:morgan_emblem", name: "Morgan’s Emblem", type: "cosmetic", chance: 15 },
    // chance: 25% para materiales
    { id: "mat:iron_shard", name: "Iron Shard", type: "material", chance: 25 },
    // el resto: nada (sólo recompensa fija de la misión)
  ],

  // Ejemplo para otro boss:
  // marine_captain: [
  //   { id: "weapon:marine_sabre", name: "Marine Sabre", type: "weapon", chance: 10 },
  //   { id: "cosmetic:marine_coat", name: "Marine Coat", type: "cosmetic", chance: 5 },
  // ],
};

/**
 * Realiza una tirada en una drop table y devuelve el objeto drop o null.
 */
function rollDrop(tableName) {
  const t = tables[tableName];
  if (!Array.isArray(t) || t.length === 0) return null;

  const r = Math.random() * 100;
  let acc = 0;
  for (const entry of t) {
    acc += entry.chance || 0;
    if (r <= acc) return { ...entry };
  }
  return null; // no cayó nada
}

module.exports = {
  tables,
  rollDrop,
};
