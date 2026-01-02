import DNA from './dna.js';
import { STATES } from './constants.js';

export default class Animal {
    constructor(x, y, dna = null) {
        this.pos = createVector(x, y);
        this.dna = dna ? dna.copy() : new DNA(); // 親がいればコピー、いなければ新規
        
        // --- 遺伝子からの能力値反映 ---
        this.size = this.dna.genes.size * 10;
        this.maxSpeed = this.dna.genes.speed * 2;
        this.sensorRange = this.dna.genes.sense;
        
        // 肉食/草食の決定（閾値0.5）
        this.isCarnivore = this.dna.genes.aggression > 0.5;

        this.vel = p5.Vector.random2D();
        this.acc = createVector(0, 0);
        this.energy = 100;
        this.maxEnergy = 200 * this.dna.genes.size; // 体が大きいほどエネルギー容量大
        this.age = 0;
        this.dead = false;
        
        // エモート管理
        this.emote = "";
        this.emoteTimer = 0;
    }

    // エモート表示メソッド
    showEmote(icon) {
        this.emote = icon;
        this.emoteTimer = 60; // 1秒間表示
    }

    update() {
        // ... (移動ロジックは既存と同じ) ...
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);

        // 寿命とエネルギー消費
        this.age++;
        // 代謝コスト：体が大きく、速いほど燃費が悪い（リアルな制約）
        let cost = (this.size * this.size * this.maxSpeed) * 0.001; 
        this.energy -= cost;

        if (this.energy <= 0) {
            this.dead = true;
            this.showEmote("💀"); // 餓死
        }
        
        // エモートタイマー
        if (this.emoteTimer > 0) this.emoteTimer--;
        
        this.edges();
    }

    interact(other) {
        // 喧嘩・捕食判定
        if (this.isCarnivore && !other.isCarnivore) {
            // 捕食
            if (p5.Vector.dist(this.pos, other.pos) < this.size) {
                this.energy += other.energy * 0.8; // 食べる
                other.dead = true;
                other.showEmote("💀");
                this.showEmote("🍖"); // ごちそう
            }
        } else if (this.isCarnivore && other.isCarnivore) {
            // 縄張り争い（喧嘩）
            if (p5.Vector.dist(this.pos, other.pos) < this.size) {
                this.showEmote("⚔️"); 
                other.showEmote("⚔️");
                // 弱い方が弾き飛ばされる簡易処理
                let force = p5.Vector.sub(this.pos, other.pos).setMag(5);
                this.applyForce(force);
            }
        }
    }

    reproduce() {
        // エネルギーチェック
        if (this.energy > this.maxEnergy * 0.6) {
            this.energy *= 0.5; // 出産コスト
            this.showEmote("❤️");
            return new Animal(this.pos.x, this.pos.y, this.dna); // DNAを引き継ぐ
        }
        return null;
    }

    draw() {
        push();
        translate(this.pos.x, this.pos.y);
        
        // 遺伝子の色を反映 (HSBモード)
        colorMode(HSB, 360, 100, 100);
        fill(this.dna.genes.color, 80, 90);
        noStroke();

        // 形の描画（肉食はトゲトゲ、草食は丸）
        if (this.isCarnivore) {
            // 三角形
            rotate(this.vel.heading() + PI/2);
            triangle(0, -this.size, -this.size/2, this.size/2, this.size/2, this.size/2);
        } else {
            // 円
            ellipse(0, 0, this.size, this.size);
        }

        // エモート描画
        if (this.emoteTimer > 0) {
            textSize(15);
            textAlign(CENTER);
            text(this.emote, 0, -this.size - 5);
        }

        pop();
        colorMode(RGB);
    }
    
    applyForce(force) { this.acc.add(force); }
    edges() { /* 画面端処理 */ }
}
