export const TACTICAL_CONFIG = Object.freeze({
  dashSeconds: .18, dashCooldown: 4, dashSpeedMultiplier: 3,
  shieldCapacity: 30, killsPerDrop: 15, maxPickups: 24,
  killRewards: Object.freeze(['medkit', 'shield', 'magnet', 'overclock']),
  terminalRadius: 52, terminalSeconds: 2.5, terminalExperience: 6,
  completionExperience: 12, initialRerolls: 2, noticeSeconds: 3.5,
});

const terminals = entries => Object.freeze(entries.map(entry => Object.freeze(entry)));
export const EXPLORATION_CONFIG = Object.freeze({
  laboratory: terminals([
    { id: 'lab-a', name: '冷却阵列', x: 650, y: 390, reward: 'shield' },
    { id: 'lab-b', name: '样本档案', x: 1820, y: 420, reward: 'magnet' },
    { id: 'lab-c', name: '核心服务器', x: 1200, y: 1050, reward: 'overclock' },
  ]),
  'east-city': terminals([
    { id: 'city-a', name: '交通控制台', x: 850, y: 320, reward: 'shield' },
    { id: 'city-b', name: '广播终端', x: 1780, y: 940, reward: 'magnet' },
    { id: 'city-c', name: '疏散档案', x: 560, y: 1080, reward: 'overclock' },
  ]),
});
