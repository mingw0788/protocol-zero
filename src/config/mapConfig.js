import { WORLD_MAP } from './worldConfig.js';

export const MAP_CONFIGS = Object.freeze([
  Object.freeze({ ...WORLD_MAP, id: 'laboratory', name: '废弃科技实验室', theme: 'laboratory', supplies: false }),
  Object.freeze({ ...WORLD_MAP, id: 'east-city', name: '东城区疏散线', theme: 'city', supplies: true,
    backgroundColor: '#111b26', gridColor: '#1c2b38', borderColor: '#dcac55' }),
]);

export function getMapConfig(id) {
  return MAP_CONFIGS.find((map) => map.id === id) ?? null;
}
