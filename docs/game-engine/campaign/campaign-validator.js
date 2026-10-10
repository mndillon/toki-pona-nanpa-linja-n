(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TokiPonaCampaignValidator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_STATES_DEFAULT = 60000;

  function sortedSet(set) { return [...set].sort(); }
  function cloneWorld(world) { return Object.assign({}, world || {}); }
  function stateKey(s) {
    return JSON.stringify([
      s.area,
      sortedSet(s.glyphs),
      sortedSet(s.solved),
      Object.keys(s.world).sort().map(k => [k, s.world[k]])
    ]);
  }

  function reqMet(req, s) {
    const r = req || {};
    for (const g of r.glyphs || []) if (!s.glyphs.has(g)) return false;
    for (const p of r.solvedPuzzles || []) if (!s.solved.has(p)) return false;
    for (const [k, v] of Object.entries(r.states || {})) if (s.world[k] !== v) return false;
    return true;
  }

  function applyEffects(base, puzzle, effects) {
    const next = {
      area: base.area,
      glyphs: new Set(base.glyphs),
      solved: new Set(base.solved),
      world: cloneWorld(base.world)
    };
    next.solved.add(puzzle.id);
    for (const g of (effects && effects.glyphs) || []) next.glyphs.add(g);
    for (const [k, v] of Object.entries((effects && effects.setStates) || {})) next.world[k] = v;
    return next;
  }

  function complete(level, s) {
    if (level.completion.exitArea && s.area !== level.completion.exitArea) return false;
    if (!reqMet(level.completion.requirements, s)) return false;
    for (const g of level.canonicalGlyphs || []) if (!s.glyphs.has(g)) return false;
    return true;
  }

  function addEdge(graph, fromKey, toKey, label) {
    if (!graph.has(fromKey)) graph.set(fromKey, []);
    graph.get(fromKey).push({ to: toKey, label });
  }

  function normalizeAlreadyOwned(level, initial) {
    let s = initial;
    let changed = true;
    const applied = [];
    while (changed) {
      changed = false;
      for (const puzzle of level.puzzles) {
        if (!puzzle.skipIfRewardsOwned || !puzzle.skipSafe || puzzle.storyCritical || s.solved.has(puzzle.id)) continue;
        const rewardGlyphs = puzzle.rewards.glyphs || [];
        if (!rewardGlyphs.length || !rewardGlyphs.every(g => s.glyphs.has(g))) continue;
        const effects = puzzle.alreadyOwnedEffects || { glyphs: [], setStates: {} };
        const next = applyEffects(s, puzzle, effects);
        s = next;
        applied.push(puzzle.id);
        changed = true;
      }
    }
    return { state: s, applied };
  }

  function simulateLevel(level, startingGlyphs, options) {
    const opts = Object.assign({ includeBonus: false, maxStates: MAX_STATES_DEFAULT }, options || {});
    const errors = [];
    const warnings = [];
    const areas = new Map((level.areas || []).map(a => [a.id, a]));
    const puzzles = level.puzzles || [];
    const connections = level.connections || [];

    let initial = {
      area: level.startArea,
      glyphs: new Set(startingGlyphs || []),
      solved: new Set(),
      world: cloneWorld(level.initialStates)
    };
    const pre = normalizeAlreadyOwned(level, initial);
    initial = pre.state;

    const queue = [initial];
    const states = new Map();
    const graph = new Map();
    const parent = new Map();
    const initialKey = stateKey(initial);
    states.set(initialKey, initial);
    let qIndex = 0;
    let truncated = false;

    while (qIndex < queue.length) {
      if (states.size > opts.maxStates) { truncated = true; break; }
      const s = queue[qIndex++];
      const fromKey = stateKey(s);

      for (const c of connections) {
        let target = null;
        if (c.from === s.area && reqMet(c.requirements, s)) target = c.to;
        else if (c.bidirectional && c.to === s.area && reqMet(c.requirements, s)) target = c.from;
        if (!target || !areas.has(target)) continue;
        const next = { area: target, glyphs: new Set(s.glyphs), solved: new Set(s.solved), world: cloneWorld(s.world) };
        const toKey = stateKey(next);
        addEdge(graph, fromKey, toKey, `move:${c.id}`);
        if (!states.has(toKey)) {
          states.set(toKey, next); queue.push(next); parent.set(toKey, { from: fromKey, action: `move:${c.id}` });
        }
      }

      for (const p of puzzles) {
        if (p.area !== s.area || s.solved.has(p.id)) continue;
        if (!opts.includeBonus && !p.requiredForMinimum) continue;
        if (!reqMet(p.requirements, s)) continue;
        const next = applyEffects(s, p, p.rewards);
        const toKey = stateKey(next);
        addEdge(graph, fromKey, toKey, `solve:${p.id}`);
        if (!states.has(toKey)) {
          states.set(toKey, next); queue.push(next); parent.set(toKey, { from: fromKey, action: `solve:${p.id}` });
        }
      }
    }

    const completeKeys = [...states.entries()].filter(([, s]) => complete(level, s)).map(([k]) => k);
    const reverse = new Map();
    for (const [from, edges] of graph.entries()) {
      for (const edge of edges) {
        if (!reverse.has(edge.to)) reverse.set(edge.to, []);
        reverse.get(edge.to).push(from);
      }
    }
    const winning = new Set(completeKeys);
    const rq = completeKeys.slice();
    for (let i = 0; i < rq.length; i++) {
      const k = rq[i];
      for (const prev of reverse.get(k) || []) if (!winning.has(prev)) { winning.add(prev); rq.push(prev); }
    }
    const softLocks = [...states.keys()].filter(k => !winning.has(k));

    let proof = [];
    if (completeKeys.length) {
      let cursor = completeKeys[0];
      while (cursor !== initialKey) {
        const p = parent.get(cursor);
        if (!p) break;
        proof.push(p.action);
        cursor = p.from;
      }
      proof.reverse();
    }

    if (!completeKeys.length) errors.push({ code: 'NO_COMPLETION_PATH', message: `No completion path exists for level ${level.id}.` });
    if (softLocks.length) errors.push({ code: 'SOFT_LOCK_STATES', message: `${softLocks.length} reachable state(s) cannot reach level completion.`, count: softLocks.length });
    if (truncated) errors.push({ code: 'STATE_LIMIT', message: `Validation exceeded ${opts.maxStates} states.` });

    const seenGlyphs = new Set();
    const reachableAreas = new Set();
    const solvablePuzzles = new Set();
    for (const s of states.values()) {
      reachableAreas.add(s.area);
      for (const g of s.glyphs) seenGlyphs.add(g);
      for (const p of s.solved) solvablePuzzles.add(p);
    }
    const missingCanonical = (level.canonicalGlyphs || []).filter(g => !seenGlyphs.has(g));
    if (missingCanonical.length) errors.push({ code: 'UNREACHABLE_CANONICAL_GLYPHS', message: `Unreachable canonical glyphs: ${missingCanonical.join(', ')}`, glyphs: missingCanonical });

    return {
      ok: errors.length === 0,
      errors, warnings,
      stateCount: states.size,
      completeStateCount: completeKeys.length,
      softLockStateCount: softLocks.length,
      reachableAreas: [...reachableAreas].sort(),
      solvablePuzzles: [...solvablePuzzles].sort(),
      reachableGlyphs: [...seenGlyphs].sort(),
      preAppliedSolvedStatePuzzles: pre.applied,
      proof
    };
  }

  function validateStructure(campaign) {
    const errors = [];
    const warnings = [];
    if (!campaign || typeof campaign !== 'object') return { errors: [{ code:'NO_CAMPAIGN', message:'Campaign object missing.' }], warnings };
    if (campaign.schemaVersion !== 1) errors.push({ code:'SCHEMA_VERSION', message:`Expected schemaVersion 1; got ${campaign.schemaVersion}.` });
    if (!Array.isArray(campaign.standardGlyphs) || !campaign.standardGlyphs.length) errors.push({ code:'STANDARD_GLYPHS', message:'standardGlyphs must be supplied.' });

    const standard = new Set(campaign.standardGlyphs || []);
    const baseline = new Set(campaign.baselineGlyphs || []);
    const allowedGlyphs = new Set([...standard, ...baseline]);
    for (const g of baseline) if (standard.has(g)) errors.push({ code:'BASELINE_OVERLAP', message:`Baseline glyph ${g} is also in the 120 collectible set.` });
    const allCanonical = [];
    const levelIds = new Set();
    for (const level of campaign.levels || []) {
      if (levelIds.has(level.id)) errors.push({ code:'DUP_LEVEL_ID', message:`Duplicate level id ${level.id}.` });
      levelIds.add(level.id);
      const areaIds = new Set();
      const puzzleIds = new Set();
      const connectionIds = new Set();
      for (const a of level.areas || []) {
        if (areaIds.has(a.id)) errors.push({ code:'DUP_AREA_ID', message:`${level.id}: duplicate area ${a.id}.` });
        areaIds.add(a.id);
      }
      if (!areaIds.has(level.startArea)) errors.push({ code:'START_AREA', message:`${level.id}: startArea ${level.startArea} does not exist.` });
      if (level.completion.exitArea && !areaIds.has(level.completion.exitArea)) errors.push({ code:'EXIT_AREA', message:`${level.id}: exitArea ${level.completion.exitArea} does not exist.` });
      for (const c of level.connections || []) {
        if (connectionIds.has(c.id)) errors.push({ code:'DUP_CONNECTION_ID', message:`${level.id}: duplicate connection ${c.id}.` });
        connectionIds.add(c.id);
        if (!areaIds.has(c.from) || !areaIds.has(c.to)) errors.push({ code:'CONNECTION_AREA', message:`${level.id}/${c.id}: invalid from/to area.` });
      }
      for (const p of level.puzzles || []) {
        if (puzzleIds.has(p.id)) errors.push({ code:'DUP_PUZZLE_ID', message:`${level.id}: duplicate puzzle ${p.id}.` });
        puzzleIds.add(p.id);
        if (!areaIds.has(p.area)) errors.push({ code:'PUZZLE_AREA', message:`${level.id}/${p.id}: area ${p.area} does not exist.` });
        if (p.compilationError) errors.push({ code:'UNRESOLVED_GLYPH_SEQUENCE', message:p.compilationError });
        if (p.sourceClass === 'bonus' && p.requiredForMinimum) errors.push({ code:'BONUS_MARKED_REQUIRED', message:`${level.id}/${p.id}: bonus puzzle cannot be requiredForMinimum.` });
        if (p.skipIfRewardsOwned && (!p.skipSafe || p.storyCritical)) errors.push({ code:'UNSAFE_SKIP', message:`${level.id}/${p.id}: skipIfRewardsOwned requires skipSafe=true and storyCritical=false.` });
        for (const g of (p.requirements.glyphs || [])) if (!allowedGlyphs.has(g)) errors.push({ code:'UNKNOWN_GLYPH', message:`${level.id}/${p.id}: unknown glyph ${g}.` });
        for (const g of (p.rewards.glyphs || [])) {
          if (!allowedGlyphs.has(g)) errors.push({ code:'UNKNOWN_GLYPH', message:`${level.id}/${p.id}: unknown reward glyph ${g}.` });
          else if (!standard.has(g)) errors.push({ code:'BASELINE_GLYPH_REWARDED', message:`${level.id}/${p.id}: baseline glyph ${g} is available from the start and cannot be a collectible reward.` });
        }
        for (const dep of p.requirements.solvedPuzzles || []) {
          const target = (level.puzzles || []).find(x => x.id === dep);
          if (target && target.sourceClass === 'bonus' && p.requiredForMinimum) errors.push({ code:'REQUIRED_DEPENDS_ON_BONUS', message:`${level.id}/${p.id} depends on bonus puzzle ${dep}.` });
        }
      }
      const expected = level.rules.canonicalGlyphsPerLevel;
      if (Number.isFinite(expected) && level.canonicalGlyphs.length !== expected) errors.push({ code:'CANONICAL_COUNT', message:`${level.id}: expected ${expected} canonical glyphs, got ${level.canonicalGlyphs.length}.` });
      for (const g of level.canonicalGlyphs) {
        allCanonical.push({ glyph:g, level:level.id });
        if (!standard.has(g)) errors.push({ code:'UNKNOWN_CANONICAL_GLYPH', message:`${level.id}: unknown canonical glyph ${g}.` });
      }
    }

    const owner = new Map();
    for (const x of allCanonical) {
      if (owner.has(x.glyph)) errors.push({ code:'DUP_CANONICAL_GLYPH', message:`Glyph ${x.glyph} is canonical in both ${owner.get(x.glyph)} and ${x.level}.` });
      else owner.set(x.glyph, x.level);
    }
    const expectedTotal = campaign.rules && campaign.rules.canonicalGlyphTotal;
    if (Number.isFinite(expectedTotal) && allCanonical.length !== expectedTotal) {
      const msg = `Campaign currently assigns ${allCanonical.length}/${expectedTotal} canonical glyphs.`;
      if (campaign.status === 'draft' && campaign.rules.allowDraftPartialCampaign) warnings.push({ code:'DRAFT_CANONICAL_TOTAL', message:msg });
      else errors.push({ code:'CANONICAL_TOTAL', message:msg });
    }
    return { errors, warnings };
  }

  function validateCampaign(campaign, options) {
    const opts = options || {};
    const structural = validateStructure(campaign);
    const report = { ok:false, errors:structural.errors.slice(), warnings:structural.warnings.slice(), levels:[], summary:{} };
    if (report.errors.length) {
      report.summary = { levelsChecked:0, structuralErrors:report.errors.length };
      return report;
    }

    const guaranteed = new Set([...(campaign.baselineGlyphs || []), ...(opts.initialGlyphs || [])]);
    for (const level of [...campaign.levels].sort((a,b) => a.ordinal-b.ordinal)) {
      const minimum = simulateLevel(level, guaranteed, { includeBonus:false, maxStates:opts.maxStates });
      const entry = { levelId:level.id, minimum, bonusSkipScenarios:[] };
      if (!minimum.ok) report.errors.push(...minimum.errors.map(e => Object.assign({ levelId:level.id }, e)));

      // Validate skip-safe future-glyph behaviour. Test each skippable canonical reward
      // individually and all skippable rewards together. These are not minimum-path inputs.
      const skippable = level.puzzles.filter(p => p.skipIfRewardsOwned && p.skipSafe && !p.storyCritical && p.rewards.glyphs.length);
      for (const p of skippable) {
        const preowned = new Set(guaranteed);
        for (const g of p.rewards.glyphs) preowned.add(g);
        const scenario = simulateLevel(level, preowned, { includeBonus:false, maxStates:opts.maxStates });
        entry.bonusSkipScenarios.push({ name:`preowned:${p.id}`, ok:scenario.ok, preownedGlyphs:p.rewards.glyphs.slice(), stateCount:scenario.stateCount, errors:scenario.errors });
        if (!scenario.ok) report.errors.push({ levelId:level.id, code:'PREOWNED_SKIP_BREAKS_LEVEL', message:`Pre-owning reward(s) of ${p.id} breaks the level.` });
      }
      if (skippable.length > 1) {
        const preowned = new Set(guaranteed);
        const gs = [];
        for (const p of skippable) for (const g of p.rewards.glyphs) { preowned.add(g); gs.push(g); }
        const scenario = simulateLevel(level, preowned, { includeBonus:false, maxStates:opts.maxStates });
        entry.bonusSkipScenarios.push({ name:'preowned:all-skip-safe', ok:scenario.ok, preownedGlyphs:[...new Set(gs)], stateCount:scenario.stateCount, errors:scenario.errors });
        if (!scenario.ok) report.errors.push({ levelId:level.id, code:'ALL_PREOWNED_SKIP_BREAKS_LEVEL', message:'Pre-owning all skip-safe rewards breaks the level.' });
      }

      report.levels.push(entry);
      for (const g of level.canonicalGlyphs) guaranteed.add(g);

      const milestone = campaign.foundationMilestone;
      if (milestone && milestone.afterLevel === level.id) {
        const available = new Set(guaranteed);
        const missingFoundation = (milestone.collectibleGlyphs || []).filter(g => !available.has(g));
        if (missingFoundation.length) report.errors.push({ levelId:level.id, code:'FOUNDATION_GLYPHS_MISSING', message:`Foundation milestone missing glyphs: ${missingFoundation.join(', ')}` });
        const initials = new Set([...available].map(g => String(g || '')[0]?.toUpperCase()).filter(Boolean));
        const missingInitials = (milestone.requiredInitials || []).filter(letter => !initials.has(letter));
        if (missingInitials.length) report.errors.push({ levelId:level.id, code:'FOUNDATION_INITIALS_MISSING', message:`Foundation milestone missing Toki Pona initials: ${missingInitials.join(', ')}` });
        const missingNumeric = (milestone.numericAbbreviatedCollectibleGlyphs || []).filter(g => !available.has(g));
        if (missingNumeric.length) report.errors.push({ levelId:level.id, code:'FOUNDATION_NUMERIC_MISSING', message:`Abbreviated numeric foundation missing collectible glyphs: ${missingNumeric.join(', ')}` });
        const baselineSet = new Set(campaign.baselineGlyphs || []);
        const missingBaseline = (milestone.numericAbbreviatedBaselineGlyphs || []).filter(g => !baselineSet.has(g));
        if (missingBaseline.length) report.errors.push({ levelId:level.id, code:'FOUNDATION_BASELINE_MISSING', message:`Abbreviated numeric foundation missing baseline glyphs: ${missingBaseline.join(', ')}` });
        const missingCoordinate = (milestone.coordinateFoundationGlyphs || []).filter(g => !available.has(g));
        if (missingCoordinate.length) report.errors.push({ levelId:level.id, code:'FOUNDATION_COORDINATE_MISSING', message:`Coordinate foundation missing glyphs: ${missingCoordinate.join(', ')}` });
      }
    }

    report.ok = report.errors.length === 0;
    report.summary = {
      levelsChecked: report.levels.length,
      warnings: report.warnings.length,
      errors: report.errors.length,
      collectibleGlyphsGuaranteedAfterCheckedLevels: [...guaranteed].filter(g => (campaign.standardGlyphs || []).includes(g)).length,
      baselineGlyphsAvailableFromStart: (campaign.baselineGlyphs || []).length
    };
    return report;
  }

  function formatReport(report) {
    const out = [];
    out.push(`Campaign validation: ${report.ok ? 'PASS' : 'FAIL'}`);
    out.push(`Levels checked: ${report.summary.levelsChecked || 0}`);
    out.push(`Errors: ${report.errors.length}`);
    out.push(`Warnings: ${report.warnings.length}`);
    out.push('');
    for (const w of report.warnings) out.push(`WARNING ${w.code}: ${w.message}`);
    for (const e of report.errors) out.push(`ERROR ${e.levelId ? e.levelId + ' ' : ''}${e.code}: ${e.message}`);
    if (report.warnings.length || report.errors.length) out.push('');
    for (const level of report.levels || []) {
      const m = level.minimum;
      out.push(`${level.levelId}: ${m.ok ? 'PASS' : 'FAIL'} | states=${m.stateCount} | softLocks=${m.softLockStateCount} | completeStates=${m.completeStateCount}`);
      out.push(`  reachable areas: ${m.reachableAreas.join(', ')}`);
      out.push(`  proof: ${m.proof.length ? m.proof.join(' -> ') : '(none)'}`);
      for (const s of level.bonusSkipScenarios || []) out.push(`  skip scenario ${s.name}: ${s.ok ? 'PASS' : 'FAIL'} (${s.preownedGlyphs.join(', ')})`);
    }
    return out.join('\n');
  }

  return { validateCampaign, validateStructure, simulateLevel, formatReport, reqMet };
});
