// Cascadia Simplified — game logic.
// Pure scoring functions are exported for testing; DOM wiring runs only in a browser.

'use strict';

// Wrapped in an IIFE so nothing leaks to the global (window) scope.
(function () {
    // ---- Constants ----
    const GRID = 5;
    const CELLS = GRID * GRID; // 25
    const TOTAL_PLAYERS = 2;
    const DRAFT_SIZE = 3;
    const BAG_COPIES = 13; // 13 * 5 = 65 of each, comfortably more than a full game needs

    // Comparative habitat scoring (Cascadia-style): per habitat, the player with the
    // larger largest-area takes the majority bonus; a tie splits the tie bonus.
    const HABITAT_MAJORITY_BONUS = 2;
    const HABITAT_TIE_BONUS = 1;

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

    // Score straight runs, claiming runs in a deterministic order so each tile is
    // counted in at most one run (no double-counting across the two axes):
    // longest first, then topmost-leftmost start, then horizontal before vertical.
    function scoreRuns(positions, pointsPerTile) {
        const runs = straightRuns(positions).sort(
            (a, b) => (b.length - a.length) || (a[0] - b[0]) || ((a[1] - a[0]) - (b[1] - b[0])));
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

    // Wildlife-only score for a single board.
    function wildlifeScore(board) {
        return wildlife.reduce(
            (total, animal) => total + wildlifeScorers[animal](board, getAnimalPositions(board, animal)),
            0);
    }

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

    function largestHabitatArea(board, habitat) {
        return Math.max(0, ...findContiguousAreas(board, habitat));
    }

    // Competitive habitat bonus across all boards: per habitat, the player with the
    // strictly largest area takes HABITAT_MAJORITY_BONUS; a tie splits HABITAT_TIE_BONUS.
    function habitatBonuses(allBoards) {
        const bonuses = allBoards.map(() => 0);
        habitats.forEach((habitat) => {
            const areas = allBoards.map((board) => largestHabitatArea(board, habitat));
            const max = Math.max(...areas);
            if (max === 0) return; // nobody has this habitat
            const leaders = areas.reduce((acc, area, p) => (area === max ? [...acc, p] : acc), []);
            if (leaders.length === 1) {
                bonuses[leaders[0]] += HABITAT_MAJORITY_BONUS;
            } else {
                leaders.forEach((p) => { bonuses[p] += HABITAT_TIE_BONUS; });
            }
        });
        return bonuses;
    }

    // Total score for one player: their wildlife score plus their share of the
    // comparative habitat bonus.
    function playerScore(allBoards, p) {
        return wildlifeScore(allBoards[p]) + habitatBonuses(allBoards)[p];
    }

    // ---- Game state ----

    let boards = [];
    let scores = [];
    let currentPlayer = 0;
    let tileBag = [];
    let tokenBag = [];
    let draftTiles = [];
    let draftTokens = [];
    let selectedColumn = null;
    let turnPhase = 'tile';   // 'tile' = place a habitat; 'token' = place the drafted animal
    let pendingAnimal = null; // animal awaiting placement during the 'token' phase
    let gameOver = false;

    function buildBag(items, copies) {
        const bag = [];
        for (let c = 0; c < copies; c++) items.forEach((item) => bag.push(item));
        return bag;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function refillColumn(i) {
        draftTiles[i] = tileBag.length ? tileBag.pop() : null;
        draftTokens[i] = tokenBag.length ? tokenBag.pop() : null;
    }

    function initGame() {
        boards = Array.from({ length: TOTAL_PLAYERS }, () => new Array(CELLS).fill(null));
        scores = new Array(TOTAL_PLAYERS).fill(0);
        currentPlayer = 0;
        tileBag = shuffle(buildBag(habitats, BAG_COPIES));
        tokenBag = shuffle(buildBag(wildlife, BAG_COPIES));
        draftTiles = [];
        draftTokens = [];
        for (let i = 0; i < DRAFT_SIZE; i++) refillColumn(i);
        selectedColumn = null;
        turnPhase = 'tile';
        pendingAnimal = null;
        gameOver = false;
        recomputeScores();
        buildBoard();
        setStatus('Select a habitat/animal pair, then tap a cell to place the habitat.');
        renderAll();
    }

    function recomputeScores() {
        const bonuses = habitatBonuses(boards);
        scores = boards.map((board, p) => wildlifeScore(board) + bonuses[p]);
    }

    // ---- Turn flow ----

    function selectDraft(i) {
        if (gameOver || turnPhase !== 'tile' || draftTiles[i] == null) return;
        selectedColumn = i;
        setStatus(`Selected ${draftTiles[i]} + ${draftTokens[i]}. Tap a cell to place the habitat.`);
        renderAll();
    }

    function isTokenTarget(index, animal) {
        const tile = boards[currentPlayer][index];
        return Boolean(tile) && tile.animal == null && canPlaceAnimal(tile.habitat, animal);
    }

    function hasTokenTarget(animal) {
        return boards[currentPlayer].some((_, i) => isTokenTarget(i, animal));
    }

    function handleCell(index) {
        if (gameOver) return;
        if (turnPhase === 'tile') placeHabitat(index);
        else placeToken(index);
    }

    function placeHabitat(index) {
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
        board[index] = { habitat, animal: null };
        pendingAnimal = animal;
        refillColumn(selectedColumn);
        selectedColumn = null;
        recomputeScores();

        if (hasTokenTarget(pendingAnimal)) {
            turnPhase = 'token';
            const homes = PLACEMENT_RULES[pendingAnimal].join(' or ');
            setStatus(`Placed ${habitat}. Now place the ${pendingAnimal} on a ${homes} tile, or skip it.`);
            renderAll();
        } else {
            setStatus(`Placed ${habitat}. No legal home for the ${pendingAnimal} — token discarded.`);
            finishPlacement();
        }
    }

    function placeToken(index) {
        if (!isTokenTarget(index, pendingAnimal)) {
            setStatus(`The ${pendingAnimal} can't go there. Choose a highlighted tile or skip it.`);
            return;
        }
        boards[currentPlayer][index].animal = pendingAnimal;
        setStatus(`Placed the ${pendingAnimal}.`);
        recomputeScores();
        finishPlacement();
    }

    function finishPlacement() {
        pendingAnimal = null;
        turnPhase = 'tile';
        advanceTurn();
    }

    function passTurn() {
        if (gameOver) return;
        if (turnPhase === 'token') {
            setStatus(`${pendingAnimal} skipped.`);
            finishPlacement();
        } else {
            setStatus(`Player ${currentPlayer + 1} passed.`);
            advanceTurn();
        }
    }

    function advanceTurn() {
        if (boards.every((board) => board.every((cell) => cell !== null))) {
            finishGame();
            return;
        }
        currentPlayer = (currentPlayer + 1) % TOTAL_PLAYERS;
        selectedColumn = null;
        turnPhase = 'tile';
        renderAll();
    }

    function finishGame() {
        gameOver = true;
        recomputeScores();
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
            cell.addEventListener('click', () => handleCell(i));
            boardEl.appendChild(cell);
        }
    }

    function renderBoard() {
        const board = boards[currentPlayer];
        document.querySelectorAll('#board .tile').forEach((cell, i) => {
            const tile = board[i];
            cell.innerHTML = '';
            cell.classList.remove('target');
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

            let enabled;
            if (gameOver) {
                enabled = false;
            } else if (turnPhase === 'tile') {
                enabled = !tile && selectedColumn !== null;
            } else {
                enabled = isTokenTarget(i, pendingAnimal);
                if (enabled) cell.classList.add('target');
            }
            cell.disabled = !enabled;
        });
    }

    function renderDraft() {
        const area = document.getElementById('draft-area');
        area.innerHTML = '';
        const draftDisabled = gameOver || turnPhase === 'token';

        for (let i = 0; i < draftTiles.length; i++) {
            const habitat = draftTiles[i];
            const animal = draftTokens[i];
            const column = document.createElement('div');
            column.className = 'draft-column' + (selectedColumn === i ? ' selected' : '');

            if (habitat == null) {
                column.classList.add('empty');
                area.appendChild(column);
                continue;
            }

            const tileBtn = document.createElement('button');
            tileBtn.type = 'button';
            tileBtn.className = 'draft-tile';
            tileBtn.style.backgroundColor = habitatColor(habitat);
            tileBtn.textContent = habitat;
            tileBtn.setAttribute('aria-pressed', String(selectedColumn === i));
            tileBtn.setAttribute('aria-label', `Draft ${i + 1}: ${habitat} habitat with ${animal}`);
            tileBtn.disabled = draftDisabled;
            tileBtn.addEventListener('click', () => selectDraft(i));

            const tokenBtn = document.createElement('button');
            tokenBtn.type = 'button';
            tokenBtn.className = 'draft-token';
            tokenBtn.style.backgroundColor = animalColor(animal);
            tokenBtn.textContent = animal;
            tokenBtn.setAttribute('aria-pressed', String(selectedColumn === i));
            tokenBtn.setAttribute('aria-label',
                `${animal} token — lives on ${PLACEMENT_RULES[animal].join(' or ')}`);
            tokenBtn.disabled = draftDisabled;
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
        const endBtn = document.getElementById('end-turn');
        endBtn.textContent = turnPhase === 'token' ? 'Skip Token' : 'End Turn (Pass)';
        endBtn.disabled = gameOver;
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
            findGroups, straightRuns, scoreRuns, isIsolated, adjacentSpeciesVariety,
            wildlifeScore, findContiguousAreas, largestHabitatArea, habitatBonuses, playerScore,
        };
    }
})();
