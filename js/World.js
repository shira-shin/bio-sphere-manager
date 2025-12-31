import { TILE_SIZE } from './constants.js';

export default class World {
    constructor() {
        this.grid = [];
        this.animals = []; // 動物リスト参照用
    }

    init() {
        // 地形生成（簡易版：中央に池）
        for (let x = 0; x < width / TILE_SIZE; x++) {
            this.grid[x] = [];
            for (let y = 0; y < height / TILE_SIZE; y++) {
                // ノイズ等で地形を作る（ここでは固定で中央を水に）
                let isWater = (x > 10 && x < 20 && y > 10 && y < 20);
                this.grid[x][y] = {
                    type: isWater ? 'WATER' : 'LAND',
                    x: x * TILE_SIZE,
                    y: y * TILE_SIZE
                };
            }
        }
    }

    // 一番近い水場を探す
    findNearestWater(pos, radius) {
        let gridX = Math.floor(pos.x / TILE_SIZE);
        let gridY = Math.floor(pos.y / TILE_SIZE);
        let searchRange = Math.floor(radius / TILE_SIZE);
        
        let record = Infinity;
        let nearest = null;

        // 周囲のタイルを探索
        for (let i = -searchRange; i <= searchRange; i++) {
            for (let j = -searchRange; j <= searchRange; j++) {
                let cx = gridX + i;
                let cy = gridY + j;
                // 配列範囲チェック
                if (cx >= 0 && cx < this.grid.length && cy >= 0 && cy < this.grid[0].length) {
                    let tile = this.grid[cx][cy];
                    if (tile.type === 'WATER') {
                        let tilePos = createVector(tile.x + TILE_SIZE/2, tile.y + TILE_SIZE/2);
                        let d = p5.Vector.dist(pos, tilePos);
                        if (d < record) {
                            record = d;
                            nearest = tilePos;
                        }
                    }
                }
            }
        }
        return nearest;
    }

    draw() {
        noStroke();
        for (let x = 0; x < this.grid.length; x++) {
            for (let y = 0; y < this.grid[x].length; y++) {
                let tile = this.grid[x][y];
                if (tile.type === 'WATER') fill(50, 50, 200);
                else fill(30, 30, 30); // ダークテーマ背景
                rect(tile.x, tile.y, TILE_SIZE, TILE_SIZE);
            }
        }
    }
}
