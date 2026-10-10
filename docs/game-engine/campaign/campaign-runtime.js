(function (root, factory) {
  const api = factory(root.TokiPonaCampaignValidator);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TokiPonaCampaignRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Validator) {
  'use strict';

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function reqMet(req, s) {
    if (Validator && Validator.reqMet) return Validator.reqMet(req, s);
    for (const g of (req && req.glyphs) || []) if (!s.glyphs.has(g)) return false;
    for (const p of (req && req.solvedPuzzles) || []) if (!s.solved.has(p)) return false;
    for (const [k,v] of Object.entries((req && req.states) || {})) if (s.world[k] !== v) return false;
    return true;
  }

  class CampaignRuntime {
    constructor(campaign, persisted) {
      this.campaign = campaign;
      this.levelIndex = new Map(campaign.levels.map(x => [x.id, x]));
      this.baselineGlyphs = new Set(campaign.baselineGlyphs || []);
      this.globalGlyphs = new Set([...(campaign.baselineGlyphs || []), ...((persisted && persisted.globalGlyphs) || [])]);
      this.levelStates = clone((persisted && persisted.levelStates) || {});
      this.currentLevelId = (persisted && persisted.currentLevelId) || (campaign.levels[0] && campaign.levels[0].id);
      this.currentArea = (persisted && persisted.currentArea) || null;
      this.ensureLevelState(this.currentLevelId);
    }

    ensureLevelState(levelId) {
      const level = this.levelIndex.get(levelId);
      if (!level) throw new Error(`Unknown level ${levelId}`);
      if (!this.levelStates[levelId]) {
        this.levelStates[levelId] = { solvedPuzzles:[], world:clone(level.initialStates), completed:false };
      }
      const ls = this.levelStates[levelId];
      if (!this.currentArea && levelId === this.currentLevelId) this.currentArea = level.startArea;
      this.applyAlreadyOwned(levelId);
      return ls;
    }

    snapshot() {
      return {
        currentLevelId:this.currentLevelId,
        currentArea:this.currentArea,
        globalGlyphs:[...this.globalGlyphs],
        levelStates:clone(this.levelStates)
      };
    }

    level() { return this.levelIndex.get(this.currentLevelId); }
    levelState() { return this.ensureLevelState(this.currentLevelId); }
    solvedSet(levelId) { return new Set(this.ensureLevelState(levelId || this.currentLevelId).solvedPuzzles); }
    stateView(levelId) {
      const id = levelId || this.currentLevelId;
      const ls = this.ensureLevelState(id);
      return { area:this.currentArea, glyphs:this.globalGlyphs, solved:new Set(ls.solvedPuzzles), world:ls.world };
    }

    applyAlreadyOwned(levelId) {
      const level = this.levelIndex.get(levelId);
      const ls = this.levelStates[levelId];
      const solved = new Set(ls.solvedPuzzles);
      let changed = true;
      while (changed) {
        changed = false;
        for (const p of level.puzzles) {
          if (!p.skipIfRewardsOwned || !p.skipSafe || p.storyCritical || solved.has(p.id)) continue;
          const gs = p.rewards.glyphs || [];
          if (!gs.length || !gs.every(g => this.globalGlyphs.has(g))) continue;
          solved.add(p.id);
          for (const [k,v] of Object.entries((p.alreadyOwnedEffects && p.alreadyOwnedEffects.setStates) || {})) ls.world[k] = v;
          changed = true;
        }
      }
      ls.solvedPuzzles = [...solved];
    }

    availableConnections() {
      const level = this.level();
      const s = this.stateView();
      const out = [];
      for (const c of level.connections) {
        if (!reqMet(c.requirements, s)) continue;
        if (c.from === this.currentArea) out.push({ connection:c, target:c.to });
        else if (c.bidirectional && c.to === this.currentArea) out.push({ connection:c, target:c.from });
      }
      return out;
    }

    move(connectionId) {
      const item = this.availableConnections().find(x => x.connection.id === connectionId);
      if (!item) return { ok:false, reason:'connection-unavailable' };
      this.currentArea = item.target;
      return { ok:true, area:this.currentArea };
    }

    availablePuzzles() {
      const level = this.level();
      const s = this.stateView();
      return level.puzzles.filter(p => p.area === this.currentArea && !s.solved.has(p.id) && reqMet(p.requirements, s));
    }

    puzzle(puzzleId) { return this.level().puzzles.find(p => p.id === puzzleId) || null; }

    startLevel(levelId, options) {
      const opts = Object.assign({ requireCurrentComplete:true }, options || {});
      const target = this.levelIndex.get(levelId);
      if (!target) return { ok:false, reason:'unknown-level' };
      const current = this.level();
      if (opts.requireCurrentComplete && current && target.ordinal > current.ordinal && !this.isLevelComplete()) {
        return { ok:false, reason:'current-level-incomplete' };
      }
      if (current && this.isLevelComplete()) this.levelState().completed = true;
      this.currentLevelId = levelId;
      this.currentArea = target.startArea;
      this.ensureLevelState(levelId);
      this.applyAlreadyOwned(levelId);
      return { ok:true, levelId, area:this.currentArea };
    }

    nextLevel() {
      const current = this.level();
      if (!current) return null;
      const levels = [...this.campaign.levels].sort((a,b) => a.ordinal - b.ordinal);
      const index = levels.findIndex(level => level.id === current.id);
      return index >= 0 ? (levels[index + 1] || null) : null;
    }

    completePuzzle(puzzleId) {
      const p = this.puzzle(puzzleId);
      if (!p) return { ok:false, reason:'unknown-puzzle' };
      const s = this.stateView();
      if (p.area !== this.currentArea) return { ok:false, reason:'wrong-area' };
      if (s.solved.has(p.id)) return { ok:true, alreadySolved:true, awarded:[] };
      if (!reqMet(p.requirements, s)) return { ok:false, reason:'requirements-not-met' };
      const ls = this.levelState();
      const solved = new Set(ls.solvedPuzzles); solved.add(p.id); ls.solvedPuzzles = [...solved];
      const awarded = [];
      for (const g of p.rewards.glyphs || []) if (!this.globalGlyphs.has(g)) { this.globalGlyphs.add(g); awarded.push(g); }
      for (const [k,v] of Object.entries(p.rewards.setStates || {})) ls.world[k] = v;
      this.applyAlreadyOwned(this.currentLevelId);
      return { ok:true, awarded, worldChanges:clone(p.rewards.setStates || {}), levelComplete:this.isLevelComplete() };
    }

    isLevelComplete() {
      const level = this.level();
      const s = this.stateView();
      if (level.completion.exitArea && this.currentArea !== level.completion.exitArea) return false;
      if (!reqMet(level.completion.requirements, s)) return false;
      return level.canonicalGlyphs.every(g => this.globalGlyphs.has(g));
    }

    objectiveSummary() {
      const level = this.level();
      const available = this.availablePuzzles();
      if (this.isLevelComplete()) return 'Level complete.';
      if (available.length) return available[0].ui.title || available[0].id;
      const moves = this.availableConnections();
      if (moves.length) return `Explore: ${moves.map(x => this.level().areas.find(a => a.id === x.target)?.name || x.target).join(' / ')}`;
      return 'No productive action is currently available.';
    }
  }

  return { CampaignRuntime };
});
