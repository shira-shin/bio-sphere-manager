import { STATES, TILE_SIZE } from './constants.js';

export default class Animal {
    constructor(x, y, dna = null, generation = 1) {
        this.pos = createVector(x, y);
        this.vel = p5.Vector.random2D();
        this.acc = createVector(0, 0);

        // --- 1. 遺伝子 (DNA) の定義 ---
        // 親がいれば遺伝＋変異、いなければランダム生成
        this.dna = dna ? this.mutate(dna) : {
            size: random(0.5, 1.5),         // 体の大きさ
            speed: random(0.8, 1.2),        // 足の速さ
            sensor: random(50, 150),        // 視界の広さ
            colorHue: random(0, 100),       // 種の色相 (0-360)
            aggression: random(0, 1),       // 攻撃性（肉食度）
            metabolism: random(0.8, 1.2)    // 代謝率（燃費）
        };

        this.generation = generation;
        
        // --- 2. 生体パラメータ (DNAに基づく) ---
        this.maxSpeed = 2 * this.dna.speed;
        this.maxForce = 0.1;
        this.r = 5 * this.dna.size; // 半径
        
        // 寿命システム (DNAによって寿命が変わる：体が大きいと長生きだが燃費が悪い等)
        this.lifespan = 2000 * (this.dna.size); 
        this.age = 0;

        this.energy = 100;
        this.reproCooldown = 0;
        
        // 状態とエモート
        this.state = STATES.WANDER;
        this.emote = null;      // "❤️", "🍖", "💀" などのアイコン
        this.emoteTimer = 0;
    }

    // 遺伝子の変異ロジック
    mutate(parentDNA) {
        const mutationRate = 0.1; // 変異率
        let newDNA = { ...parentDNA }; // コピー

        // 各遺伝子にわずかな揺らぎを与える
        if (random() < mutationRate) newDNA.size += random(-0.1, 0.1);
        if (random() < mutationRate) newDNA.speed += random(-0.1, 0.1);
        if (random() < mutationRate) newDNA.colorHue += random(-10, 10); // 色が少し変わる
        
        // 値の制限（Clamp）
        newDNA.size = constrain(newDNA.size, 0.5, 2.0);
        newDNA.colorHue = (newDNA.colorHue + 360) % 360; // 色相環ループ

        return newDNA;
    }

    think(world) {
        // ... (既存のFSMロジック。変更なし) ...
        
        // 追加: 寿命による死
        this.age++;
        this.lifespan--;
        this.energy -= (0.1 * this.dna.size * this.dna.speed * this.dna.metabolism); // 燃費計算

        // 餓死または老衰
        if (this.energy <= 0 || this.lifespan <= 0) {
            this.dead = true; // 削除フラグ
            this.showEmote("💀");
        }
    }

    // エモート表示機能
    showEmote(symbol) {
        this.emote = symbol;
        this.emoteTimer = 60; // 60フレーム表示
    }

    // ... (update, applyForce等は既存のまま) ...
    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
        
        if (this.reproCooldown > 0) this.reproCooldown--;
        if (this.emoteTimer > 0) this.emoteTimer--;

        // 画面端処理
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.y > height) this.pos.y = 0;
        if (this.pos.y < 0) this.pos.y = height;
    }

    // --- 3. ビジュアル進化描画 (Procedural Drawing) ---
    draw() {
        push();
        translate(this.pos.x, this.pos.y);
        
        // DNAに基づく色設定 (HSBモード推奨)
        colorMode(HSB, 360, 100, 100);
        
        // 肉食傾向が強いと彩度が高く、草食だと低い、などの表現
        let saturation = map(this.dna.aggression, 0, 1, 40, 100);
        fill(this.dna.colorHue, saturation, 90);
        noStroke();

        // DNAに基づく形状変化
        // 攻撃性が高い＝三角形、低い＝円
        if (this.dna.aggression > 0.6) {
            // 三角形（肉食系）
            rotate(this.vel.heading() + PI/2);
            triangle(0, -this.r*1.5, -this.r, this.r, this.r, this.r);
        } else {
            // 円（草食系）
            // スピードが速い個体は細長くなる
            rotate(this.vel.heading());
            ellipse(0, 0, this.r * 2 * (1 + this.dna.speed/2), this.r * 2 / this.dna.speed);
        }

        // 視界（センサー）の描画（デバッグ用または選択時のみ）
        // noFill();
        // stroke(0, 0, 100, 0.2);
        // ellipse(0, 0, this.dna.sensor * 2);

        // エモート表示
        if (this.emoteTimer > 0 && this.emote) {
            fill(0, 0, 100);
            textSize(10);
            textAlign(CENTER);
            text(this.emote, 0, -this.r - 5);
        }

        pop();
        colorMode(RGB); // 戻す
    }
}

