export const STATES = {
    WANDER: 'WANDER',
    DRINK: 'DRINK',
    EAT: 'EAT',
    MATE: 'MATE'
};

// Tile size (aligned with map cell size)
export const TILE_SIZE = 8;

// World dimensions (map bounds)
export const COLS = 96;
export const ROWS = 64;
export const WORLD_WIDTH = COLS * TILE_SIZE;
export const WORLD_HEIGHT = ROWS * TILE_SIZE;

// Terrain definitions used by the physics/brush systems
export const TERRAIN = {
    GRASS: { id: 'GRASS', friction: 1.0, color: '#2ecc71', energyCost: 1.0, passable: true, stealthValue: 0.15 },
    SAND: { id: 'SAND', friction: 0.6, color: '#d8c49c', energyCost: 1.5, passable: true, stealthValue: 0.05 },
    MUD: { id: 'MUD', friction: 0.3, color: '#5b3a29', energyCost: 1.2, passable: true, stealthValue: 0.25 },
    ROCK: { id: 'ROCK', friction: 1.0, color: '#9ea7b3', energyCost: 1.0, passable: false, stealthValue: 0.05 },
    WATER: { id: 'WATER', friction: 0.5, color: '#3b86ff', energyCost: 1.1, passable: true, stealthValue: 0.35 },
    ICE: { id: 'ICE', friction: 1.2, color: '#eef6ff', energyCost: 1.0, passable: true, slippery: true, stealthValue: 0.05 },
};

export const TERRAIN_TYPES = Object.values(TERRAIN);
