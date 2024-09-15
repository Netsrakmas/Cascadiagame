// Define habitats and wildlife
const habitats = ['forest', 'wetland', 'prairie', 'mountain', 'river'];
const wildlife = ['bear', 'salmon', 'hawk', 'fox', 'elk'];

// Game state
let board = [];
let draftTiles = [];
let draftTokens = [];
let score = 0;
let currentPlayer = 1;
const totalPlayers = 2;

// Initialize the game
function initGame() {
    createBoard();
    generateDraft();
    updateScore();
    updatePlayerDisplay();
}

// Create the game board
function createBoard() {
    const boardElement = document.getElementById('board');
    for (let i = 0; i < 25; i++) {
        const tileDiv = document.createElement('div');
        tileDiv.classList.add('tile');
        tileDiv.dataset.index = i;
        tileDiv.addEventListener('click', () => placeTile(i));
        tileDiv.addEventListener('touchstart', () => placeTile(i), { passive: true });
        boardElement.appendChild(tileDiv);
        board.push(null);
    }
}

// Generate draft tiles and tokens
function generateDraft() {
    draftTiles = [];
    draftTokens = [];
    const draftArea = document.getElementById('draft-area');
    draftArea.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        // Create draft tile
        const habitat = habitats[Math.floor(Math.random() * habitats.length)];
        const tileDiv = document.createElement('div');
        tileDiv.classList.add('draft-tile');
        tileDiv.style.backgroundColor = getHabitatColor(habitat);
        tileDiv.dataset.habitat = habitat;
        tileDiv.addEventListener('click', () => selectDraft(i));
        tileDiv.addEventListener('touchstart', () => selectDraft(i), { passive: true });
        draftArea.appendChild(tileDiv);
        draftTiles.push(habitat);

        // Create draft token
        const animal = wildlife[Math.floor(Math.random() * wildlife.length)];
        const tokenDiv = document.createElement('div');
        tokenDiv.classList.add('draft-token');
        tokenDiv.style.backgroundColor = getAnimalColor(animal);
        tokenDiv.dataset.animal = animal;
        tokenDiv.addEventListener('click', () => selectDraft(i));
        tokenDiv.addEventListener('touchstart', () => selectDraft(i), { passive: true });
        draftArea.appendChild(tokenDiv);
        draftTokens.push(animal);
    }
}

// Get colors for habitats and animals
function getHabitatColor(habitat) {
    switch (habitat) {
        case 'forest': return '#228B22';
        case 'wetland': return '#2E8B57';
        case 'prairie': return '#9ACD32';
        case 'mountain': return '#A9A9A9';
        case 'river': return '#1E90FF';
        default: return '#ccc';
    }
}

function getAnimalColor(animal) {
    switch (animal) {
        case 'bear': return '#8B4513';
        case 'salmon': return '#FF6347';
        case 'hawk': return '#DAA520';
        case 'fox': return '#FF8C00';
        case 'elk': return '#DEB887';
        default: return '#fff';
    }
}

// Variables to hold selected draft
let selectedTileIndex = null;

// Select a draft pair
function selectDraft(index) {
    selectedTileIndex = index;
    alert(`Selected Tile: ${draftTiles[index]}, Token: ${draftTokens[index]}\nClick on the board to place the tile.`);
}

// Place the selected tile on the board
function placeTile(index) {
    if (selectedTileIndex === null) {
        alert('Please select a tile and token from the draft area.');
        return;
    }

    if (board[index]) {
        alert('This spot is already occupied.');
        return;
    }

    const tileDivs = document.getElementsByClassName('tile');
    const tileDiv = tileDivs[index];

    // Place habitat tile
    const habitat = draftTiles[selectedTileIndex];
    tileDiv.style.backgroundColor = getHabitatColor(habitat);
    tileDiv.dataset.habitat = habitat;

    // Place wildlife token
    const animal = draftTokens[selectedTileIndex];
    if (canPlaceAnimal(habitat, animal)) {
        const tokenDiv = document.createElement('div');
        tokenDiv.classList.add('token');
        tokenDiv.style.backgroundColor = getAnimalColor(animal);
        tileDiv.appendChild(tokenDiv);
        tileDiv.dataset.animal = animal;
    } else {
        alert(`${animal} cannot be placed on ${habitat} habitat.`);
    }

    board[index] = { habitat, animal };

    // Reset selection
    selectedTileIndex = null;

    // Refresh the draft area
    generateDraft();

    // Update score
    calculateScore();

    // Switch turns
    currentPlayer = currentPlayer % totalPlayers + 1;
    updatePlayerDisplay();
    alert(`Player ${currentPlayer}'s turn`);
}

// Check if an animal can be placed on the habitat
function canPlaceAnimal(habitat, animal) {
    const placementRules = {
        'bear': ['forest', 'mountain'],
        'salmon': ['river'],
        'hawk': ['mountain', 'prairie'],
        'fox': ['prairie', 'forest'],
        'elk': ['forest', 'prairie', 'wetland']
    };
    return placementRules[animal].includes(habitat);
}

// Update the player number display
function updatePlayerDisplay() {
    document.getElementById('player-number').innerText = currentPlayer;
}

// Calculate score
function calculateScore() {
    score = 0;

    // Wildlife scoring
    wildlife.forEach(animal => {
        const positions = getAnimalPositions(animal);
        const animalScore = wildlifeScoringPatterns[animal].calculate(positions);
        score += animalScore;
    });

    // Habitat scoring
    score += calculateHabitatScore();

    updateScore();
}

// Update score display
function updateScore() {
    document.getElementById('score').innerText = score;
}

// Wildlife scoring patterns
const wildlifeScoringPatterns = {
    'bear': {
        description: 'Bears score for groups of 3 or more.',
        calculate: (positions) => {
            let groups = findGroups(positions);
            let points = 0;
            groups.forEach(group => {
                if (group.size >= 3) {
                    points += group.size * 3; // Each bear in group gives 3 points
                }
            });
            return points;
        }
    },
    'salmon': {
        description: 'Salmon score in chains.',
        calculate: (positions) => {
            let chains = findChains(positions);
            let points = 0;
            chains.forEach(chain => {
                if (chain.length >= 2) {
                    points += chain.length * 2; // Each salmon in chain gives 2 points
                }
            });
            return points;
        }
    },
    'hawk': {
        description: 'Hawks prefer solitude.',
        calculate: (positions) => {
            let points = 0;
            positions.forEach(pos => {
                if (isIsolated(pos, 'hawk')) {
                    points += 5; // Isolated hawk gives 5 points
                }
            });
            return points;
        }
    },
    'fox': {
        description: 'Foxes score based on diversity of adjacent wildlife.',
        calculate: (positions) => {
            let points = 0;
            positions.forEach(pos => {
                let diversity = getAdjacentWildlifeDiversity(pos);
                points += diversity; // 1 point per unique adjacent animal
            });
            return points;
        }
    },
    'elk': {
        description: 'Elk score in straight lines.',
        calculate: (positions) => {
            let lines = findLines(positions);
            let points = 0;
            lines.forEach(line => {
                if (line.length >= 2) {
                    points += line.length * 3; // Each elk in line gives 3 points
                }
            });
            return points;
        }
    }
};

// Get positions of a specific animal
function getAnimalPositions(animal) {
    let positions = [];
    board.forEach((tile, index) => {
        if (tile && tile.animal === animal) {
            positions.push(index);
        }
    });
    return positions;
}

// Helper function to get adjacent indices
function getAdjacentIndices(index) {
    const adjacentIndices = [];
    const row = Math.floor(index / 5);
    const col = index % 5;

    // Up
    if (row > 0) adjacentIndices.push(index - 5);
    // Down
    if (row < 4) adjacentIndices.push(index + 5);
    // Left
    if (col > 0) adjacentIndices.push(index - 1);
    // Right
    if (col < 4) adjacentIndices.push(index + 1);

    return adjacentIndices;
}

// Find groups for bears
function findGroups(positions) {
    let groups = [];
    let visited = new Set();

    positions.forEach(pos => {
        if (!visited.has(pos)) {
            let group = new Set();
            exploreGroup(pos, 'bear', group, visited);
            groups.push(group);
        }
    });

    return groups;
}

function exploreGroup(pos, animal, group, visited) {
    visited.add(pos);
    group.add(pos);
    let neighbors = getAdjacentIndices(pos);

    neighbors.forEach(neighbor => {
        if (!visited.has(neighbor) && board[neighbor] && board[neighbor].animal === animal) {
            exploreGroup(neighbor, animal, group, visited);
        }
    });
}

// Find chains for salmon
function findChains(positions) {
    let chains = [];
    let visited = new Set();

    positions.forEach(pos => {
        if (!visited.has(pos)) {
            let chain = [];
            exploreChain(pos, 'salmon', chain, visited);
            chains.push(chain);
        }
    });

    return chains;
}

function exploreChain(pos, animal, chain, visited) {
    visited.add(pos);
    chain.push(pos);
    let neighbors = getAdjacentIndices(pos);

    neighbors.forEach(neighbor => {
        if (!visited.has(neighbor) && board[neighbor] && board[neighbor].animal === animal) {
            exploreChain(neighbor, animal, chain, visited);
        }
    });
}

// Check if hawk is isolated
function isIsolated(pos, animal) {
    let neighbors = getAdjacentIndices(pos);
    for (let neighbor of neighbors) {
        if (board[neighbor] && board[neighbor].animal === animal) {
            return false;
        }
    }
    return true;
}

// Get diversity of adjacent wildlife for fox
function getAdjacentWildlifeDiversity(pos) {
    let wildlifeSet = new Set();
    let neighbors = getAdjacentIndices(pos);
    neighbors.forEach(neighbor => {
        if (board[neighbor] && board[neighbor].animal) {
            wildlifeSet.add(board[neighbor].animal);
        }
    });
    return wildlifeSet.size;
}

// Find lines for elk
function findLines(positions) {
    let lines = [];
    let horizontal = findStraightLines(positions, 1);
    let vertical = findStraightLines(positions, 5);
    lines = lines.concat(horizontal, vertical);
    return lines;
}

function findStraightLines(positions, step) {
    let lines = [];
    let posSet = new Set(positions);
    positions.forEach(pos => {
        let line = [pos];
        let nextPos = pos + step;
        while (posSet.has(nextPos)) {
            line.push(nextPos);
            posSet.delete(nextPos);
            nextPos += step;
        }
        if (line.length >= 2) {
            lines.push(line);
        }
    });
    return lines;
}

// Calculate habitat score
function calculateHabitatScore() {
    let habitatScore = 0;
    habitats.forEach(habitat => {
        let sizes = findContiguousAreas(habitat);
        let maxSize = Math.max(...sizes, 0);
        habitatScore += maxSize; // Score based on largest contiguous area
    });
    return habitatScore;
}

// Find contiguous areas for habitats
function findContiguousAreas(habitat) {
    let sizes = [];
    let visited = new Set();

    board.forEach((tile, index) => {
        if (tile && tile.habitat === habitat && !visited.has(index)) {
            let size = exploreHabitat(index, habitat, visited);
            sizes.push(size);
        }
    });

    return sizes;
}

function exploreHabitat(index, habitat, visited) {
    visited.add(index);
    let size = 1;
    let neighbors = getAdjacentIndices(index);

    neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
            let tile = board[neighbor];
            if (tile && tile.habitat === habitat) {
                size += exploreHabitat(neighbor, habitat, visited);
            }
        }
    });

    return size;
}

// End turn button
document.getElementById('end-turn').addEventListener('click', () => {
    alert(`Player ${currentPlayer}'s turn ended.`);
    currentPlayer = currentPlayer % totalPlayers + 1;
    updatePlayerDisplay();
    alert(`Player ${currentPlayer}'s turn`);
});

initGame();
