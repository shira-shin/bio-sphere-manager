import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

export default class Vegetation {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.energy = 10; // 栄養価
        this.maxEnergy = 50;
        this.growthRate = 0.1; // 基本成長速度
        this.reproThreshold = 40; // 繁殖可能になるサイズ
        this.age = 0;
        this.optimalTemp = 25; // 快適温度
        this.tempSigma = 6;    // 温度ガウスの幅
        this.lastMoisture = 0.5;
    }

    tempFactor(temp) {
        // 温度が最適に近いと1.0、離れると減衰するガウス関数
        const diff = temp - this.optimalTemp;
        return Math.exp(- (diff * diff) / (2 * this.tempSigma * this.tempSigma));
    }

    update(env = { moisture: 0.5, temperature: 22 }) {
        if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y) || this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) {
            this.energy = 0;
            return;
        }
        this.age++;
        const moisture = constrain(env.moisture, 0, 1);
        const tempFactor = this.tempFactor(env.temperature ?? 22);
        this.lastMoisture = moisture;

        // 環境依存の成長
        if (this.energy < this.maxEnergy) {
            const growth = this.growthRate * moisture * tempFactor;
            this.energy += growth;
        }

        // 枯死判定（極端な環境）
        const extremeDry = moisture < 0.05;
        const extremeTemp = tempFactor < 0.1;
        if ((extremeDry || extremeTemp) && random() < 0.02) {
            this.energy = 0;
        }

        this.energy = constrain(this.energy, 0, this.maxEnergy);
    }

    // 繁殖（種を飛ばす）
    reproduce() {
        if (this.energy > this.reproThreshold && random() < 0.005) {
            // 近くに新しい草を生やす
            let angle = random(TWO_PI);
            let dist = random(10, 50);
            let newX = this.pos.x + cos(angle) * dist;
            let newY = this.pos.y + sin(angle) * dist;
            
            // 画面内チェック
            newX = constrain(newX, 0, WORLD_WIDTH);
            newY = constrain(newY, 0, WORLD_HEIGHT);
            
            return new Vegetation(newX, newY);
        }
        return null;
    }

    // 食べられる処理
    eaten(amount) {
        this.energy -= amount;
        if (this.energy < 0) this.energy = 0;
        return amount; // 実際に得られた栄養
    }

    draw() {
        if (this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) return;
        noStroke();
        // 成長度合いに応じてサイズと色が変わる
        let size = map(this.energy, 0, this.maxEnergy, 2, 12);
        let green = map(this.energy, 0, this.maxEnergy, 100, 255);
        // 水分不足時は茶色寄りに変化
        const drynessTint = this.lastMoisture < 0.25 ? map(this.lastMoisture, 0, 0.25, 100, 20) : 0;
        fill(50 + drynessTint, green - drynessTint, 50, 100);
        ellipse(this.pos.x, this.pos.y, size);
    }
}
