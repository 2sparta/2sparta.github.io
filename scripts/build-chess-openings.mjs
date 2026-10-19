import fs from "node:fs/promises";
import crypto from "node:crypto";
import { Chess } from "chess.js";
const manifest = JSON.parse(
  await fs.readFile(new URL("../public/chess/openings-manifest.json", import.meta.url), "utf8"),
);
const rows = [];
for (const item of manifest.files) {
  const response = await fetch(
    `https://raw.githubusercontent.com/lichess-org/chess-openings/${manifest.commit}/${item.file}`,
  );
  if (!response.ok) throw new Error("Opening download failed");
  const text = await response.text();
  if (crypto.createHash("sha256").update(text).digest("hex") !== item.sha256)
    throw new Error("Opening source changed");
  const [header, ...lines] = text.trim().split("\n");
  const columns = header.split("\t");
  for (const line of lines) {
    const cells = line.split("\t");
    const row = Object.fromEntries(columns.map((k, i) => [k, cells[i]]));
    const game = new Chess();
    game.loadPgn(row.pgn);
    rows.push({
      eco: row.eco,
      name: row.name,
      pgn: row.pgn,
      uci: game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? "")),
      fen: game.fen(),
    });
  }
}
const text = JSON.stringify(rows) + "\n";
await fs.writeFile(new URL("../public/chess/openings.json", import.meta.url), text);
manifest.count = rows.length;
manifest.dataSha256 = crypto.createHash("sha256").update(text).digest("hex");
await fs.writeFile(
  new URL("../public/chess/openings-manifest.json", import.meta.url),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(rows.length + " openings");
