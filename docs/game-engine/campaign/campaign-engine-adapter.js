(function (root) {
  'use strict';

  function createAdapter(options) {
    const opts = options || {};
    const campaign = opts.campaign || root.TOKI_PONA_CAMPAIGN;
    const RuntimeCtor = root.TokiPonaCampaignRuntime && root.TokiPonaCampaignRuntime.CampaignRuntime;
    if (!campaign) throw new Error('No campaign manifest loaded.');
    if (!RuntimeCtor) throw new Error('campaign-runtime.js must be loaded first.');
    const runtime = new RuntimeCtor(campaign, opts.persisted || null);

    return {
      runtime,
      currentLevel() { return runtime.level(); },
      currentArea() { return runtime.currentArea; },
      currentAreaDescriptor() { return runtime.level().areas.find(a => a.id === runtime.currentArea) || null; },
      availablePuzzles() { return runtime.availablePuzzles(); },
      availableConnections() { return runtime.availableConnections(); },
      objective() { return runtime.objectiveSummary(); },
      openPuzzle(puzzleId) {
        const puzzle = runtime.puzzle(puzzleId);
        if (!puzzle) return { ok:false, reason:'unknown-puzzle' };
        const detail = { puzzle, runtime, complete:() => runtime.completePuzzle(puzzleId) };
        if (typeof root.dispatchEvent === 'function' && typeof root.CustomEvent === 'function') {
          root.dispatchEvent(new CustomEvent('toki-campaign-open-puzzle', { detail }));
        }
        return { ok:true, puzzle, detail };
      },
      completePuzzle(puzzleId) { return runtime.completePuzzle(puzzleId); },
      move(connectionId) { return runtime.move(connectionId); },
      startLevel(levelId, options) { return runtime.startLevel(levelId, options); },
      nextLevel() { return runtime.nextLevel(); },
      snapshot() { return runtime.snapshot(); },
      isLevelComplete() { return runtime.isLevelComplete(); }
    };
  }

  root.TokiPonaCampaignEngineAdapter = { createAdapter };
  if (typeof module === 'object' && module.exports) module.exports = { createAdapter };
})(typeof globalThis !== 'undefined' ? globalThis : this);
