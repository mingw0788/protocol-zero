const ENEMY_WEIGHTS = Object.freeze({
  opening: Object.freeze({ 'EN-01': 1, 'EN-02': 0, 'EN-03': 0 }),
  swiftIntro: Object.freeze({ 'EN-01': 0.75, 'EN-02': 0.25, 'EN-03': 0 }),
  heavyIntro: Object.freeze({ 'EN-01': 0.6, 'EN-02': 0.25, 'EN-03': 0.15 }),
  mixedPressure: Object.freeze({ 'EN-01': 0.5, 'EN-02': 0.32, 'EN-03': 0.18 }),
  highPressure: Object.freeze({ 'EN-01': 0.45, 'EN-02': 0.35, 'EN-03': 0.2 }),
});

function phase(phaseId, startSeconds, endSeconds, spawnIntervalSeconds, enemyWeights) {
  return Object.freeze({
    phaseId,
    startSeconds,
    endSeconds,
    spawnIntervalSeconds,
    enemyWeights,
  });
}

export const WAVE_CONFIG = Object.freeze({
  phases: Object.freeze([
    phase('opening', 0, 60, 1, ENEMY_WEIGHTS.opening),
    phase('swift-intro', 60, 120, 0.9, ENEMY_WEIGHTS.swiftIntro),
    phase('heavy-intro', 120, 180, 0.8, ENEMY_WEIGHTS.heavyIntro),
    phase('mixed-pressure', 180, 240, 0.65, ENEMY_WEIGHTS.mixedPressure),
    phase('high-pressure', 240, 270, 0.55, ENEMY_WEIGHTS.highPressure),
    phase('boss-approach', 270, null, 0.55, ENEMY_WEIGHTS.highPressure),
  ]),
});
