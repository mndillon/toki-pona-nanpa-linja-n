(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TokiPonaCampaignConstructor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function uniq(values) {
    return [...new Set(values || [])];
  }

  function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value.slice() : [value];
  }

  function normalizeRequirement(req) {
    const r = req || {};
    return {
      glyphs: uniq(r.glyphs),
      states: Object.assign({}, r.states || {}),
      solvedPuzzles: uniq(r.solvedPuzzles)
    };
  }

  function normalizeEffects(effects) {
    const e = effects || {};
    return {
      glyphs: uniq(e.glyphs),
      setStates: Object.assign({}, e.setStates || {})
    };
  }

  function normalizeUi(ui, type) {
    const src = ui || {};
    return {
      presentation: src.presentation || (type === 'pickup' || type === 'world-action' ? 'world' : 'fullscreen'),
      canExit: src.canExit !== false,
      title: src.title || '',
      instructions: src.instructions || '',
      objective: src.objective || '',
      module: src.module || type,
      payload: clone(src.payload || {}),
      helpLink: src.helpLink ? clone(src.helpLink) : null
    };
  }

  function normalizePuzzle(puzzle) {
    if (!puzzle || !puzzle.id) throw new Error('Puzzle requires id');
    if (!puzzle.area) throw new Error(`Puzzle ${puzzle.id} requires area`);
    const type = puzzle.type || 'generic';
    const rewards = normalizeEffects(puzzle.rewards);
    const skipIfRewardsOwned = Boolean(puzzle.skipIfRewardsOwned);
    const alreadyOwnedEffects = normalizeEffects(puzzle.alreadyOwnedEffects || (skipIfRewardsOwned ? { setStates: rewards.setStates } : {}));
    return {
      id: puzzle.id,
      chain: puzzle.chain || null,
      type,
      area: puzzle.area,
      sourceClass: puzzle.sourceClass || 'canonical', // canonical | required-state | bonus | story
      requiredForMinimum: puzzle.requiredForMinimum !== false && puzzle.sourceClass !== 'bonus',
      requirements: normalizeRequirement(puzzle.requirements),
      rewards,
      skipIfRewardsOwned,
      skipSafe: Boolean(puzzle.skipSafe),
      storyCritical: Boolean(puzzle.storyCritical),
      alreadyOwnedEffects,
      inputSequence: asArray(puzzle.inputSequence),
      repeatableGlyphUse: puzzle.repeatableGlyphUse !== false,
      ui: normalizeUi(puzzle.ui, type),
      notes: puzzle.notes || ''
    };
  }

  function normalizeConnection(connection) {
    if (!connection || !connection.id) throw new Error('Connection requires id');
    if (!connection.from || !connection.to) throw new Error(`Connection ${connection.id} requires from/to`);
    return {
      id: connection.id,
      from: connection.from,
      to: connection.to,
      bidirectional: connection.bidirectional !== false,
      kind: connection.kind || 'passage',
      requirements: normalizeRequirement(connection.requirements),
      runtime: clone(connection.runtime || {}),
      notes: connection.notes || ''
    };
  }

  function normalizeArea(area) {
    if (!area || !area.id) throw new Error('Area requires id');
    return {
      id: area.id,
      name: area.name || area.id,
      floor: Number.isFinite(area.floor) ? area.floor : 0,
      worldRef: area.worldRef || area.id,
      roomRef: area.roomRef || area.name || area.id,
      tags: uniq(area.tags),
      runtime: clone(area.runtime || {})
    };
  }

  function normalizeLevel(level, rules) {
    if (!level || !level.id) throw new Error('Level requires id');
    const canonicalGlyphs = uniq(level.canonicalGlyphs);
    const areas = (level.areas || []).map(normalizeArea);
    const connections = (level.connections || []).map(normalizeConnection);
    const puzzles = (level.puzzles || []).map(normalizePuzzle);
    return {
      id: level.id,
      ordinal: Number(level.ordinal || 0),
      title: level.title || level.id,
      canonicalGlyphs,
      startArea: level.startArea,
      initialStates: Object.assign({}, level.initialStates || {}),
      areas,
      connections,
      puzzles,
      completion: {
        requirements: normalizeRequirement(level.completion && level.completion.requirements),
        exitArea: level.completion && level.completion.exitArea ? level.completion.exitArea : null
      },
      runtime: clone(level.runtime || {}),
      rules: Object.assign({}, rules || {}, level.rules || {})
    };
  }

  function constructCampaign(blueprint, options) {
    const opts = options || {};
    if (!blueprint || typeof blueprint !== 'object') throw new Error('Campaign blueprint is required');
    const rules = Object.assign({
      canonicalGlyphsPerLevel: 10,
      canonicalGlyphTotal: 120,
      allowDraftPartialCampaign: true,
      bonusCanSatisfyMinimum: false,
      requiredPuzzleRewardsConsumable: false
    }, blueprint.rules || {});

    const campaign = {
      schemaVersion: SCHEMA_VERSION,
      id: blueprint.id || 'glyph-quest-campaign',
      title: blueprint.title || 'Toki Pona Glyph Quest',
      status: blueprint.status || 'draft',
      standardGlyphs: uniq(blueprint.standardGlyphs),
      baselineGlyphs: uniq(blueprint.baselineGlyphs),
      baselineSymbols: uniq(blueprint.baselineSymbols),
      rules,
      levels: (blueprint.levels || []).map(level => normalizeLevel(level, rules)),
      runtime: clone(blueprint.runtime || {}),
      foundationMilestone: clone(blueprint.foundationMilestone || null)
    };

    // Optional numeric/cartouche resolver hook. The constructor never guesses
    // nanpa-linja-n dependencies: it only accepts the actual resolved sequence.
    const resolver = opts.resolveGlyphSequence;
    for (const level of campaign.levels) {
      for (const puzzle of level.puzzles) {
        const spec = puzzle.ui && puzzle.ui.payload && puzzle.ui.payload.glyphSequenceSpec;
        if (!spec) continue;
        if (typeof resolver !== 'function') {
          puzzle.compilationError = `Puzzle ${puzzle.id} has glyphSequenceSpec but no resolveGlyphSequence hook was supplied.`;
          continue;
        }
        const resolved = resolver(clone(spec));
        if (!resolved || !Array.isArray(resolved.sequence)) {
          puzzle.compilationError = `Puzzle ${puzzle.id} glyph sequence resolver did not return {sequence:[...]}.`;
          continue;
        }
        const sequence = resolved.sequence.slice();
        puzzle.ui.payload.compiledGlyphSequence = sequence;
        const collectibleSet = uniq(resolved.collectibleGlyphs || sequence.filter(x => campaign.standardGlyphs.includes(x)));
        puzzle.requirements.glyphs = uniq(puzzle.requirements.glyphs.concat(collectibleSet));
      }
    }

    return campaign;
  }

  class CampaignBuilder {
    constructor(config) {
      this.blueprint = Object.assign({ levels: [] }, clone(config || {}));
      if (!Array.isArray(this.blueprint.levels)) this.blueprint.levels = [];
    }
    addLevel(level) {
      this.blueprint.levels.push(clone(level));
      return this;
    }
    build(options) {
      return constructCampaign(this.blueprint, options);
    }
  }

  return { SCHEMA_VERSION, CampaignBuilder, constructCampaign, normalizeRequirement, normalizeEffects };
});
