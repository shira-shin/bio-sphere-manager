import Animal from './Animal.js';
import { WORLD_WIDTH, WORLD_HEIGHT, COLS, ROWS, TERRAIN } from './constants.js';

/**
 * ワールド全体の時間・天候・統計を管理する軽量クラス。
 * p5.js のスケッチループから update()/draw() を呼び出して利用する想定。
 */
export default class World {
    constructor({ dayLength = 1200, zoomLevel = 1 } = {}) {
        this.animals = [];
        this.dayLength = dayLength;
        this.time = 0;
        this.isNight = false;
        this.weather = 'clear';
        this.weatherTimer = 0;
        this.zoomLevel = zoomLevel;
        this.temperature = 24;
        this.moisture = 0.5;

        this.tiles = Array.from({ length: ROWS }, () =>
            Array.from({ length: COLS }, () => ({ type: TERRAIN.GRASS }))
        );

        this.statsHistory = { speed: [], size: [], vision: [] };
        this.historyMax = 400;
        this.mutationLog = [];
    }

    spawn(x, y, dna = null, generation = 1) {
        const animal = new Animal(x, y, dna, generation);
        this.animals.push(animal);
        return animal;
    }

    getTileAt(x, y) {
        const col = constrain(Math.floor(x / (WORLD_WIDTH / COLS)), 0, COLS - 1);
        const row = constrain(Math.floor(y / (WORLD_HEIGHT / ROWS)), 0, ROWS - 1);
        return this.tiles[row][col];
    }

    paintTerrain(centerX, centerY, radius, terrainType) {
        const colCenter = constrain(Math.floor(centerX / (WORLD_WIDTH / COLS)), 0, COLS - 1);
        const rowCenter = constrain(Math.floor(centerY / (WORLD_HEIGHT / ROWS)), 0, ROWS - 1);
        const radCells = Math.max(1, Math.round(radius / (WORLD_WIDTH / COLS)));
        for (let dy = -radCells; dy <= radCells; dy++) {
            for (let dx = -radCells; dx <= radCells; dx++) {
                const cx = colCenter + dx;
                const cy = rowCenter + dy;
                if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
                const dist = Math.hypot(dx, dy);
                if (dist > radCells) continue;
                this.tiles[cy][cx] = { type: terrainType };
            }
        }
    }

    toggleZoom(level) { this.zoomLevel = level; }

    nextWeather() {
        const roll = random();
        if (roll < 0.6) return 'clear';
        if (roll < 0.85) return 'rain';
        return 'storm';
    }

    update() {
        this.time++;
        // 昼夜サイクル
        if (this.time % this.dayLength === 0) {
            this.isNight = !this.isNight;
        }

        // 天候更新
        if (this.weatherTimer <= 0) {
            this.weather = this.nextWeather();
            this.weatherTimer = 600 + Math.floor(random(0, 600));
        }
        this.weatherTimer--;

        const targetTemp = this.weather === 'storm' ? 18 : this.weather === 'rain' ? 20 : 28;
        const targetMoisture = this.weather === 'storm' ? 0.9 : this.weather === 'rain' ? 0.7 : 0.35;
        this.temperature = lerp(this.temperature, targetTemp, 0.02);
        this.moisture = lerp(this.moisture, targetMoisture, 0.015);

        this.applyDynamicTerrain();

        const env = {
            temperature: this.temperature,
            humidity: this.moisture,
            weather: this.weather,
            isNight: this.isNight,
        };

        // 個体更新 + 繁殖と突然変異チェック
        const newborns = [];
        for (const a of this.animals) {
            if (a.dead) continue;
            const tile = this.getTileAt(a.pos.x, a.pos.y).type;
            a.update({ ...env, tile });
            const child = a.reproduce();
            if (child) {
                this.checkMutation(a, child);
                newborns.push(child);
            }
        }
        this.animals.push(...newborns);
        this.animals = this.animals.filter(a => !a.dead);

        if (this.time % 100 === 0) this.recordStats();
    }

    checkMutation(parent, child) {
        const keys = ['speed', 'size', 'sense'];
        keys.forEach(key => {
            const base = parent.dna.genes[key];
            const delta = child.dna.genes[key] - base;
            const ratio = base !== 0 ? delta / base : 0;
            if (abs(ratio) >= 0.1) {
                const sign = ratio > 0 ? '+' : '-';
                const pct = Math.round(ratio * 100);
                this.mutationLog.push(`⚠️ 突然変異発生: ${key} ${sign}${Math.abs(pct)}%`);
            }
        });
        if (this.mutationLog.length > 5) this.mutationLog.shift();
    }

    recordStats() {
        const living = this.animals.filter(a => !a.dead);
        if (living.length === 0) return;
        const sum = living.reduce((acc, a) => {
            acc.speed += a.maxSpeed;
            acc.size += a.size;
            acc.vision += a.sensorRange;
            return acc;
        }, { speed: 0, size: 0, vision: 0 });
        this.statsHistory.speed.push(sum.speed / living.length);
        this.statsHistory.size.push(sum.size / living.length);
        this.statsHistory.vision.push(sum.vision / living.length);

        Object.keys(this.statsHistory).forEach(k => {
            if (this.statsHistory[k].length > this.historyMax) this.statsHistory[k].shift();
        });
    }

    drawNightOverlay() {
        if (!this.isNight) return;
        push();
        noStroke();
        fill(10, 30, 80, 120);
        rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        pop();
    }

    drawTerrain() {
        const cellW = WORLD_WIDTH / COLS;
        const cellH = WORLD_HEIGHT / ROWS;
        noStroke();
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const t = this.tiles[y][x].type;
                fill(t.color);
                rect(x * cellW, y * cellH, cellW, cellH);
            }
        }
    }

    drawAnimals() {
        for (const a of this.animals) {
            a.draw(this.zoomLevel);
        }
    }

    drawUI(p) {
        // グラフ領域
        const h = 120;
        p.push();
        p.translate(10, p.height - h - 10);
        p.noFill();
        p.stroke(200);
        p.rect(0, 0, p.width - 20, h);

        const drawLine = (data, color) => {
            if (data.length < 2) return;
            p.stroke(color);
            p.noFill();
            p.beginShape();
            data.forEach((v, i) => {
                const x = map(i, 0, this.historyMax, 0, p.width - 20);
                const y = map(v, 0, Math.max(...data) || 1, h - 5, 5);
                p.vertex(x, y);
            });
            p.endShape();
        };

        drawLine(this.statsHistory.speed, '#ff6b6b');
        drawLine(this.statsHistory.size, '#6bff8c');
        drawLine(this.statsHistory.vision, '#6ba8ff');

        p.noStroke();
        p.fill('#cdd8e5');
        p.textSize(12);
        p.text('進化グラフ (Speed=赤, Size=緑, Vision=青)', 4, 14);

        // 突然変異ログ
        if (this.mutationLog.length > 0) {
            p.textAlign(p.RIGHT, p.TOP);
            this.mutationLog.forEach((msg, idx) => {
                p.text(msg, p.width - 24, 14 + idx * 14);
            });
            p.textAlign(p.LEFT, p.BASELINE);
        }

        p.pop();
    }

    applyDynamicTerrain() {
        const freeze = this.temperature <= -5;
        const thaw = this.temperature > 1;
        const dryOut = this.temperature > 30 && this.moisture < 0.25;
        const becomeMud = this.moisture > 0.75;

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const tile = this.tiles[y][x];
                const t = tile.type;
                if (freeze && t === TERRAIN.WATER && random() < 0.02) tile.type = TERRAIN.ICE;
                if (thaw && t === TERRAIN.ICE && random() < 0.02) tile.type = TERRAIN.WATER;
                if (dryOut && t === TERRAIN.GRASS && random() < 0.01) tile.type = TERRAIN.SAND;
                if (becomeMud && (t === TERRAIN.SAND || t === TERRAIN.GRASS) && random() < 0.02) tile.type = TERRAIN.MUD;
            }
        }
    }
}

