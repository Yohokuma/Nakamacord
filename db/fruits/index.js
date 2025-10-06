// db/fruits/index.js
const fs = require("fs");
const path = require("path");

function getAllFruitDefs() {
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "index.js");
  const out = [];
  for (const f of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(path.join(dir, f));
    if (mod && mod.name) out.push(mod);
  }
  return out;
}

module.exports = { getAllFruitDefs };
