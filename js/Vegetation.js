import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

export default class Vegetation {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.energy = 12; // 栄養価
        this.maxEnergy = 52;
        this.age = 0;
        this.lastMoisture = 0.5;
        this.lastHerbivorePressure = 0;
        this.dormant = 0;
        this.genes = this.randomGenes();
        this.optimalTemp = 24; // 快適温度の中心
        this.tempSigma = 5.5;  // 温度許容幅
        this.colorSeed = random(0.4, 0.9);
    }

    randomGenes() {
        return {
            growth: random(0.08, 0.14),
            spread: random(16, 42),
            defense: random(0.15, 0.5),
            resilience: random(0.5, 1.2),
            mutation: random(0.02, 0.08),
        };
    }

    tempFactor(temp) {
        // 温度が最適に近いと1.0、離れると減衰するガウス関数
        const diff = temp - this.optimalTemp;
        return Math.exp(- (diff * diff) / (2 * this.tempSigma * this.tempSigma));
    }

    update(env = { moisture: 0.5, temperature: 22, soil: 0.5, herbivorePressure: 0, flooded: false }) {
        if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y) || this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) {
            this.energy = 0;
            return;
        }
        this.age++;
        const moisture = constrain(env.moisture, 0, 1);
        const soil = constrain(env.soil ?? 0.5, 0, 1);
        const tempFactor = this.tempFactor(env.temperature ?? 22);
        this.lastMoisture = moisture;
        this.lastHerbivorePressure = env.herbivorePressure ?? 0;

        // 環境依存の成長（洪水で抑制）
        if (this.energy < this.maxEnergy && !env.flooded) {
            const stress = env.herbivorePressure * (0.3 + this.genes.defense * 0.4);
            const growth = this.genes.growth * moisture * soil * tempFactor * (1 - stress);
            this.energy += growth;
        }

        // 捕食プレッシャーによる摩耗と回避
        if (env.herbivorePressure > 0.01) {
            const grazingLoss = env.herbivorePressure * 0.5 * (1 - this.genes.defense);
            this.energy -= grazingLoss;
            this.dormant = Math.min(1, this.dormant + env.herbivorePressure * 0.05);
        } else {
            this.dormant = Math.max(0, this.dormant - 0.01);
        }

        // 洪水や土壌悪化で枯死しやすくする
        if (env.flooded && random() < 0.1) {
            this.energy -= 4;
        }
        if (soil < 0.1) {
            this.energy -= 0.8 * (1 - this.genes.resilience * 0.2);
        }

        // 枯死判定（極端な環境）
        const extremeDry = moisture < 0.05;
        const extremeTemp = tempFactor < 0.1;
        if ((extremeDry || extremeTemp || env.flooded) && random() < (0.02 + (1 - this.genes.resilience) * 0.02)) {
            this.energy = 0;
        }

        this.energy = constrain(this.energy, 0, this.maxEnergy);
    }

    // 繁殖（種を飛ばす）
    reproduce(env = { moisture: 0.5, soil: 0.5, herbivorePressure: 0, flooded: false, bounds: { w: WORLD_WIDTH, h: WORLD_HEIGHT } }) {
        if (env.flooded || this.energy < this.maxEnergy * 0.75) return null;
        const pressure = env.herbivorePressure ?? 0;
        const spreadBias = map(pressure, 0, 1, 1.0, 0.35);
        if (random() < 0.003 * spreadBias) {
            const angle = random(TWO_PI);
            const dist = random(this.genes.spread * 0.3, this.genes.spread) * (1 - this.dormant * 0.3);
            let newX = this.pos.x + cos(angle) * dist;
            let newY = this.pos.y + sin(angle) * dist;
            newX = constrain(newX, 0, env.bounds.w ?? WORLD_WIDTH);
            newY = constrain(newY, 0, env.bounds.h ?? WORLD_HEIGHT);

            const child = new Vegetation(newX, newY);
            child.genes = { ...this.genes };
            Object.keys(child.genes).forEach(k => {
                if (random() < this.genes.mutation) {
                    const delta = random(-0.1, 0.12);
                    if (k === 'spread') child.genes[k] = constrain(child.genes[k] + delta * 8, 6, 72);
                    else if (k === 'mutation') child.genes[k] = constrain(child.genes[k] + delta * 0.5, 0.01, 0.12);
                    else child.genes[k] = constrain(child.genes[k] + delta, 0.05, 1.6);
                }
            });
            child.energy = this.energy * 0.35;
            this.energy *= 0.72;
            return child;
        }
        return null;
    }

    // 食べられる処理
    eaten(amount) {
        const resisted = amount * (1 - this.genes.defense * 0.35);
        this.energy -= resisted;
        this.lastHerbivorePressure = Math.min(1, this.lastHerbivorePressure + resisted * 0.01);
        if (this.energy < 0) this.energy = 0;
        return amount; // 実際に得られた栄養
    }

    draw() {
        if (this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) return;
        noStroke();
        // 地表の覗き見え表現
        if (this.energy < 4) {
            fill(70, 60, 40, 60);
            ellipse(this.pos.x, this.pos.y, 10, 6);
        }

        // 成長度合いに応じてサイズと色が変わる（複層レイヤー）
        const bodySize = map(this.energy, 0, this.maxEnergy, 4, 14);
        const accent = map(this.genes.defense, 0, 1, 90, 160);
        const drynessTint = this.lastMoisture < 0.3 ? map(this.lastMoisture, 0, 0.3, 120, 30) : 0;
        const hue = lerp(80, 150, this.colorSeed);
        noStroke();
        fill(hue, 160 - drynessTint, 90 + drynessTint, 110);
        ellipse(this.pos.x, this.pos.y + 2, bodySize * 0.9, bodySize * 0.6);
        fill(hue + accent, 180 - drynessTint, 120, 150);
        ellipse(this.pos.x, this.pos.y, bodySize * 0.55, bodySize);
        fill(240, 255 - accent, 180, 140);
        triangle(this.pos.x, this.pos.y - bodySize * 0.4, this.pos.x - bodySize * 0.25, this.pos.y + bodySize * 0.15, this.pos.x + bodySize * 0.25, this.pos.y + bodySize * 0.15);
    }
}
