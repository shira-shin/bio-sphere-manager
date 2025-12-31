export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
    if (inMax - inMin === 0) return outMin;
    const t = (value - inMin) / (inMax - inMin);
    return outMin + (outMax - outMin) * t;
}

export function randomVector(magnitude = 1) {
    const angle = Math.random() * Math.PI * 2;
    return {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude
    };
}
