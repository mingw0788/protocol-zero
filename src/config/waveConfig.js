const ENEMY_WEIGHTS = Object.freeze({
  opening: Object.freeze({ 'EN-01': 1, 'EN-02': 0, 'EN-03': 0 }),
  swiftIntro: Object.freeze({ 'EN-01': .58, 'EN-02': .25, 'EN-03': 0, 'EN-04': .17, 'EN-05': 0, 'EN-06': 0 }),
  heavyIntro: Object.freeze({ 'EN-01': .4, 'EN-02': .22, 'EN-03': .16, 'EN-04': .1, 'EN-05': .1, 'EN-06': .02 }),
  mixedPressure: Object.freeze({ 'EN-01': .32, 'EN-02': .25, 'EN-03': .18, 'EN-04': .12, 'EN-05': .1, 'EN-06': .03 }),
  highPressure: Object.freeze({ 'EN-01': .25, 'EN-02': .28, 'EN-03': .2, 'EN-04': .13, 'EN-05': .1, 'EN-06': .04 }),
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
