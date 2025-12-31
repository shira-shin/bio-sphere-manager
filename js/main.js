import Animal from './Animal.js';
import World from './World.js';

let world;
let animals = [];
const POPULATION = 100;

// p5.js のグローバル関数を window オブジェクトに紐付ける
window.setup = function() {
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent('canvas-container');
    
    world = new World();
    world.init();

    // 動物生成
    for (let i = 0; i < POPULATION; i++) {
        // 完全にランダムな位置に配置
        animals.push(new Animal(random(width), random(height)));
    }
    
    // Worldに参照を渡す（相互参照が必要な場合）
    world.animals = animals;
};

window.draw = function() {
    background(20);
    
    // 1. 環境描画
    world.draw();

    // 2. 動物の更新と描画
    for (let animal of animals) {
        animal.think(world); // 思考 (FSM)
        animal.update();     // 物理演算
        animal.draw();       // 描画
    }
    
    // UI表示（デバッグ用）
    fill(255);
    text(`FPS: ${Math.floor(frameRate())}`, 10, 20);
    text(`Animals: ${animals.length}`, 10, 40);
};

window.windowResized = function() {
    resizeCanvas(windowWidth, windowHeight);
    world.init(); // グリッド再計算
};
