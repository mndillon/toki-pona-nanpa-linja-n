(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TokiPonaGameReset = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const SAVE_VERSION = 4;
  const DB_NAME = 'tokiPonaRoomsGame';
  const DB_VERSION = 1;
  const STORE_NAME = 'saves';
  const SAVE_ID = 'main';
  const RESET_DIRECTIVE_KEY = 'tokiPonaRoomsGameResetDirective';

  const WORLD_BY_LEVEL = Object.freeze({
    L01:{levelId:'main',x:3.1,y:4.5,angle:0},
    L02:{levelId:'l2main',x:3.2,y:3.6,angle:0},
    L03:{levelId:'l3main',x:4.2,y:3.6,angle:0},
    L04:{levelId:'l4main',x:3.6,y:3.6,angle:0},
    L05:{levelId:'l5main',x:3.6,y:3.6,angle:0},
    L06:{levelId:'l6main',x:3.6,y:3.6,angle:0},
    L07:{levelId:'l7main',x:3.6,y:3.6,angle:0},
    L08:{levelId:'l8main',x:3.6,y:3.6,angle:0},
    L09:{levelId:'l9upper',x:3.4,y:3.5,angle:0},
    L10:{levelId:'l10ground',x:3.5,y:6.3,angle:0},
    L11:{levelId:'l11ground',x:3.5,y:6.3,angle:0},
    L12:{levelId:'l12ground',x:3.5,y:6.3,angle:0}
  });

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function makeSaveEpoch(prefix) {
    const head = String(prefix || 'save').replace(/[^a-z0-9_-]/gi, '') || 'save';
    let tail = '';
    try {
      if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
        const bytes = new Uint32Array(2);
        root.crypto.getRandomValues(bytes);
        tail = Array.from(bytes, n => n.toString(36)).join('-');
      }
    } catch (_) {}
    if (!tail) tail = Math.random().toString(36).slice(2, 12);
    return `${head}-${Date.now().toString(36)}-${tail}`;
  }

  function parseResetDirective(raw) {
    if (!raw) return null;
    try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const level = Number(value?.level);
      const epoch = String(value?.epoch || '').trim();
      if (!Number.isInteger(level) || level < 1 || !epoch) return null;
      return { level, epoch, at:Number(value?.at) || 0 };
    } catch (_) { return null; }
  }

  function readResetDirective(storage) {
    try { return parseResetDirective((storage || root.localStorage)?.getItem(RESET_DIRECTIVE_KEY)); }
    catch (_) { return null; }
  }

  function writeResetDirective(storage, directive) {
    const normalized = parseResetDirective(directive);
    if (!normalized) throw new Error('Invalid reset directive.');
    try { (storage || root.localStorage)?.setItem(RESET_DIRECTIVE_KEY, JSON.stringify(normalized)); }
    catch (_) {}
    return normalized;
  }

  function clearResetDirective(storage) {
    try { (storage || root.localStorage)?.removeItem(RESET_DIRECTIVE_KEY); }
    catch (_) {}
  }

  function stateMatchesResetDirective(state, directive) {
    const d = parseResetDirective(directive);
    return !!(d && state && String(state.saveEpoch || '') === d.epoch && Number(state.chapter) === d.level);
  }

  function requiredSolvedPuzzles(level) {
    return (level.puzzles || [])
      .filter(puzzle => puzzle.requiredForMinimum !== false && puzzle.sourceClass !== 'bonus')
      .map(puzzle => puzzle.id);
  }

  function completedWorld(level) {
    const world = clone(level.initialStates || {});
    for (const puzzle of level.puzzles || []) {
      if (puzzle.requiredForMinimum === false || puzzle.sourceClass === 'bonus') continue;
      Object.assign(world, clone(puzzle.rewards?.setStates || {}));
    }
    return world;
  }

  function makeCampaignSnapshot(campaign, target) {
    const prior = [...campaign.levels].filter(level => Number(level.ordinal) < Number(target.ordinal));
    const glyphs = new Set(campaign.baselineGlyphs || []);
    for (const level of prior) for (const glyph of level.canonicalGlyphs || []) glyphs.add(glyph);

    const levelStates = {};
    for (const level of prior) {
      levelStates[level.id] = {
        solvedPuzzles: requiredSolvedPuzzles(level),
        world: completedWorld(level),
        completed: true
      };
    }
    levelStates[target.id] = {
      solvedPuzzles: [],
      world: clone(target.initialStates || {}),
      completed: false
    };

    return {
      currentLevelId: target.id,
      currentArea: target.startArea,
      globalGlyphs: [...glyphs],
      levelStates
    };
  }

  function makeGameState(campaign, target, previousState, options) {
    const opts = options || {};
    const world = WORLD_BY_LEVEL[target.id];
    if (!world) throw new Error(`No physical start mapping for ${target.id}.`);
    const previousStandard = new Set();
    for (const level of campaign.levels || []) {
      if (Number(level.ordinal) >= Number(target.ordinal)) continue;
      for (const glyph of level.canonicalGlyphs || []) previousStandard.add(glyph);
    }
    return {
      version: SAVE_VERSION,
      saveEpoch: String(opts.saveEpoch || makeSaveEpoch('reset')),
      levelId: world.levelId,
      chapter: Number(target.ordinal),
      levelIntroPending: true,
      x: world.x,
      y: world.y,
      angle: world.angle,
      carrying: null,
      ballOnTable: false,
      lowerPowerOn: false,
      trapdoorOpen: false,
      levelCompleted: false,
      sound: typeof previousState?.sound === 'boolean' ? previousState.sound : true,
      mapVisible: typeof previousState?.mapVisible === 'boolean' ? previousState.mapVisible : true,
      openDoors: {},
      explored: {},
      visitedRooms: {},
      collected: Object.fromEntries([...previousStandard].map(glyph => [glyph,true])),
      completedPanels: {},
      puzzleVariants: {},
      l9Markers: {},
      l9Placements: {},
      l10CartDock: 'receiving',
      l10CartCargo: [],
      l10CartTrips: 0,
      l10DeliveryPlacements: {},
      l10ParcelLocations: { bread:'receiving', sweet:'receiving' },
      l10TextilePlacements: {},
      l10TextileLocations: { 'blue-cloth':'upper-rack', 'white-cloth':'upper-rack' },
      l10AuditPlacements: {},
      l10AuditLocations: { 'bread-sample':'ledger', 'sweet-sample':'ledger' },
      l10MechanismStates: {},
      l11CallMarkers: {},
      l11BandPlacements: {},
      l11BandLocations: { 'red-band':'rack', 'blue-band':'rack' },
      l11MechanismStates: {},
      l12MechanismStates: {},
      campaign: makeCampaignSnapshot(campaign,target),
      log: []
    };
  }

  function verifyResetState(campaign, target, state) {
    if (!state || Number(state.version) !== SAVE_VERSION) throw new Error('Reset verification failed: wrong save version.');
    if (Number(state.chapter) !== Number(target.ordinal)) throw new Error('Reset verification failed: wrong level chapter.');
    const world = WORLD_BY_LEVEL[target.id];
    if (!world || state.levelId !== world.levelId) throw new Error('Reset verification failed: wrong physical level.');
    if (!state.levelIntroPending) throw new Error('Reset verification failed: level intro is not pending.');
    if (state.campaign?.currentLevelId !== target.id || state.campaign?.currentArea !== target.startArea) {
      throw new Error('Reset verification failed: campaign did not return to the target start area.');
    }
    const targetState = state.campaign?.levelStates?.[target.id];
    if (!targetState || targetState.completed || (targetState.solvedPuzzles || []).length) {
      throw new Error('Reset verification failed: target level contains solved progress.');
    }
    const owned = new Set(state.campaign?.globalGlyphs || []);
    const currentOwned = (target.canonicalGlyphs || []).filter(glyph => owned.has(glyph));
    if (currentOwned.length) throw new Error(`Reset verification failed: target-level glyphs already owned: ${currentOwned.join(', ')}.`);
    const expectedPrior = (campaign.levels || [])
      .filter(level => Number(level.ordinal) < Number(target.ordinal))
      .flatMap(level => level.canonicalGlyphs || []);
    const standard = new Set(campaign.standardGlyphs || []);
    const priorOwned = [...owned].filter(glyph => standard.has(glyph));
    if (priorOwned.length !== new Set(expectedPrior).size) {
      throw new Error(`Reset verification failed: expected ${new Set(expectedPrior).size} prior canonical glyphs, found ${priorOwned.length}.`);
    }
    return true;
  }

  function stateBelongsToResetEpoch(state, directive) {
    const d = parseResetDirective(directive);
    return !!(d && state && String(state.saveEpoch || '') === d.epoch);
  }

  function recoverPendingReset(campaign, savedState, storage) {
    const directive = readResetDirective(storage);
    // A matching epoch means this save already descends from the requested reset.
    // Its chapter may legitimately be later because the player has progressed.
    // Only an epoch mismatch indicates that an older tab/save overwrote the reset.
    if (!directive || stateBelongsToResetEpoch(savedState, directive)) {
      return { state:savedState || null, recovered:false, directive };
    }
    const target = (campaign?.levels || []).find(level => Number(level.ordinal) === directive.level);
    if (!target) return { state:savedState || null, recovered:false, directive:null };
    const state = makeGameState(campaign, target, savedState || null, { saveEpoch:directive.epoch });
    verifyResetState(campaign, target, state);
    return { state, recovered:true, directive };
  }

  function consumeAppliedResetDirective(savedState, storage) {
    const directive = readResetDirective(storage);
    if (!directive || !stateBelongsToResetEpoch(savedState, directive)) return false;
    clearResetDirective(storage);
    return true;
  }

  function openDb(indexedDB) {
    return new Promise((resolve,reject) => {
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  function readExisting(db) {
    return new Promise(resolve => {
      const tx=db.transaction(STORE_NAME,'readonly');
      const req=tx.objectStore(STORE_NAME).get(SAVE_ID);
      req.onsuccess=()=>resolve(req.result?.state || null);
      req.onerror=()=>resolve(null);
    });
  }

  function writeState(db,state) {
    return new Promise((resolve,reject) => {
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).put({id:SAVE_ID,state,updatedAt:Date.now()});
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error || new Error('IndexedDB write failed'));
      tx.onabort=()=>reject(tx.error || new Error('IndexedDB write aborted'));
    });
  }

  async function resetToLevel(options) {
    const opts=options || {};
    const campaign=opts.campaign;
    const indexedDB=opts.indexedDB;
    const levelNo=Number(opts.level);
    if (!campaign) throw new Error('Campaign data did not load.');
    if (!indexedDB) throw new Error('IndexedDB is unavailable.');
    if (!Number.isInteger(levelNo)) throw new Error('Missing or invalid level parameter. Use ?level=1, ?level=2, and so on.');
    const target=(campaign.levels || []).find(level => Number(level.ordinal) === levelNo);
    if (!target) throw new Error(`Level ${opts.level} is not available in this campaign build.`);
    const db=await openDb(indexedDB);
    const previous=await readExisting(db);
    const directive={level:levelNo,epoch:makeSaveEpoch(`reset-l${levelNo}`),at:Date.now()};
    const state=makeGameState(campaign,target,previous,{saveEpoch:directive.epoch});
    verifyResetState(campaign,target,state);
    await writeState(db,state);
    const verified=await readExisting(db);
    verifyResetState(campaign,target,verified);
    if (verified.saveEpoch !== directive.epoch) throw new Error('Reset verification failed: saved epoch did not round-trip.');
    writeResetDirective(opts.storage || root.localStorage,directive);
    try {
      const Channel = root.BroadcastChannel;
      if (typeof Channel === 'function') {
        const channel=new Channel('tokiPonaRoomsGame');
        channel.postMessage({type:'test-reset',level:levelNo,epoch:directive.epoch});
        channel.close();
      }
    } catch (_) {}
    db.close();
    return verified;
  }

  async function runFromQuery(options) {
    const opts=options || {};
    const location=opts.location || root.location;
    const statusEl=opts.statusEl || root.document?.getElementById('status');
    try {
      const raw=new URLSearchParams(location?.search || '').get('level');
      const state=await resetToLevel({campaign:opts.campaign || root.TOKI_PONA_CAMPAIGN,indexedDB:opts.indexedDB || root.indexedDB,level:raw});
      if (statusEl) {
        const target=(opts.campaign || root.TOKI_PONA_CAMPAIGN)?.levels?.find(level=>Number(level.ordinal)===Number(state.chapter));
        const owned=new Set(state.campaign?.globalGlyphs || []);
        const currentOwned=(target?.canonicalGlyphs || []).filter(glyph=>owned.has(glyph)).length;
        const totalOriginal=[...owned].filter(glyph=>(opts.campaign || root.TOKI_PONA_CAMPAIGN)?.standardGlyphs?.includes(glyph)).length;
        statusEl.innerHTML=`<strong>Reset complete</strong>Level ${state.chapter} is at its exact start: ${currentOwned}/${target?.canonicalGlyphs?.length || 0} current-level glyphs, ${totalOriginal}/120 total.`;
      }
      if (root.document) root.document.title=`Reset to Level ${state.chapter} complete`;
      return state;
    } catch (error) {
      if (statusEl) {
        statusEl.classList.add('error');
        statusEl.innerHTML=`<strong>Reset failed</strong>${String(error?.message || error)}`;
      }
      throw error;
    }
  }

  return { SAVE_VERSION, DB_NAME, DB_VERSION, STORE_NAME, SAVE_ID, RESET_DIRECTIVE_KEY, WORLD_BY_LEVEL, makeSaveEpoch, parseResetDirective, readResetDirective, writeResetDirective, clearResetDirective, stateMatchesResetDirective, requiredSolvedPuzzles, completedWorld, makeCampaignSnapshot, makeGameState, verifyResetState, stateBelongsToResetEpoch, recoverPendingReset, consumeAppliedResetDirective, resetToLevel, runFromQuery };
});
