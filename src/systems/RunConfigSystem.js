import { getRunMode, getProtocol, getChallenge, createRecordKey } from '../config/runConfig.js';
export class RunConfigSystem {
  #modeId = 'standard'; #protocolId = 'standard'; #challengeId = 'none';
  set({ modeId = this.#modeId, protocolId = this.#protocolId, challengeId = this.#challengeId } = {}) {
    if (!getRunMode(modeId) || !getProtocol(protocolId) || !getChallenge(challengeId)) return false;
    this.#modeId = modeId; this.#protocolId = protocolId; this.#challengeId = challengeId; return true;
  }
  get protocol() { return getProtocol(this.#protocolId); }
  get challenge() { return getChallenge(this.#challengeId); }
  getSnapshot(mapId = 'laboratory') {
    const mode = getRunMode(this.#modeId);
    return Object.freeze({ mapId, modeId: mode.id, modeName: mode.name, weaponLimit: mode.weaponLimit,
      protocolId: this.#protocolId, protocolName: this.protocol.name, challengeId: this.#challengeId,
      challengeName: this.challenge.name, recordKey: createRecordKey({ mapId, modeId: this.#modeId, protocolId: this.#protocolId, challengeId: this.#challengeId }) });
  }
}
