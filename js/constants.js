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
