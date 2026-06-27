# Cascadia Simplified

A small, dependency-free, two-player browser game inspired by the board game
[Cascadia](https://boardgamegeek.com/boardgame/295947/cascadia). Each player
builds their own 5×5 habitat board by drafting habitat tiles and wildlife
tokens, then scores them with per-animal patterns and competitive habitat bonuses.

It is a single static page — plain HTML, CSS, and JavaScript with no build step.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
npx http-server .      # then open the printed URL
# or: python3 -m http.server
```

### How a turn works

The game is a local hot-seat for two players, each with their own board and score.

1. **Pick a draft pair.** The draft shows three habitat + wildlife pairs. Tap a
   pair to select it (the column highlights).
2. **Place the habitat tile.** Tap an empty cell on your board to place the
   habitat. Empty cells are only clickable once a pair is selected.
3. **Place the wildlife token.** The drafted animal can go on *any* of your
   tiles whose habitat accepts it (valid destinations are highlighted). If you
   don't want to place it — or there is no legal home — use **Skip Token** and
   it is discarded.
4. Your turn ends and play passes to the other player. **End Turn (Pass)** skips
   your turn without placing.

The game ends when both boards are full; the higher total score wins (ties are
reported). **New Game** resets everything.

### Where each animal lives

| Animal | Habitats |
| ------ | -------- |
| Bear   | forest, mountain |
| Salmon | river |
| Hawk   | mountain, prairie |
| Fox    | prairie, forest |
| Elk    | forest, prairie, wetland |

### Scoring

Wildlife (per player, on their own board):

- **Bear** — connected groups of 3+ bears score 3 points per bear in the group.
- **Salmon** — straight runs of 2+ score 2 points per salmon.
- **Elk** — straight lines of 2+ score 3 points per elk.
- **Hawk** — 5 points each when no other hawk is orthogonally adjacent.
- **Fox** — 1 point per distinct *other* species orthogonally adjacent.

Straight runs (salmon, elk) stay within a single row or column and never count a
tile twice across the horizontal and vertical axes.

Habitat (competitive, compared between players):

- For each habitat type, the player with the larger largest-contiguous-area
  takes a **+2** bonus; a tie splits **+1** each.

> This is a deliberately *simplified* take on Cascadia. It uses an orthogonal
> grid (not hexes), a fixed five-habitat palette, and approximated scoring rather
> than the real game's scoring cards.

## Develop

```bash
npm test     # run the scoring unit tests (node, no dependencies)
npm run lint # run ESLint (requires `npm install` first to fetch eslint)
```

### Project structure

| File | Purpose |
| ---- | ------- |
| `index.html` | Page markup: board, sidebar, draft area, controls. |
| `styles.css` | Layout and styling, including responsive board sizing. |
| `script.js` | Game logic. Pure scoring functions plus the DOM controller, wrapped in an IIFE so nothing leaks to the global scope. The pure functions are exported under Node for testing. |
| `script.test.js` | Unit tests for the scoring logic (run with `npm test`). |
| `eslint.config.js` | Flat ESLint configuration. |

The scoring logic is written as pure functions that take a board array, which is
what makes it testable in Node without a DOM. The browser bootstrap and the
test-time `module.exports` are guarded so the same file runs in both
environments.
