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
    DENSE_FOREST: { id: 'DENSE_FOREST', friction: 1.1, color: '#0e4022', energyCost: 1.5, passable: true, stealthValue: 0.8 },
    WETLAND: { id: 'WETLAND', friction: 0.5, color: '#1f6b63', energyCost: 1.2, passable: true, stealthValue: 0.6 },
    RIDGE: { id: 'RIDGE', friction: 1.0, color: '#6f767d', energyCost: 1.0, passable: false, stealthValue: 0.05 },
    SAVANNA: { id: 'SAVANNA', friction: 0.8, color: '#8a9c39', energyCost: 0.8, passable: true, stealthValue: 0.1 },
    WATER: { id: 'WATER', friction: 0.5, color: '#3b86ff', energyCost: 1.1, passable: true, stealthValue: 0.35 },
    ICE: { id: 'ICE', friction: 1.2, color: '#eef6ff', energyCost: 1.0, passable: true, slippery: true, stealthValue: 0.05 },
};

export const TERRAIN_TYPES = Object.values(TERRAIN);
