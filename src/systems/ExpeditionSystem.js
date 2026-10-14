import { CAMPAIGN_STAGES, getJourney, getDifficulty, getCharacter, getEquipmentModule } from '../config/expeditionConfig.js';

export class ExpeditionSystem {
  #journeyId = 'survival'; #difficultyId = 'normal'; #characterId = 'zero';
  #stageIndex = 0; #completed = []; #modules = [null, null]; #intermission = false;
  configure({ journeyId = this.#journeyId, difficultyId = this.#difficultyId, characterId = this.#characterId } = {}) {
    if (!getJourney(journeyId) || !getDifficulty(difficultyId) || !getCharacter(characterId)) return false;
    this.#journeyId = journeyId; this.#difficultyId = difficultyId; this.#characterId = characterId;
    this.reset(); return true;
  }
  get campaign() { return this.#journeyId === 'campaign'; }
  get difficulty() { return getDifficulty(this.#difficultyId); }
  get character() { return getCharacter(this.#characterId); }
  get stage() { return this.campaign ? CAMPAIGN_STAGES[this.#stageIndex] : Object.freeze({ name: '五分钟生存', durationSeconds: 300, bossTime: 270, bossHp: 1800, hpMultiplier: 1, intervalMultiplier: 1, damageMultiplier: 1 }); }
  get moduleModifiers() {
    const items = this.#modules.filter(Boolean).map(getEquipmentModule);
    return Object.freeze({ damageMultiplier: 1 + items.reduce((sum, item) => sum + item.damageBonus, 0),
      moveMultiplier: 1 + items.reduce((sum, item) => sum + item.moveBonus, 0), hpBonus: items.reduce((sum, item) => sum + item.hpBonus, 0) });
  }
  completeStage(elapsedSeconds) {
    if (this.#completed.length !== this.#stageIndex || !Number.isFinite(elapsedSeconds) || elapsedSeconds < this.stage.durationSeconds) return false;
    this.#completed.push(Object.freeze({ index: this.#stageIndex + 1, name: this.stage.name, elapsedSeconds }));
    this.#intermission = this.campaign && this.#stageIndex < 2; return true;
  }
  advance(moduleId) {
    if (!this.#intermission || !getEquipmentModule(moduleId)) return false;
    this.#modules[this.#stageIndex] = moduleId; this.#stageIndex++; this.#intermission = false; return true;
  }
  getSnapshot(elapsedSeconds = 0) {
    const closedStage = this.#completed.length > this.#stageIndex;
    return Object.freeze({ journeyId: this.#journeyId, journeyName: getJourney(this.#journeyId).name,
      difficultyId: this.#difficultyId, difficultyName: this.difficulty.name, characterId: this.#characterId, characterName: this.character.name,
      stage: this.stage, stageIndex: this.#stageIndex + 1, stageCount: this.campaign ? 3 : 1, completed: this.#completed.length,
      intermission: this.#intermission, completedStages: Object.freeze([...this.#completed]), modules: Object.freeze([...this.#modules]),
      totalElapsedSeconds: this.#completed.reduce((sum, item) => sum + item.elapsedSeconds, 0) + (closedStage ? 0 : elapsedSeconds) });
  }
  reset() { this.#stageIndex = 0; this.#completed = []; this.#modules = [null, null]; this.#intermission = false; }
}
