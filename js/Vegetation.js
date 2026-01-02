export default class Vegetation {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.energy = 10; // 栄養価
        this.maxEnergy = 50;
        this.growthRate = 0.1; // 成長速度
        this.reproThreshold = 40; // 繁殖可能になるサイズ
        this.age = 0;
    }

    update() {
        this.age++;
        // 時間経過で成長（最大サイズまで）
        if (this.energy < this.maxEnergy) {
            this.energy += this.growthRate;
        }
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
            newX = constrain(newX, 0, width);
            newY = constrain(newY, 0, height);
            
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
        noStroke();
        // 成長度合いに応じてサイズと色が変わる
        let size = map(this.energy, 0, this.maxEnergy, 2, 12);
        let green = map(this.energy, 0, this.maxEnergy, 100, 255);
        fill(50, green, 50);
        ellipse(this.pos.x, this.pos.y, size);
    }
}
