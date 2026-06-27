// Unit tests for the pure scoring logic. Run with: node script.test.js
'use strict';

const assert = require('node:assert');
const g = require('./script.js');

function emptyBoard() {
    return new Array(g.CELLS).fill(null);
}

function put(board, i, habitat, animal = null) {
    board[i] = { habitat, animal };
}

let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
}

// --- canPlaceAnimal ---
test('canPlaceAnimal respects placement rules and never throws on unknown animals', () => {
    assert.strictEqual(g.canPlaceAnimal('river', 'salmon'), true);
    assert.strictEqual(g.canPlaceAnimal('forest', 'salmon'), false);
    assert.strictEqual(g.canPlaceAnimal('forest', 'unicorn'), false);
});

// --- straight runs / row boundaries ---
test('horizontal run does not wrap across a row boundary (index 4 -> 5)', () => {
    const b = emptyBoard();
    put(b, 4, 'prairie', 'elk'); // row 0, col 4
    put(b, 5, 'prairie', 'elk'); // row 1, col 0 — not adjacent to 4
    assert.strictEqual(g.straightRuns(g.getAnimalPositions(b, 'elk')).length, 0);
});

test('a genuine horizontal run of 3 is detected', () => {
    const b = emptyBoard();
    [5, 6, 7].forEach((i) => put(b, i, 'prairie', 'elk')); // row 1, cols 0-2
    const runs = g.straightRuns(g.getAnimalPositions(b, 'elk'));
    assert.strictEqual(runs.length, 1);
    assert.strictEqual(runs[0].length, 3);
});

// --- elk: no double counting across axes ---
test('elk at a horizontal/vertical intersection is not scored twice', () => {
    const b = emptyBoard();
    [5, 6, 7, 10].forEach((i) => put(b, i, 'prairie', 'elk')); // H run 5-6-7, V run 5-10
    // Longest run (5,6,7 -> 9) is claimed; overlapping pair (5,10) is skipped.
    assert.strictEqual(g.scoreRuns(g.getAnimalPositions(b, 'elk'), 3), 9);
});

// --- salmon: straight runs, not 2D blobs ---
test('salmon score as straight runs (length * 2)', () => {
    const b = emptyBoard();
    [0, 5, 10].forEach((i) => put(b, i, 'river', 'salmon')); // vertical run of 3
    assert.strictEqual(g.scoreRuns(g.getAnimalPositions(b, 'salmon'), 2), 6);
});

test('a 2x2 salmon block is not one big chain', () => {
    const b = emptyBoard();
    [0, 1, 5, 6].forEach((i) => put(b, i, 'river', 'salmon'));
    // Two horizontal pairs (0-1, 5-6); verticals overlap and are skipped.
    // 2 runs * length 2 * 2 pts = 8, not a single chain of 4.
    assert.strictEqual(g.scoreRuns(g.getAnimalPositions(b, 'salmon'), 2), 8);
});

// --- bears: connected groups of 3+ ---
test('bear group of 2 scores nothing; group of 3 scores 9', () => {
    const two = emptyBoard();
    [0, 1].forEach((i) => put(two, i, 'forest', 'bear'));
    assert.strictEqual(g.findGroups(two, 'bear', g.getAnimalPositions(two, 'bear'))[0].length, 2);

    const three = emptyBoard();
    [0, 1, 2].forEach((i) => put(three, i, 'forest', 'bear'));
    const groups = g.findGroups(three, 'bear', g.getAnimalPositions(three, 'bear'));
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].length, 3);
});

// --- hawk isolation ---
test('only hawks with no adjacent hawk count as isolated', () => {
    const b = emptyBoard();
    put(b, 0, 'mountain', 'hawk');  // isolated
    put(b, 12, 'mountain', 'hawk'); // adjacent to 13
    put(b, 13, 'mountain', 'hawk');
    const isolated = g.getAnimalPositions(b, 'hawk').filter((p) => g.isIsolated(b, p, 'hawk'));
    assert.strictEqual(isolated.length, 1);
});

// --- fox diversity excludes its own species ---
test('fox diversity counts other species but not adjacent foxes', () => {
    const b = emptyBoard();
    put(b, 12, 'prairie', 'fox');
    put(b, 7, 'prairie', 'fox');  // adjacent fox — must NOT count
    put(b, 13, 'forest', 'bear'); // adjacent bear — counts
    assert.strictEqual(g.adjacentSpeciesVariety(b, 12, 'fox'), 1);
});

// --- habitat largest area ---
test('largestHabitatArea returns the biggest contiguous area per habitat', () => {
    const b = emptyBoard();
    [0, 1, 2].forEach((i) => put(b, i, 'forest')); // area of 3
    put(b, 10, 'forest');                           // isolated area of 1
    assert.strictEqual(g.largestHabitatArea(b, 'forest'), 3);
    assert.strictEqual(g.largestHabitatArea(b, 'river'), 0);
});

// --- wildlife-only score ---
test('wildlifeScore sums only wildlife, not habitat', () => {
    const b = emptyBoard();
    [0, 1, 2].forEach((i) => put(b, i, 'forest', 'bear')); // bear group of 3 -> 9
    assert.strictEqual(g.wildlifeScore(b), 9); // no habitat points included
});

// --- competitive habitat bonus ---
test('habitat bonus: the strictly larger area takes the majority bonus', () => {
    const b0 = emptyBoard();
    [0, 1, 2].forEach((i) => put(b0, i, 'forest')); // area 3
    const b1 = emptyBoard();
    [0, 1].forEach((i) => put(b1, i, 'forest'));    // area 2
    assert.deepStrictEqual(g.habitatBonuses([b0, b1]), [2, 0]);
});

test('habitat bonus: a tie splits the tie bonus', () => {
    const b0 = emptyBoard();
    [0, 1].forEach((i) => put(b0, i, 'river'));
    const b1 = emptyBoard();
    [0, 1].forEach((i) => put(b1, i, 'river'));
    assert.deepStrictEqual(g.habitatBonuses([b0, b1]), [1, 1]);
});

test('habitat bonus: a habitat nobody has awards nothing', () => {
    assert.deepStrictEqual(g.habitatBonuses([emptyBoard(), emptyBoard()]), [0, 0]);
});

test('playerScore combines wildlife and the comparative habitat bonus', () => {
    const b0 = emptyBoard();
    [0, 1, 2].forEach((i) => put(b0, i, 'forest', 'bear')); // bears 9, forest area 3
    const b1 = emptyBoard();
    [5].forEach((i) => put(b1, i, 'forest'));               // forest area 1
    // b0 wins the forest majority (+2): 9 + 2 = 11; b1: 0 wildlife + 0 (loses forest) = 0
    assert.strictEqual(g.playerScore([b0, b1], 0), 11);
    assert.strictEqual(g.playerScore([b0, b1], 1), 0);
});

console.log(`\n${passed} tests passed.`);
