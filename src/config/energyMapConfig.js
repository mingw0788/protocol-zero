const freezeList = entries => Object.freeze(entries.map(entry => Object.freeze(entry)));
function layout(id, name, zones, terminals, index) {
  return Object.freeze({ id, name,
    zones: freezeList(zones.map(([x, y, width, height], i) => ({ id: `arc-${'abc'[i]}`, name: ['西侧电弧走廊', '控制电弧走廊', '东侧电弧走廊'][i], x, y, width, height, offset: i * 3 }))),
    terminals: freezeList(terminals.map(([x, y], i) => ({ id: `hub-${i}`, name: ['冷却阀终端', '主控断路器', '变电作业台'][i],
      x, y, disableZone: `arc-${'abc'[i]}`, reward: ['relay-cell', 'relay-amplifier', 'healing-field'][i] }))),
    landmarks: freezeList(terminals.map(([x, y], i) => ({ x, y, kind: ['cooling', 'control', 'transformer'][i] }))),
    eventAnchors: freezeList([[200, 200], [2200, 200], [200, 1150], [2200, 1150], [200, 700], [2200, 700]].map(([x, y]) => ({ x, y }))),
    barrels: freezeList([[350, 850], [400, 850], [930, 120], [1450, 1180], [2020, 900], [2070, 900]].map(([x, y], i) => ({ id: `hub-cap-${i}`, x: x + index * 20, y }))),
    relays: freezeList([{ id: 'reactor', name: '中央反应堆', effect: 'reactor', x: 1200, y: 675, initialEnergy: 0,
      channelSeconds: 2.5, pulseRadius: 300, damage: 100, bossDamage: 50, energyRadius: 340, healing: 0 }]),
  });
}
export const ENERGY_LAYOUTS = Object.freeze([
  layout('hub-a', '冷却检修布局', [[600, 340, 180, 600], [1110, 100, 180, 330], [1620, 340, 180, 600]], [[420, 640], [1200, 520], [1980, 640]], 0),
  layout('hub-b', '北环输电布局', [[480, 300, 180, 650], [1000, 100, 400, 140], [1740, 380, 180, 600]], [[340, 600], [1200, 320], [2070, 700]], 1),
  layout('hub-c', '南环应急布局', [[620, 200, 160, 580], [1010, 1050, 380, 140], [1630, 450, 160, 650]], [[440, 480], [1200, 1270], [1980, 900]], 2),
]);
