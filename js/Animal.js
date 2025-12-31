import { STATES } from './constants.js';

export default class Animal {
    constructor(x, y, dna = null) {
        // --- 【修正1】 角湧き・NaN防止の防衛的初期化 ---
        if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
            console.warn("Invalid spawn detected. Relocating.");
            this.pos = createVector(random(width), random(height));
        } else {
            this.pos = createVector(x, y);
        }

        this.vel = p5.Vector.random2D();
        this.acc = createVector(0, 0);
        this.maxSpeed = 2;
        this.maxForce = 0.1;

        // 生体パラメータ
        this.thirst = 0; // 喉の渇き (0-100)
        this.energy = 100;
        
        // 思考・行動状態 (FSM)
        this.state = STATES.WANDER; 
        
        // DNA（今回は簡易化）
        this.dna = dna || {
            senseRadius: random(50, 100),
            waterSense: random(0.5, 1.5)
        };
    }

    // 毎フレームの思考プロセス
    think(world) {
        // --- 【修正2】 FSMによる明確な行動切り替え（振動防止） ---
        
        // 1. 状態遷移ロジック
        if (this.thirst > 70) {
            this.state = STATES.SEEK_WATER;
        } else if (this.thirst < 10) {
            this.state = STATES.WANDER;
        }

        // 2. 状態ごとの行動実行
        switch (this.state) {
            case STATES.SEEK_WATER:
                const water = world.findNearestWater(this.pos, this.dna.senseRadius);
                if (water) {
                    this.seek(water); // 水へ一直線（他者との衝突回避より優先度高）
                    // 水に到達したら飲む
                    if (p5.Vector.dist(this.pos, water) < 10) {
                        this.state = STATES.DRINKING;
                    }
                } else {
                    this.state = STATES.WANDER; // 水が見つからないなら探す
                    this.wander();
                }
                break;

            case STATES.DRINKING:
                this.vel.mult(0); // 止まる
                this.thirst -= 2; // 回復
                if (this.thirst <= 0) this.state = STATES.WANDER;
                break;

            case STATES.WANDER:
            default:
                this.wander();
                // 余裕がある時だけ、少しだけ他者を避ける（separation）
                this.separate(world.animals); 
                break;
        }

        // 生体活動
        this.thirst += 0.1;
    }

    applyForce(force) {
        this.acc.add(force);
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.maxSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0); // 加速度リセット

        // --- 【修正1-b】 移動後のNaN/画面外チェック ---
        if (Number.isNaN(this.pos.x) || Number.isNaN(this.pos.y)) {
            this.pos = createVector(random(width), random(height));
            this.vel = p5.Vector.random2D();
        }
        
        // 画面端ループ
        if (this.pos.x > width) this.pos.x = 0;
        if (this.pos.x < 0) this.pos.x = width;
        if (this.pos.y > height) this.pos.y = 0;
        if (this.pos.y < 0) this.pos.y = height;
    }

    // 基本行動：探索
    wander() {
        // ランダムウォークの簡易実装
        let wanderPoint = this.vel.copy();
        wanderPoint.setMag(50);
        wanderPoint.add(this.pos);
        let theta = random(-0.5, 0.5); 
        let radius = 20;
        let x = radius * cos(theta);
        let y = radius * sin(theta);
        wanderPoint.add(x, y);
        let steer = wanderPoint.sub(this.pos);
        steer.setMag(this.maxForce);
        this.applyForce(steer);
    }

    // 基本行動：追跡
    seek(target) {
        let desired = p5.Vector.sub(target, this.pos);
        desired.setMag(this.maxSpeed);
        let steer = p5.Vector.sub(desired, this.vel);
        steer.limit(this.maxForce * 2); // 必死に水に向かうため力強め
        this.applyForce(steer);
    }

    // 分離（仲間とぶつからない）
    separate(animals) {
        let desiredSeparation = 15;
        let sum = createVector(0,0);
        let count = 0;
        for (let other of animals) {
            let d = p5.Vector.dist(this.pos, other.pos);
            if ((d > 0) && (d < desiredSeparation)) {
                let diff = p5.Vector.sub(this.pos, other.pos);
                diff.normalize();
                diff.div(d);
                sum.add(diff);
                count++;
            }
        }
        if (count > 0) {
            sum.div(count);
            sum.setMag(this.maxSpeed);
            let steer = p5.Vector.sub(sum, this.vel);
            steer.limit(this.maxForce);
            this.applyForce(steer);
        }
    }

    draw() {
        push();
        translate(this.pos.x, this.pos.y);
        noStroke();
        // 状態によって色を変える（デバッグ用）
        if (this.state === STATES.SEEK_WATER) fill(0, 0, 255); // 青：水探し
        else if (this.state === STATES.DRINKING) fill(0, 255, 255); // 水色：飲水中
        else fill(255, 100, 100); // 赤：通常
        
        ellipse(0, 0, 8, 8);
        pop();
    }
}
