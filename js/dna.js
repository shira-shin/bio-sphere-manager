export default class DNA {
    constructor(genes) {
        if (genes) {
            this.genes = genes;
        } else {
            // 初期アダム・イブの遺伝子（ランダム）
            this.genes = {
                size: random(0.5, 1.5),        // 体の大きさ
                speed: random(0.8, 1.5),       // 移動速度
                sense: random(50, 150),        // 視界範囲
                color: random(0, 360),         // 体色（色相）
                aggression: random(0, 1),      // 攻撃性（0:草食, 1:肉食）
                fertility: random(0.5, 1.0),   // 繁殖しやすさ
                cold_tolerance: random(0, 1),  // 低温への強さ
                heat_tolerance: random(0, 1),  // 高温への強さ
                water_dependency: random(0.3, 1.2) // 水依存度（低いほど乾燥に強い）
            };
        }
    }

    // 交叉と突然変異（親の遺伝子をベースに少しずらす）
    copy() {
        let newGenes = { ...this.genes };
        const mutationRate = 0.2; // 20%の確率で大きく変化
        const drift = 0.18;       // 通常の微細な変化量を強める

        for (let key in newGenes) {
            // 微細な変化（ドリフト）
            newGenes[key] += random(-drift, drift);

            // 突然変異（大幅な変化）
            if (random() < mutationRate) {
                newGenes[key] += random(-drift * 6, drift * 6);
            }
        }

        // 値の正規化（ありえない数値にならないように）
        newGenes.size = constrain(newGenes.size, 0.4, 3.0);
        newGenes.speed = constrain(newGenes.speed, 0.5, 3.0);
        newGenes.color = (newGenes.color + 360) % 360; // 色相環ループ
        newGenes.aggression = constrain(newGenes.aggression, 0, 1);
        newGenes.cold_tolerance = constrain(newGenes.cold_tolerance, 0, 1.5);
        newGenes.heat_tolerance = constrain(newGenes.heat_tolerance, 0, 1.5);
        newGenes.water_dependency = constrain(newGenes.water_dependency, 0.1, 1.5);

        return new DNA(newGenes);
    }
}
