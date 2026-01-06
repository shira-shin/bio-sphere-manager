import DNA from './dna.js';
import { STATES, WORLD_WIDTH, WORLD_HEIGHT, TERRAIN } from './constants.js';

export default class Animal {
    constructor(x, y, dna = null, generation = 1) {
        this.pos = createVector(x, y);
        this.dna = dna ? dna.copy() : new DNA(); // 親がいればコピー、いなければ新規

        this.generation = generation;

        // --- 遺伝子からの能力値反映 ---
        this.size = this.dna.genes.size * 10;
        this.maxSpeed = this.dna.genes.speed * 2;
        this.baseSensorRange = this.dna.genes.sense;
        this.sensorRange = this.baseSensorRange;
        this.nocturnal = !!this.dna.genes.nocturnal;
        this.coldTolerance = this.dna.genes.cold_tolerance;
        this.heatTolerance = this.dna.genes.heat_tolerance;
        this.waterDependency = this.dna.genes.water_dependency;
        this.optimalTemp = 22 + (this.heatTolerance - this.coldTolerance) * 8; // 快適温度

        // 肉食/草食の決定（閾値0.5）
        this.isCarnivore = this.dna.genes.aggression > 0.5;

        this.vel = p5.Vector.random2D();
        this.acc = createVector(0, 0);
        this.energy = 100;
        this.maxEnergy = 200 * this.dna.genes.size; // 体が大きいほどエネルギー容量大
        this.thirst = 0; // 渇き 0-200
        this.age = 0;
        this.dead = false;
        this.lastEnergy = this.energy;
        this.digestTimer = 0;

        // 待ち伏せフラグ
        this.isAmbushing = false;

        // 状態管理
        this.isSleeping = false;

        // エモート管理
        this.emote = "";
        this.emoteTimer = 0;
    }

    // エモート表示メソッド
    showEmote(icon, duration = 60) {
        this.emote = icon;
        this.emoteTimer = duration; // 1秒間表示が基準
    }

    update(env = { temperature: 22, humidity: 0.6, weather: 'clear', isNight: false, tile: null }) {
        if (!Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y)) {
            this.dead = true;
            return;
        }
        // --- 環境による移動と感覚の調整 ---
        const weather = env.weather || 'clear';
        const isNight = !!env.isNight;
        const nightVisionFactor = isNight && !this.nocturnal ? 0.5 : 1;
        const weatherVisionFactor = weather === 'storm' ? 0.25 : 1;
        const baseVision = this.baseSensorRange * nightVisionFactor * weatherVisionFactor;

        let speedFactor = 1;
        let metabolismFactor = 1;
        let visionFactor = 1;

        // 夜間の睡眠（昼行性のみ）
        if (isNight && !this.nocturnal) {
            if (!this.isSleeping && random() < 0.01) {
                this.isSleeping = true;
                this.showEmote("💤", 90);
            }
        } else if (this.isSleeping) {
            this.isSleeping = false;
        }

        // 肉食動物の空腹度に応じた行動モード
        if (this.isCarnivore) {
            const energyRatio = constrain(this.energy / this.maxEnergy, 0, 1);
            const canHide = (env.tile?.stealthValue || 0) >= 0.5;
            if (this.digestTimer > 0) {
                this.digestTimer--;
                speedFactor *= 0.35;
                metabolismFactor *= 0.35;
                this.isAmbushing = true;
            } else if (energyRatio > 0.65 && canHide) {
                // 満腹時は隠れて静止し、基礎代謝のみ
                speedFactor *= 0.1;
                metabolismFactor *= 0.25;
                this.isAmbushing = true;
                this.vel.mult(0.8);
                if (this.emoteTimer === 0) this.showEmote("🪤", 80);
            } else if (energyRatio > 0.3) {
                // 中空腹: 探索モード
                speedFactor *= 0.85;
                visionFactor *= 1.2;
                metabolismFactor *= 0.9;
                this.isAmbushing = false;
            } else {
                // 高空腹: 追跡スプリント / 待ち伏せ
                if (canHide) {
                    speedFactor *= 0.25;
                    metabolismFactor *= 0.6;
                    visionFactor *= 1.2;
                    this.isAmbushing = true;
                    this.vel.mult(0.5);
                    if (this.emoteTimer === 0) this.showEmote("👀", 60);
                } else {
                    speedFactor *= 2.0;
                    metabolismFactor *= 4.0;
                    visionFactor *= 0.95;
                    this.isAmbushing = false;
                }
            }
        }

        // 天候 + 地形による速度低下
        const currentTile = env.tile || TERRAIN.SAVANNA;
        if (weather === 'rain') speedFactor *= 0.7;
        if (weather === 'storm') speedFactor *= 0.5;
        if (this.isSleeping) speedFactor *= 0.2;

        const stealthDampening = 1 - (env.tile?.stealthValue || 0);
        this.sensorRange = baseVision * visionFactor * stealthDampening;

        // ... (移動ロジックは既存と同じ) ...
        this.vel.add(this.acc);
        // 地形摩擦を考慮した速度制限
        this.vel.limit(this.maxSpeed * speedFactor * currentTile.friction);
        // 氷は減速しづらい（慣性が残る）
        const inertia = currentTile.slippery ? 0.995 : 0.92;
        this.vel.mult(inertia);
        if (this.isSleeping) {
            this.vel.mult(0);
        }
        this.pos.add(this.vel);
        this.acc.mult(0);

        // 寿命とエネルギー消費
        this.age++;
        const speed = this.vel.mag();
        const terrainWeight = currentTile.energyCost || 1;
        const baseMetabolism = this.size * 0.02;
        const locomotionCost = speed * speed * terrainWeight * 0.15 * metabolismFactor;
        let cost = baseMetabolism * metabolismFactor + locomotionCost;
        if (this.isSleeping || this.isAmbushing) cost *= 0.25;
        this.energy -= cost;

        // --- 環境適応ロジック ---
        const tempDiff = env.temperature - this.optimalTemp;
        const tolerance = tempDiff > 0 ? this.heatTolerance : this.coldTolerance;
        const adjusted = Math.max(0, Math.abs(tempDiff) - tolerance * 5);
        const envDamage = 0.01 * adjusted * adjusted;
        if (envDamage > 0.05 && this.emoteTimer === 0) {
            this.energy -= envDamage;
            const icon = tempDiff > 0 ? "🥵" : tempDiff < 0 ? "🥶" : "💢";
            this.showEmote(icon, 45);
        } else if (envDamage > 0) {
            this.energy -= envDamage;
        }

        // 水分消費：乾燥や晴天で渇き上昇
        const dryness = 1 - constrain(env.humidity, 0, 1);
        const weatherBoost = env.weather === 'sunny' ? 1.4 : 1.0;
        this.thirst += dryness * this.waterDependency * 2 * weatherBoost;
        // 湿潤環境では少しずつ回復
        if (dryness < 0.2) {
            this.thirst -= (0.2 - dryness) * 2;
        }
        if (env.isNight && this.thirst > 20 && this.energy > 20 && this.emoteTimer === 0) {
            this.showEmote("💤", 90);
        }
        if (this.thirst > 100) {
            this.energy -= (this.thirst - 100) * 0.02;
        }
        this.thirst = constrain(this.thirst, 0, 200);

        if (this.energy <= 0) {
            this.dead = true;
            this.showEmote("💀", 120); // 餓死
        }

        // エモートタイマー
        if (this.emoteTimer > 0) this.emoteTimer--;

        // 食事などでエネルギーが増えた時のエモート
        if (this.energy > this.lastEnergy + 1 && this.emoteTimer === 0) {
            this.showEmote("🍖", 45);
        }
        this.lastEnergy = this.energy;

        // 岩場は通行不可: 位置を元に戻し、速度を反転させる
        if (!currentTile.passable && !this.isSleeping) {
            this.pos.sub(this.vel);
            this.vel.mult(-0.3);
        }

        this.edges();

        if (!Number.isFinite(this.vel.x) || !Number.isFinite(this.vel.y)) {
            this.dead = true;
            return;
        }
        if (this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) {
            this.dead = true;
        }
    }

    interact(other) {
        // 喧嘩・捕食判定
        if (this.isCarnivore && !other.isCarnivore) {
            // 捕食
            if (p5.Vector.dist(this.pos, other.pos) < this.size) {
                this.showEmote("⚔️", 45);
                const preyEnergy = other.size * 150;
                this.energy = Math.min(this.maxEnergy, this.energy + preyEnergy);
                this.digestTimer = Math.max(this.digestTimer, 600);
                other.dead = true;
                other.showEmote("💀");
                this.showEmote("🍖", 120); // ごちそう
            }
        } else if (this.isCarnivore && other.isCarnivore) {
            // 縄張り争い（喧嘩）
            if (p5.Vector.dist(this.pos, other.pos) < this.size) {
                this.showEmote("⚔️", 45);
                other.showEmote("⚔️", 45);
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
            return new Animal(this.pos.x, this.pos.y, this.dna, this.generation + 1); // DNAを引き継ぐ
        }
        return null;
    }

    draw(zoomLevel = 1) {
        if (this.pos.x < 0 || this.pos.x > WORLD_WIDTH || this.pos.y < 0 || this.pos.y > WORLD_HEIGHT) return;
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

        // エモート描画 (低ズーム時はスキップ)
        if (zoomLevel > 0.85) {
            const mouseAvailable = typeof mouseX !== 'undefined' && typeof mouseY !== 'undefined';
            const mouseDist = mouseAvailable ? dist(mouseX, mouseY, this.pos.x, this.pos.y) : Infinity;
            const showEmote = this.emoteTimer > 0 && (mouseDist <= 80 || zoomLevel > 1.2);
            if (showEmote) {
                const bubbleSize = Math.max(10, this.size * 0.9);
                push();
                noStroke();
                fill(255, 240);
                ellipse(0, -this.size * 0.9, bubbleSize);
                if (zoomLevel > 1.25) {
                    textSize(18);
                    textAlign(CENTER, CENTER);
                    fill(30);
                    text(this.emote, 0, -this.size * 0.9);
                }
                pop();
            }
        }

        pop();
        colorMode(RGB);
    }
    
    applyForce(force) { this.acc.add(force); }
    edges() {
        // 画面端処理: 反射 + 反発で壁張り付き防止
        const restitution = 0.9;
        const push = 0.2;
        if (this.pos.x < 0) {
            this.pos.x = push;
            this.vel.x *= -restitution;
        } else if (this.pos.x > WORLD_WIDTH) {
            this.pos.x = WORLD_WIDTH - push;
            this.vel.x *= -restitution;
        }

        if (this.pos.y < 0) {
            this.pos.y = push;
            this.vel.y *= -restitution;
        } else if (this.pos.y > WORLD_HEIGHT) {
            this.pos.y = WORLD_HEIGHT - push;
            this.vel.y *= -restitution;
        }
    }
}
