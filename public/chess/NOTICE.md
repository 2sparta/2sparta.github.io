# Chess opening names
The opening database is derived from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
The pinned commit, source checksums and generated-data checksum are in openings-manifest.json. Rebuild with `node scripts/build-chess-openings.mjs`.
The short Ukrainian/English teaching notes and board-piece drawings were created for this application. The opening names and move sequences are a reference catalogue, not a database of master-game statistics.
The local teaching engine is a bounded alpha-beta search. Its approximate evaluations are not Stockfish evaluations or measured Elo ratings.
Game rules and PGN parsing use [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause. Its license is distributed by the npm dependency and reproduced in CHESS-JS-LICENSE.txt.
