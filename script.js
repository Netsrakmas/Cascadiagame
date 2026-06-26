// Cascadia Simplified — game logic.
// Pure scoring functions are exported for testing; DOM wiring runs only in a browser.

'use strict';

// ---- Constants ----
const GRID = 5;
const CELLS = GRID * GRID; // 25
const TOTAL_PLAYERS = 2;
const DRAFT_SIZE = 3;

const habitats = ['forest', 'wetland', 'prairie', 'mountain', 'river'];
const wildlife = ['bear', 'salmon', 'hawk', 'fox', 'elk'];

const HABITAT_COLORS = {
    forest: '#228B22',
    wetland: '#2E8B57',
    prairie: '#9ACD32',
    mountain: '#A9A9A9',
    river: '#1E90FF',
};

const ANIMAL_COLORS = {
    bear: '#8B4513',
    salmon: '#FF6347',
    hawk: '#DAA520',
    fox: '#FF8C00',
    elk: '#DEB887',
};

// Which habitats each animal may be placed on.
const PLACEMENT_RULES = {
    bear: ['forest', 'mountain'],
    salmon: ['river'],
    hawk: ['mountain', 'prairie'],
    fox: ['prairie', 'forest'],
    elk: ['forest', 'prairie', 'wetland'],
};

function habitatColor(habitat) {
    return HABITAT_COLORS[habitat] || '#ccc';
}

function animalColor(animal) {
    return ANIMAL_COLORS[animal] || '#fff';
}

function canPlaceAnimal(habitat, animal) {
    // Guard against unknown animals so a stray value can never throw.
    return (PLACEMENT_RULES[animal] || []).includes(habitat);
}

// ---- Pure board helpers (operate on a 25-cell array of {habitat, animal} | null) ----

function getAdjacentIndices(index) {
    const adj = [];
    const row = Math.floor(index / GRID);
    const col = index % GRID;
    if (row > 0) adj.push(index - GRID);        // up
    if (row < GRID - 1) adj.push(index + GRID); // down
    if (col > 0) adj.push(index - 1);           // left
    if (col < GRID - 1) adj.push(index + 1);    // right
    return adj;
}

function getAnimalPositions(board, animal) {
    const positions = [];
    board.forEach((tile, i) => {
        if (tile && tile.animal === animal) positions.push(i);
    });
    return positions;
}

// Connected components over 4-adjacency for a given animal (used by bears).
function findGroups(board, animal, positions) {
    const groups = [];
    const visited = new Set();
    positions.forEach((start) => {
        if (visited.has(start)) return;
        const group = [];
        const stack = [start];
        visited.add(start);
        while (stack.length) {
            const cur = stack.pop();
            group.push(cur);
            getAdjacentIndices(cur).forEach((n) => {
                if (!visited.has(n) && board[n] && board[n].animal === animal) {
                    visited.add(n);
                    stack.push(n);
                }
            });
        }
        groups.push(group);
    });
    return groups;
}

// Maximal straight runs (length >= 2) among the given positions. Horizontal runs
// stay within a single row (no wrap-around across row boundaries); vertical runs
// step by GRID. Used by salmon and elk.
function straightRuns(positions) {
    const posSet = new Set(positions);
    const runs = [];

    // Horizontal runs — only start at the left end of a run within the same row.
    positions.forEach((pos) => {
        const col = pos % GRID;
        if (col > 0 && posSet.has(pos - 1)) return; // not a run start
        let len = 1;
        let next = pos + 1;
        while (next % GRID !== 0 && posSet.has(next)) { // same row, contiguous
            len++;
            next++;
        }
        if (len >= 2) runs.push(Array.from({ length: len }, (_, k) => pos + k));
    });

    // Vertical runs — only start at the top end of a run within the same column.
    positions.forEach((pos) => {
        if (pos >= GRID && posSet.has(pos - GRID)) return; // not a run start
        let len = 1;
        let next = pos + GRID;
        while (next < CELLS && posSet.has(next)) {
            len++;
            next += GRID;
        }
        if (len >= 2) runs.push(Array.from({ length: len }, (_, k) => pos + k * GRID));
    });

    return runs;
}

// Score straight runs, claiming the longest runs first so each tile is counted
// in at most one run (no double-counting across the horizontal/vertical axes).
function scoreRuns(positions, pointsPerTile) {
    const runs = straightRuns(positions).sort((a, b) => b.length - a.length);
    const claimed = new Set();
    let points = 0;
    runs.forEach((run) => {
        if (run.some((p) => claimed.has(p))) return;
        run.forEach((p) => claimed.add(p));
        points += run.length * pointsPerTile;
    });
    return points;
}

function isIsolated(board, pos, animal) {
    return getAdjacentIndices(pos).every((n) => !(board[n] && board[n].animal === animal));
}

// Count distinct *other* species adjacent to a tile (a fox does not count itself).
function adjacentSpeciesVariety(board, pos, ownAnimal) {
    const species = new Set();
    getAdjacentIndices(pos).forEach((n) => {
        const neighbor = board[n];
        if (neighbor && neighbor.animal && neighbor.animal !== ownAnimal) {
            species.add(neighbor.animal);
        }
    });
    return species.size;
}

// ---- Scoring ----

const wildlifeScorers = {
    // Bears score for connected groups of 3 or more (3 points per bear in the group).
    bear: (board, positions) => findGroups(board, 'bear', positions)
        .filter((group) => group.length >= 3)
        .reduce((sum, group) => sum + group.length * 3, 0),
    // Salmon score in straight runs of 2+ (2 points per salmon).
    salmon: (board, positions) => scoreRuns(positions, 2),
    // Hawks score 5 points each when no other hawk is adjacent.
    hawk: (board, positions) => positions.filter((p) => isIsolated(board, p, 'hawk')).length * 5,
    // Foxes score 1 point per distinct other species adjacent.
    fox: (board, positions) => positions.reduce(
        (sum, p) => sum + adjacentSpeciesVariety(board, p, 'fox'), 0),
    // Elk score in straight lines of 2+ (3 points per elk).
    elk: (board, positions) => scoreRuns(positions, 3),
};

function findContiguousAreas(board, habitat) {
    const sizes = [];
    const visited = new Set();
    board.forEach((tile, i) => {
        if (!tile || tile.habitat !== habitat || visited.has(i)) return;
        let size = 0;
        const stack = [i];
        visited.add(i);
        while (stack.length) {
            const cur = stack.pop();
            size++;
            getAdjacentIndices(cur).forEach((n) => {
                if (!visited.has(n) && board[n] && board[n].habitat === habitat) {
                    visited.add(n);
                    stack.push(n);
                }
            });
        }
        sizes.push(size);
    });
    return sizes;
}

// Each habitat contributes the size of its largest contiguous area.
function calculateHabitatScore(board) {
    return habitats.reduce(
        (total, habitat) => total + Math.max(0, ...findContiguousAreas(board, habitat)), 0);
}

// Total score for a single player's board.
function calculateScore(board) {
    let total = 0;
    wildlife.forEach((animal) => {
        total += wildlifeScorers[animal](board, getAnimalPositions(board, animal));
    });
    return total + calculateHabitatScore(board);
}

// ---- Game state (one board and score per player) ----

let boards = [];
let scores = [];
let currentPlayer = 0;
let draftTiles = [];
let draftTokens = [];
let selectedColumn = null;
let gameOver = false;

function initGame() {
    boards = Array.from({ length: TOTAL_PLAYERS }, () => new Array(CELLS).fill(null));
    scores = new Array(TOTAL_PLAYERS).fill(0);
    currentPlayer = 0;
    gameOver = false;
    buildBoard();
    generateDraft();
    setStatus('Select a habitat/animal pair, then tap a cell on your board.');
    renderAll();
}

// ---- Game flow ----

function generateDraft() {
    draftTiles = [];
    draftTokens = [];
    for (let i = 0; i < DRAFT_SIZE; i++) {
        draftTiles.push(habitats[Math.floor(Math.random() * habitats.length)]);
        draftTokens.push(wildlife[Math.floor(Math.random() * wildlife.length)]);
    }
    selectedColumn = null;
}

function selectDraft(i) {
    if (gameOver) return;
    selectedColumn = i;
    setStatus(`Selected ${draftTiles[i]} + ${draftTokens[i]}. Tap a cell to place it.`);
    renderDraft();
}

function placeTile(index) {
    if (gameOver) return;
    const board = boards[currentPlayer];

    if (selectedColumn === null) {
        setStatus('Select a habitat/animal pair from the draft first.');
        return;
    }
    if (board[index]) {
        setStatus('That cell is already occupied.');
        return;
    }

    const habitat = draftTiles[selectedColumn];
    const animal = draftTokens[selectedColumn];
    const animalFits = canPlaceAnimal(habitat, animal);

    // Only record the animal when it can legally live on the habitat, so the
    // stored state always matches what is drawn and scored.
    board[index] = { habitat, animal: animalFits ? animal : null };
    scores[currentPlayer] = calculateScore(board);

    setStatus(animalFits
        ? `Placed ${habitat} with ${animal}.`
        : `Placed ${habitat}. ${animal} can't live there, so the token was discarded.`);

    advanceTurn();
}

function passTurn() {
    if (gameOver) return;
    setStatus(`Player ${currentPlayer + 1} passed.`);
    advanceTurn();
}

function advanceTurn() {
    if (boards.every((b) => b.every((cell) => cell !== null))) {
        finishGame();
        return;
    }
    currentPlayer = (currentPlayer + 1) % TOTAL_PLAYERS;
    generateDraft();
    renderAll();
}

function finishGame() {
    gameOver = true;
    const max = Math.max(...scores);
    const winners = scores.reduce((acc, s, p) => (s === max ? [...acc, p + 1] : acc), []);
    setStatus(winners.length === 1
        ? `Game over — Player ${winners[0]} wins with ${max} points!`
        : `Game over — tie at ${max} points between players ${winners.join(' & ')}.`);
    renderAll();
}

// ---- Rendering ----

function buildBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    for (let i = 0; i < CELLS; i++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'tile';
        cell.dataset.index = String(i);
        // Buttons handle click, keyboard, and touch natively — no double-firing.
        cell.addEventListener('click', () => placeTile(i));
        boardEl.appendChild(cell);
    }
}

function renderBoard() {
    const board = boards[currentPlayer];
    document.querySelectorAll('#board .tile').forEach((cell, i) => {
        const tile = board[i];
        cell.innerHTML = '';
        if (tile) {
            cell.style.backgroundColor = habitatColor(tile.habitat);
            let label = tile.habitat;
            if (tile.animal) {
                const token = document.createElement('span');
                token.className = 'token';
                token.style.backgroundColor = animalColor(tile.animal);
                cell.appendChild(token);
                label += ` with ${tile.animal}`;
            }
            cell.setAttribute('aria-label', `Cell ${i + 1}: ${label}`);
        } else {
            cell.style.backgroundColor = '';
            cell.setAttribute('aria-label', `Cell ${i + 1}: empty`);
        }
        cell.disabled = gameOver || Boolean(tile);
    });
}

function renderDraft() {
    const area = document.getElementById('draft-area');
    area.innerHTML = '';
    for (let i = 0; i < draftTiles.length; i++) {
        const habitat = draftTiles[i];
        const animal = draftTokens[i];

        const column = document.createElement('div');
        column.className = 'draft-column' + (selectedColumn === i ? ' selected' : '');

        const tileBtn = document.createElement('button');
        tileBtn.type = 'button';
        tileBtn.className = 'draft-tile';
        tileBtn.style.backgroundColor = habitatColor(habitat);
        tileBtn.textContent = habitat;
        tileBtn.setAttribute('aria-pressed', String(selectedColumn === i));
        tileBtn.setAttribute('aria-label', `Draft ${i + 1}: ${habitat} habitat with ${animal}`);
        tileBtn.disabled = gameOver;
        tileBtn.addEventListener('click', () => selectDraft(i));

        const tokenBtn = document.createElement('button');
        tokenBtn.type = 'button';
        tokenBtn.className = 'draft-token';
        tokenBtn.style.backgroundColor = animalColor(animal);
        tokenBtn.textContent = animal;
        tokenBtn.setAttribute('aria-pressed', String(selectedColumn === i));
        tokenBtn.setAttribute('aria-label',
            `${animal} token — lives on ${PLACEMENT_RULES[animal].join(' or ')}`);
        tokenBtn.disabled = gameOver;
        tokenBtn.addEventListener('click', () => selectDraft(i));

        column.appendChild(tileBtn);
        column.appendChild(tokenBtn);
        area.appendChild(column);
    }
}

function renderScores() {
    document.querySelectorAll('#scores .score-tag').forEach((tag, p) => {
        tag.textContent = `Player ${p + 1}: ${scores[p]}`;
        tag.classList.toggle('active', !gameOver && p === currentPlayer);
    });
}

function renderHeading() {
    document.getElementById('turn-heading').textContent =
        gameOver ? 'Game Over' : `Player ${currentPlayer + 1}'s Turn`;
}

function renderAll() {
    renderBoard();
    renderDraft();
    renderScores();
    renderHeading();
    document.getElementById('end-turn').disabled = gameOver;
}

function setStatus(message) {
    document.getElementById('status').textContent = message;
}

// ---- Bootstrap (browser only) / exports (Node test runner) ----

if (typeof document !== 'undefined') {
    document.getElementById('end-turn').addEventListener('click', passTurn);
    document.getElementById('new-game').addEventListener('click', initGame);
    initGame();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GRID, CELLS, habitats, wildlife,
        canPlaceAnimal, getAdjacentIndices, getAnimalPositions,
        findGroups, straightRuns, scoreRuns, isIsolated,
        adjacentSpeciesVariety, calculateHabitatScore, calculateScore,
    };
}
