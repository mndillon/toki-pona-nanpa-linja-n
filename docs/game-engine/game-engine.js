(() => {
  'use strict';

  const SAVE_VERSION = 4;
  const DB_NAME = 'tokiPonaRoomsGame';
  const DB_VERSION = 1;
  const STORE_NAME = 'saves';
  const SAVE_ID = 'main';

  function makeSaveEpoch(prefix) {
    try { return window.TokiPonaGameReset?.makeSaveEpoch?.(prefix || 'game') || `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`; }
    catch (_) { return `game-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`; }
  }

  function currentResetDirective() {
    try { return window.TokiPonaGameReset?.readResetDirective?.(window.localStorage) || null; }
    catch (_) { return null; }
  }

  const VIEW_W = 640;
  const VIEW_H = 360;
  const FOV = Math.PI / 3;
  const MOVE_SPEED = 2.45;
  const STRAFE_SPEED = 2.15;
  const MOBILE_MOVE_SPEED = 1.55;
  const MOBILE_STRAFE_SPEED = 1.38;
  const ROTATE_SPEED = 1.9;
  const PLAYER_RADIUS = 0.18;
  const INTERACT_DISTANCE = 1.55;
  const MOBILE_INTERACT_DISTANCE = 1.78;
  const MAX_RAY_DISTANCE = 24;
  const NASIN_NANPA_FONT = 'NasinNanpaGame';
  const I18N = window.TokiPonaRoomsI18n || null;
  const QA_MODE = (() => {
    try { return new URLSearchParams(window.location.search).get('qa') === '1'; }
    catch (_) { return false; }
  })();
  let uiLanguage = I18N?.getLanguage?.() || 'tp';

  function isTpLanguage() { return uiLanguage !== 'en'; }
  function uiText(key) { return I18N?.ui?.(key, uiLanguage) ?? key; }
  function puzzleText(puzzle, field) {
    const fallback = puzzle?.ui?.[field] ?? '';
    return I18N?.puzzle?.(puzzle?.id, field, fallback, uiLanguage) ?? fallback;
  }
  function exactText(source) { return I18N?.exact?.(source, uiLanguage) ?? String(source ?? ''); }
  function roomNameText(source) { return I18N?.roomName?.(source, uiLanguage) ?? String(source ?? ''); }
  function roomHintText(source) { return I18N?.roomHint?.(source, uiLanguage) ?? String(source ?? ''); }
  function termLabelText(source) { return I18N?.termLabel?.(source, uiLanguage) ?? String(source ?? ''); }
  function renderLocalized(el, text, options = {}) {
    if (!el) return;
    if (I18N?.render) I18N.render(el, text, { lang:uiLanguage, ...options });
    else el.textContent = String(text ?? '');
    // Inline numeric cartouches must go through the shared nanpa-linja-n renderer.
    // The source notation such as [nanpa1/2 :1/2 awen nanpa1/2] is parser input,
    // not text for the font to display directly.
    if (isTpLanguage() && options.sitelen !== false) hydrateInlineNumericCartouches(el);
  }
  function renderExact(el, source, options = {}) { renderLocalized(el, exactText(source), options); }


  const STANDARD_120 = [
    'a','akesi','ala','alasa','ale','anpa','ante','anu','awen','e','en','esun','ijo','ike','ilo','insa','jaki','jan','jelo','jo',
    'kala','kalama','kama','kasi','ken','kepeken','kili','kiwen','ko','kon','kule','kulupu','kute','la','lape','laso','lawa','len','lete','li',
    'lili','linja','lipu','loje','lon','luka','lukin','lupa','ma','mama','mani','meli','mi','mije','moku','moli','monsi','mu','mun','musi',
    'mute','nanpa','nasa','nasin','nena','ni','nimi','noka','o','olin','ona','open','pakala','pali','palisa','pan','pana','pi','pilin','pimeja',
    'pini','pipi','poka','poki','pona','pu','sama','seli','selo','seme','sewi','sijelo','sike','sin','sina','sinpin','sitelen','sona','soweli','suli',
    'suno','supa','suwi','tan','taso','tawa','telo','tenpo','toki','tomo','tu','unpa','uta','utala','walo','wan','waso','wawa','weka','wile'
  ];
  if (STANDARD_120.length !== 120) throw new Error(`Expected 120 standard glyphs, got ${STANDARD_120.length}`);
  const WORD_TO_CP = Object.fromEntries(STANDARD_120.map((word, i) => [word, 0xF1900 + i]));
  Object.assign(WORD_TO_CP, {
    namako:0xF1978, kin:0xF1979, oko:0xF197A, kipisi:0xF197B, leko:0xF197C, monsuta:0xF197D, tonsi:0xF197E, jasima:0xF197F,
    kijetesantakalu:0xF1980, soko:0xF1981, meso:0xF1982, epiku:0xF1983, kokosila:0xF1984, lanpan:0xF1985, n:0xF1986, misikeke:0xF1987, ku:0xF1988,
    pake:0xF19A0, apeja:0xF19A1, majuna:0xF19A2, powe:0xF19A3, linluwi:0xF19A4, kiki:0xF19A5, su:0xF19A6
  });

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const miniMap = document.getElementById('miniMap');
  const mapCtx = miniMap.getContext('2d');
  const viewportWrap = document.getElementById('viewportWrap');
  const promptEl = document.getElementById('interactionPrompt');
  const messageEl = document.getElementById('messageOverlay');
  const roomEl = document.getElementById('hudRoom');
  const levelEl = document.getElementById('hudLevel');
  const hudGlyphCountEl = document.getElementById('hudGlyphCount');
  const tpInstructionEl = document.getElementById('tpInstruction');
  const enInstructionEl = document.getElementById('enInstruction');
  const inventoryEl = document.getElementById('inventoryText');
  const objectiveEl = document.getElementById('objectiveText');
  const fieldLogEl = document.getElementById('fieldLog');
  const soundBtn = document.getElementById('soundBtn');
  const mapBtn = document.getElementById('mapBtn');
  const resetBtn = document.getElementById('resetBtn');
  const collectionBtn = document.getElementById('collectionBtn');
  const collectionBtnCountEl = document.getElementById('collectionBtnCount');
  const continueCampaignBtn = document.getElementById('continueCampaignBtn');

  const glyphPopup = document.getElementById('glyphPopup');
  const glyphPopupGlyph = document.getElementById('glyphPopupGlyph');
  const glyphPopupTitle = document.getElementById('glyphPopupTitle');
  const glyphPopupSource = document.getElementById('glyphPopupSource');
  const glyphPopupCount = document.getElementById('glyphPopupCount');
  const glyphPopupClose = document.getElementById('glyphPopupClose');

  const collectionOverlay = document.getElementById('collectionOverlay');
  const collectionClose = document.getElementById('collectionClose');
  const collectionCountEl = document.getElementById('collectionCount');
  const collectionLevelProgressEl = document.getElementById('collectionLevelProgress');
  const glyphGrid = document.getElementById('glyphGrid');

  const sentenceOverlay = document.getElementById('sentenceOverlay');
  const sentenceTitle = document.getElementById('sentenceTitle');
  const sentenceSlots = document.getElementById('sentenceSlots');
  const sentenceStatus = document.getElementById('sentenceStatus');
  const sentenceCompleteBtn = document.getElementById('sentenceCompleteBtn');
  const sentenceCloseBtn = document.getElementById('sentenceCloseBtn');

  const puzzleOverlay = document.getElementById('puzzleOverlay');
  const puzzleEyebrow = document.getElementById('puzzleEyebrow');
  const puzzleTitle = document.getElementById('puzzleTitle');
  const puzzleInstructions = document.getElementById('puzzleInstructions');
  const puzzleBody = document.getElementById('puzzleBody');
  const puzzleCard = document.getElementById('puzzleCard');
  const puzzleSlots = document.getElementById('puzzleSlots');
  const puzzleLiveCartoucheWrap = document.getElementById('puzzleLiveCartoucheWrap');
  const puzzleLiveCartoucheCanvas = document.getElementById('puzzleLiveCartoucheCanvas');
  const puzzleLiveCartoucheSource = document.getElementById('puzzleLiveCartoucheSource');
  const puzzleTrayWrap = document.getElementById('puzzleTrayWrap');
  const puzzleTray = document.getElementById('puzzleTray');
  const puzzleStatus = document.getElementById('puzzleStatus');
  const puzzleResetBtn = document.getElementById('puzzleResetBtn');
  const puzzleCompleteBtn = document.getElementById('puzzleCompleteBtn');
  const puzzleCloseBtn = document.getElementById('puzzleCloseBtn');

  const levelIntroOverlay = document.getElementById('levelIntroOverlay');
  const levelIntroTitle = document.getElementById('levelIntroTitle');
  const levelIntroCartouche = document.getElementById('levelIntroCartouche');
  const levelIntroLatinNumber = document.getElementById('levelIntroLatinNumber');
  const levelIntroHint = document.getElementById('levelIntroHint');
  const levelIntroStartBtn = document.getElementById('levelIntroStartBtn');

  const levelCompleteOverlay = document.getElementById('levelCompleteOverlay');
  const levelCompleteCard = document.getElementById('levelCompleteCard');
  const levelCompleteEyebrow = document.getElementById('levelCompleteEyebrow');
  const levelCompleteTitle = document.getElementById('levelCompleteTitle');
  const levelCompleteText = document.getElementById('levelCompleteText');
  const levelCompleteCount = document.getElementById('levelCompleteCount');
  const campaignCompleteBadge = document.getElementById('campaignCompleteBadge');
  const campaignConfetti = document.getElementById('campaignConfetti');
  const continueLevelBtn = document.getElementById('continueLevelBtn');
  const stayLevelBtn = document.getElementById('stayLevelBtn');

  const resetConfirmOverlay = document.getElementById('resetConfirmOverlay');
  const resetConfirmProgress = document.getElementById('resetConfirmProgress');
  const resetConfirmCancelBtn = document.getElementById('resetConfirmCancelBtn');
  const resetConfirmStartBtn = document.getElementById('resetConfirmStartBtn');

  const mobileMovePad = document.getElementById('mobileMovePad');
  const mobileJoystickThumb = document.getElementById('mobileJoystickThumb');
  const mobileUseBtn = document.getElementById('mobileUseBtn');
  const mazeQuickExitBtn = document.getElementById('mazeQuickExitBtn');
  const languageSelect = document.getElementById('languageSelect');

  function applyStaticLanguage() {
    document.documentElement.lang = isTpLanguage() ? 'tok' : 'en';
    document.title = uiText('pageTitle');
    const set = (id,key,opts={}) => renderLocalized(document.getElementById(id), uiText(key), opts);
    set('skipLink','skipToGame');
    set('pageTitle','pageTitle');
    set('languageLabel','languageLabel',{sitelen:false});
    set('introHelp','intro');
    set('localInstructionLabel','hudLocalInstruction');
    set('currentObjectiveLabel','hudCurrentObjective');
    set('controlsTitle','controlsTitle');
    set('mouseHint','mouseHint');
    set('collectionTitleLabel','glyphCollection');
    set('collectionBtnLabel','glyphCollection');
    set('controlLegend','controlsLegend');
    set('glyphHelpText','glyphHelp');
    set('referenceLabel','reference');
    set('cheatSheetLink','cheatSheet');
    set('fieldNotesSummary','fieldNotes');
    set('levelIntroEyebrow','level');
    set('levelIntroHint','tapStart');
    set('levelIntroStartBtn','start');
    set('glyphRecoveredEyebrow','glyphRecovered');
    set('glyphPopupClose','continue');
    set('collectionEyebrow','gameQuest');
    set('collectionHelp','collectionHelp');
    set('collectionClose','close');
    set('sentenceEyebrow','glyphInscription');
    set('sentenceTitle','incompleteSentence');
    set('sentenceCompleteBtn','completeSentence');
    set('sentenceCloseBtn','leaveInscription');
    set('puzzleEyebrow','glyphKeyPuzzle');
    set('currentCartoucheLabel','currentCartouche');
    set('availableGlyphKeysLabel','availableGlyphKeys');
    set('puzzleResetBtn','clear');
    set('puzzleCompleteBtn','tryAnswer');
    set('puzzleCloseBtn','leavePuzzle');
    set('levelCompleteEyebrow','levelCompleteEyebrow');
    set('levelCompleteTitle','levelComplete');
    set('levelCompleteText','levelObjectivesComplete');
    set('campaignCompleteBadge','campaignComplete');
    set('stayLevelBtn','stayHere');
    set('resetConfirmEyebrow','confirmNewGame');
    set('resetConfirmTitle','startNewGameQ');
    set('resetConfirmText','resetWarning');
    set('resetConfirmCancelBtn','cancel');
    set('resetConfirmStartBtn','yesNewGame');
    set('mobileUseBtn','use');
    set('mazeQuickExitBtn','leaveMaze');
    const home = document.querySelector('.pageHomeLink');
    if (home) { home.setAttribute('aria-label', uiText('home')); home.title = uiText('home'); }
    document.querySelector('.gameFrame')?.setAttribute('aria-label', isTpLanguage() ? 'musi tomo pi lukin jan' : 'First-person room explorer');
    canvas?.setAttribute('aria-label', isTpLanguage() ? 'lukin musi pi jan lon tomo' : 'First-person game view');
    miniMap?.setAttribute('aria-label', isTpLanguage()
      ? 'sitelen ma alasa. lon ilo luka la o luka e sitelen ma, o awen e luka. ni la jan li lukin li tawa lon nasin pi ma luka. sina ken luka e ma pi kama lukin ala. sitelen nasin li pini lon poka pi ma lukin.'
      : 'Explored map. On touch devices, touch and hold anywhere on the map to point and travel in that direction, including unrevealed or non-floor areas. If the drag starts on the map, it may continue beyond the map while steering. Guidance dots stop at the revealed frontier.');
    mobileMovePad?.setAttribute('aria-label', isTpLanguage() ? 'ilo sike tawa: o tawa e sike kepeken luka. ni li tawa li sike e jan' : 'Movement joystick: drag to move and steer');
    mobileUseBtn?.setAttribute('aria-label', isTpLanguage() ? 'o kepeken e ijo poka' : 'Use or interact');
    mazeQuickExitBtn?.setAttribute('aria-label', isTpLanguage() ? 'o tawa weka tan nasin nasa pini' : 'Leave solved maze quickly');
    mazeQuickExitBtn?.setAttribute('title', isTpLanguage() ? 'o tawa weka tan nasin nasa (X)' : 'Leave solved maze (X)');
    glyphGrid?.setAttribute('aria-label', isTpLanguage() ? 'kulupu sitelen 120' : '120 glyph collection');
    puzzleSlots?.setAttribute('aria-label', isTpLanguage() ? 'ma pana sitelen pi musi sona' : 'Puzzle glyph slots');
    document.getElementById('levelIntroCartouche')?.setAttribute('aria-label', isTpLanguage() ? 'nanpa ma musi lon poki nanpa-linja-n lili' : 'Level number as an abbreviated nanpa-linja-n numeric cartouche');
    document.getElementById('puzzleLiveCartoucheCanvas')?.setAttribute('aria-label', isTpLanguage() ? 'poki sitelen lon tenpo ni' : 'Current sitelen cartouche preview');
    document.getElementById('puzzleTray')?.setAttribute('aria-label', isTpLanguage() ? 'sitelen ken' : 'Available glyph keys');
    if (languageSelect) languageSelect.value = uiLanguage;
  }

  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;

  const PANELS = {
    entrySentence: {
      title: 'Entry inscription',
      words: ['o','open','e','lupa','sewi'],
      reward: 'sewi',
      completionText: 'o open e lupa sewi.'
    },
    powerSentence: {
      title: 'Upper-gallery inscription',
      words: ['wawa','li','lon','anpa'],
      reward: 'wawa',
      completionText: 'wawa li lon anpa.'
    }
  };

  const levels = {
    main: {
      chapter: 1, z: 0, label: 'ground level',
      map: [
        '####################',
        '#.....#............#',
        '#.....#............#',
        '#.....#............#',
        '#..................#',
        '#.....#............#',
        '#.....#............#',
        '##########D#########',
        '#..................#',
        '#..................#',
        '#..................#',
        '####################'
      ],
      rooms: [
        { areaId:'entry', name:'Entry Chamber', x1:1, y1:1, x2:5.99, y2:6.99, instruction:'o lukin. o alasa e sitelen.', hint:'Two introductory glyphs teach collection and reusable keys.' },
        { areaId:'workshop', name:'Workshop', x1:6.0, y1:1, x2:18.9, y2:6.99, instruction:() => state.ballOnTable ? 'pona.' : 'o pana e sike lon supa.', hint:() => state.ballOnTable ? 'The physical mechanism has responded.' : 'Put the ball on the table.' },
        { areaId:'concourse', name:'Lower Concourse', x1:1, y1:8, x2:18.9, y2:10.9, instruction:'o alasa e nasin.', hint:'The maze and upper route branch from here.' }
      ],
      doors: [{ id:'workshopGate', x:10, y:7, open:false, label:'concourse gate', unlockState:'workshopDoorOpen', autoOpenState:'workshopDoorOpen' }],
      objects: [
        { id:'glyphO', type:'glyph', word:'o', x:3.25, y:3.0, scale:0.58, radius:0.26, interact:'campaignPickup', puzzleId:'l1-intro-o', areaId:'entry' },
        { id:'glyphE', type:'glyph', word:'e', x:4.55, y:5.7, scale:0.58, radius:0.26, interact:'campaignPickup', puzzleId:'l1-intro-e', areaId:'entry' },
        { id:'ball', type:'ball', x:9.3, y:4.7, scale:0.62, radius:0.24, interact:'ball' },
        { id:'table', type:'table', x:12.0, y:5.2, scale:1.16, radius:0.52, interact:'table', puzzleId:'l1-ball-table', areaId:'workshop' },
        { id:'mazeEntrance', type:'mazeGate', x:3.0, y:9.15, scale:1.02, radius:0.45, interact:'mazeEnter', areaId:'concourse' },
        { id:'ladderMain', type:'ladder', x:16.0, y:9.15, scale:1.08, radius:0.34, interact:'ladderUp', areaId:'concourse' }
      ]
    },

    maze: {
      chapter:1, z:0, label:'physical maze', defaultAreaId:'mazeHub',
      map: [
        '############################',
        '#.......#.....#.#.#...#.####',
        '#.###.#.###.#.#.#.###.#.####',
        '#.#...#...#.#.#.#...#...####',
        '#####.###.#.#.#.#.#.#.#.####',
        '#.......#...#.#...#...#.####',
        '###.#.###########.##########',
        '#.#.#...#.#...#.........D..#',
        '#.#####.#.#.#####.###.######',
        '#.....#.....#.....#.....####',
        '###.#.###.#.#.###.#.###.####',
        '#...#.#...#.#...#.#...#.####',
        '#.#######.#####.#######.####',
        '#.#.#.........#.#...#.#.####',
        '#.#.#####.#.###.###.#.#.####',
        '#.........#.....#.......####',
        '############################'
      ],
      rooms: [
        { areaId:'mazeA', name:'Maze dead end A', x1:12.7, y1:4.7, x2:13.9, y2:5.9, instruction:'o alasa e sitelen.', hint:'Marker 1 is at a true dead end.' },
        { areaId:'mazeB', name:'Maze dead end B', x1:4.7, y1:10.7, x2:5.9, y2:11.9, instruction:'o alasa e sitelen.', hint:'Marker 2 is far from the first.' },
        { areaId:'mazeC', name:'Maze dead end C', x1:16.7, y1:12.7, x2:17.9, y2:13.9, instruction:'o alasa e sitelen.', hint:'Marker 3 completes the maze set.' },
        { areaId:'mazeInner', name:'Sealed maze chamber', x1:25.0, y1:7.0, x2:26.9, y2:7.95, instruction:'o lukin e nanpa.', hint:'Power elsewhere unlocks this delayed-return chamber.' },
        { areaId:'mazeHub', name:'Maze', x1:1, y1:1, x2:26.9, y2:15.9, instruction:'o alasa e sitelen tu wan.', hint:'Explore the branches and return to the marked entrance.' }
      ],
      doors:[{ id:'innerMazeDoor', x:24, y:7, open:false, label:'sealed inner maze door', autoOpenState:'innerMazeDoorUnlocked' }],
      objects:[
        { id:'mazeExit', type:'mazeGate', x:1.50, y:1.18, scale:0.90, radius:0.40, interact:'mazeExit', puzzleId:'l1-maze-code', areaId:'mazeHub' },
        { id:'glyphSeli', type:'glyph', word:'seli', x:13.45, y:5.45, scale:0.60, radius:0.27, interact:'campaignPickup', puzzleId:'l1-maze-seli', areaId:'mazeA', rewardSource:'Maze marker 1.' },
        { id:'glyphAwen', type:'glyph', word:'awen', x:5.45, y:11.45, scale:0.60, radius:0.27, interact:'campaignPickup', puzzleId:'l1-maze-awen', areaId:'mazeB', rewardSource:'Maze marker 2.' },
        { id:'glyphLuka', type:'glyph', word:'luka', x:17.45, y:13.45, scale:0.60, radius:0.27, interact:'campaignPickup', puzzleId:'l1-maze-luka', areaId:'mazeC', rewardSource:'Maze marker 3.' },
        { id:'innerNumberPanel', type:'glyphPanel', x:25.65, y:7.45, scale:0.80, radius:0.30, interact:'campaignPuzzle', puzzleId:'l1-inner-signed-number', areaId:'mazeInner' }
      ]
    },

    upper: {
      chapter:1, z:1, label:'upper level',
      map:[
        '####################','#........#.........#','#........#.........#','#........#.........#','#........P.........#','#........#.........#','#........#.........#','#........#.........#','#........#.........#','#........#.........#','#........#.........#','####################'
      ],
      rooms:[
        { areaId:'upper', name:'Upper Gallery', x1:1,y1:1,x2:8.99,y2:10.9, instruction:'o pali e poki nanpa.', hint:'Build the first abbreviated numeric cartouche.' },
        { areaId:'observation', name:'Observation Room', x1:10.01,y1:1,x2:18.9,y2:10.9, instruction:'o lukin e ilo sona.', hint:'The Level 1 terminal is here.' }
      ],
      doors:[{ id:'observationDoor', x:9,y:4,open:false,label:'observation door',unlockState:'observationDoorUnlocked' }],
      objects:[
        { id:'ladderUpper', type:'ladder', x:2.2,y:2.0,scale:1.05,radius:0.34,interact:'ladderDown',areaId:'upper' },
        { id:'upperNumberPanel', type:'glyphPanel', x:7.2,y:2.0,scale:0.88,radius:0.34,interact:'campaignPuzzle',puzzleId:'l1-upper-number',areaId:'upper' },
        { id:'trapdoorUpper', type:'trapdoor', x:5.6,y:8.2,scale:0.88,radius:0.48,interact:'trapdoor',areaId:'upper' },
        { id:'terminal', type:'terminal', x:15.4,y:4.4,scale:1.0,radius:0.42,interact:'campaignPuzzle',puzzleId:'l1-terminal',areaId:'observation' }
      ]
    },

    lower: {
      chapter:1,z:-1,label:'maintenance level',
      map:[
        '####################','#..................#','#..................#','#..................#','#..................#','#..................#','#.......####.......#','#.......#..#.......#','#.......#..#.......#','#.......####.......#','#..................#','####################'
      ],
      rooms:[{ areaId:'maintenance',name:'Maintenance Level',x1:1,y1:1,x2:18.9,y2:10.9,instruction:() => campaignWorld().powerOn ? 'wawa li lon.' : 'o ante e nanpa.',hint:() => campaignWorld().powerOn ? 'Power is restored; return to the maze.' : 'Reverse the five digit glyphs.' }],
      doors:[],
      objects:[
        { id:'ladderLower',type:'ladder',x:5.6,y:2.1,scale:1.05,radius:0.34,interact:'lowerLadderUp',areaId:'maintenance' },
        { id:'console',type:'console',x:13.2,y:4.4,scale:1.10,radius:0.48,interact:'campaignPuzzle',puzzleId:'l1-maintenance-sequence',areaId:'maintenance' }
      ]
    },

    l2main: {
      chapter:2,z:0,label:'level 2 foundation wing',
      map:[
        '########################',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#..............D.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '####D##############D####',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#......D.......D.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '########################'
      ],
      rooms:[
        {areaId:'l2Atrium',name:'Second Atrium',x1:1,y1:1,x2:6.9,y2:6.9,instruction:'o lukin e nanpa.',hint:'The first station uses the five Level 1 digit glyphs.'},
        {areaId:'l2Workshop',name:'Number Workshop',x1:8,y1:1,x2:14.9,y2:6.9,instruction:'o lukin e kiwen.',hint:'A material/index puzzle controls cartography access.'},
        {areaId:'l2Cartography',name:'Cartography Room',x1:16,y1:1,x2:22.9,y2:6.9,instruction:'o lukin e ma.',hint:'A coordinate clue can reveal something elsewhere in this level.'},
        {areaId:'l2Archive',name:'Lower Archive',x1:1,y1:7,x2:6.9,y2:12.9,instruction:'o alasa e sona.',hint:'The archive holds another digit sequence and, later, the hidden cache.'},
        {areaId:'l2Lab',name:'Notation Laboratory',x1:8,y1:7,x2:14.9,y2:12.9,instruction:'o pali e nanpa.',hint:'Thousands, scientific notation, and full-form structure are introduced here.'},
        {areaId:'l2Vault',name:'Foundation Vault',x1:16,y1:7,x2:22.9,y2:12.9,instruction:'o pini e pali.',hint:'Confirm the complete twenty-glyph foundation set.'}
      ],
      doors:[
        {id:'l2ArchiveDoor',x:4,y:7,open:false,label:'archive door',unlockState:'l2ArchiveAccess'},
        {id:'l2CartographyDoor',x:15,y:4,open:false,label:'cartography door',unlockState:'l2CartographyAccess'},
        {id:'l2LabDoor',x:7,y:10,open:false,label:'laboratory door',unlockState:'l2LabAccess',autoOpenState:'l2LabAccess'},
        {id:'l2VaultDoor',x:15,y:10,open:false,label:'foundation vault door',unlockState:'l2VaultAccess',autoOpenState:'l2VaultAccess'},
        {id:'l2VaultNorthDoor',x:19,y:7,open:false,label:'foundation vault north door',unlockState:'l2VaultAccess',autoOpenState:'l2VaultAccess'}
      ],
      objects:[
        {id:'l2DigitPanel',type:'glyphPanel',x:3.0,y:3.0,scale:0.90,radius:0.34,interact:'campaignPuzzle',puzzleId:'l2-digit-order',areaId:'l2Atrium'},
        {id:'l2CountryPanel',type:'glyphPanel',x:5.2,y:5.2,scale:0.78,radius:0.30,interact:'campaignPuzzle',puzzleId:'l2-country-kana',areaId:'l2Atrium'},
        {id:'l2StonePanel',type:'console',x:11.4,y:3.2,scale:0.94,radius:0.38,interact:'campaignPuzzle',puzzleId:'l2-workshop-stones',areaId:'l2Workshop'},
        {id:'l2MapPanel',type:'glyphPanel',x:19.2,y:3.1,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l2-map-cache',areaId:'l2Cartography'},
        {id:'l2ArchivePanel',type:'glyphPanel',x:5.2,y:9.8,scale:0.86,radius:0.32,interact:'campaignPuzzle',puzzleId:'l2-archive-sequence',areaId:'l2Archive'},
        {id:'l2HiddenCache',type:'console',x:3.5,y:9.5,scale:0.72,radius:0.32,interact:'campaignPuzzle',puzzleId:'l2-hidden-cache',areaId:'l2Archive',visibleWhen:() => Boolean(campaignWorld().cacheRevealed)},
        {id:'l2ThousandsPanel',type:'glyphPanel',x:10.0,y:9.0,scale:0.82,radius:0.31,interact:'campaignPuzzle',puzzleId:'l2-thousands',areaId:'l2Lab'},
        {id:'l2ScientificPanel',type:'console',x:12.7,y:9.4,scale:0.82,radius:0.34,interact:'campaignPuzzle',puzzleId:'l2-scientific',areaId:'l2Lab'},
        {id:'l2FullFormPanel',type:'glyphPanel',x:11.4,y:11.4,scale:0.82,radius:0.31,interact:'campaignPuzzle',puzzleId:'l2-full-form-bridge',areaId:'l2Lab'},
        {id:'l2VaultTerminal',type:'terminal',x:19.7,y:9.4,scale:1.0,radius:0.42,interact:'campaignPuzzle',puzzleId:'l2-vault-terminal',areaId:'l2Vault'}
      ]
    },

    l3main: {
      chapter:3,z:0,label:'level 3 signal and time wing',
      map:[
        '############################',
        '#........#........#........#',
        '#........#........#........#',
        '#........#........#........#',
        '#........D........#........#',
        '#........#........D........#',
        '#........#........#........#',
        '#######################D####',
        '#........#........#........#',
        '#........#........#........#',
        '#........D........#........#',
        '#........#........D........#',
        '#........#........#........#',
        '#........#........#........#',
        '#........#........#........#',
        '############################'
      ],
      rooms:[
        {areaId:'l3Chronology',name:'Chronology Hall',x1:1,y1:1,x2:8.9,y2:6.9,instruction:'o pona e tenpo.',hint:'Three clock dials obey three simultaneous clues.'},
        {areaId:'l3Relay',name:'Relay Gallery',x1:10,y1:1,x2:17.9,y2:6.9,instruction:'o nasin e kalama.',hint:'Rotate the relay pieces until one signal reaches the output.'},
        {areaId:'l3Navigation',name:'Navigation Floor',x1:19,y1:1,x2:26.9,y2:6.9,instruction:'o tawa lon nasin.',hint:'Visit the beacons in order before reaching the exit.'},
        {areaId:'l3Observation',name:'Observation Chamber',x1:19,y1:8,x2:26.9,y2:14.9,instruction:'o lukin e suno lili.',hint:'Each lamp affects its neighbours.'},
        {areaId:'l3Workshop',name:'Instrument Workshop',x1:10,y1:8,x2:17.9,y2:14.9,instruction:'o sama e suli.',hint:'Balance the target using each available weight at most once.'},
        {areaId:'l3Core',name:'Synchronization Core',x1:1,y1:8,x2:8.9,y2:14.9,instruction:'o anu e poki nanpa pi tenpo ni.',hint:'Choose the contextual numeric cartouche that matches the time display.'}
      ],
      doors:[
        {id:'l3RelayDoor',x:9,y:4,open:false,label:'relay door',unlockState:'l3RelayAccess',autoOpenState:'l3RelayAccess'},
        {id:'l3NavigationDoor',x:18,y:5,open:false,label:'navigation door',unlockState:'l3NavigationAccess',autoOpenState:'l3NavigationAccess'},
        {id:'l3ObservationDoor',x:23,y:7,open:false,label:'observation door',unlockState:'l3ObservationAccess',autoOpenState:'l3ObservationAccess'},
        {id:'l3WorkshopDoor',x:18,y:11,open:false,label:'workshop door',unlockState:'l3WorkshopAccess',autoOpenState:'l3WorkshopAccess'},
        {id:'l3CoreDoor',x:9,y:10,open:false,label:'synchronization core door',unlockState:'l3CoreAccess',autoOpenState:'l3CoreAccess'}
      ],
      objects:[
        {id:'l3ClockConsole',type:'console',x:4.3,y:3.2,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l3-clock-alignment',areaId:'l3Chronology'},
        {id:'l3RelayPanel',type:'glyphPanel',x:14.2,y:3.4,scale:0.90,radius:0.34,interact:'campaignPuzzle',puzzleId:'l3-relay-routing',areaId:'l3Relay'},
        {id:'l3PathConsole',type:'console',x:23.2,y:3.2,scale:0.92,radius:0.38,interact:'campaignPuzzle',puzzleId:'l3-path-circuit',areaId:'l3Navigation'},
        {id:'l3LightsPanel',type:'glyphPanel',x:23.1,y:11.2,scale:0.92,radius:0.34,interact:'campaignPuzzle',puzzleId:'l3-lights-pattern',areaId:'l3Observation'},
        {id:'l3BalanceConsole',type:'console',x:14.1,y:11.2,scale:0.94,radius:0.38,interact:'campaignPuzzle',puzzleId:'l3-balance-machine',areaId:'l3Workshop'},
        {id:'l3CoreTerminal',type:'terminal',x:4.2,y:11.2,scale:1.0,radius:0.42,interact:'campaignPuzzle',puzzleId:'l3-context-match',areaId:'l3Core'}
      ]
    },

    l4main: {
      chapter:4,z:0,label:'level 4 machine and equivalence wing',
      map:[
        '########################',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#......D.......D.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '####D######D############',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '#......#.......D.......#',
        '#......#.......#.......#',
        '#......#.......#.......#',
        '########################'
      ],
      rooms:[
        {areaId:'l4Pump',name:'Pump Hall',x1:1,y1:1,x2:6.9,y2:6.9,instruction:'o pana e telo lon poki.',hint:'Use the two vessels to measure the target amount exactly.'},
        {areaId:'l4Junction',name:'Machine Junction',x1:8,y1:1,x2:14.9,y2:6.9,instruction:'o alasa e nasin tu.',hint:'After the reservoir is solved, Stackworks and the Codebreaker Lab can be tackled in either order.'},
        {areaId:'l4Stack',name:'Stackworks',x1:16,y1:1,x2:22.9,y2:6.9,instruction:'o tawa e leko sike.',hint:'Move the stack without ever placing a larger disc on a smaller disc.'},
        {areaId:'l4Code',name:'Codebreaker Lab',x1:1,y1:8,x2:6.9,y2:12.9,instruction:'o alasa e nasin pi sitelen tu tu.',hint:'Test symbol codes and use the exact/misplaced feedback.'},
        {areaId:'l4Ratio',name:'Equivalence Gallery',x1:8,y1:8,x2:14.9,y2:12.9,instruction:'o sama e nanpa.',hint:'Align fraction, decimal and percentage cartouches that represent the same quantity.'},
        {areaId:'l4Schedule',name:'Schedule Archive',x1:16,y1:8,x2:22.9,y2:12.9,instruction:'o pona e tenpo.',hint:'Order events by both their date and time cartouches.'}
      ],
      doors:[
        {id:'l4JunctionDoor',x:7,y:4,open:false,label:'machine junction door',unlockState:'l4BranchAccess',autoOpenState:'l4BranchAccess'},
        {id:'l4StackDoor',x:15,y:4,open:false,label:'stackworks door',unlockState:'l4BranchAccess',autoOpenState:'l4BranchAccess'},
        {id:'l4CodeDoor',x:4,y:7,open:false,label:'codebreaker lab door',unlockState:'l4BranchAccess',autoOpenState:'l4BranchAccess'},
        {id:'l4RatioDoor',x:11,y:7,open:false,label:'equivalence gallery door',unlockStates:['l4StackDone','l4CodeDone'],autoOpenStates:['l4StackDone','l4CodeDone']},
        {id:'l4ScheduleDoor',x:15,y:10,open:false,label:'schedule archive door',unlockState:'l4RatioDone',autoOpenState:'l4RatioDone'}
      ],
      objects:[
        {id:'l4JugConsole',type:'console',x:3.5,y:3.3,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l4-jug-transfer',areaId:'l4Pump'},
        {id:'l4HanoiPanel',type:'glyphPanel',x:19.4,y:3.4,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l4-hanoi-stack',areaId:'l4Stack'},
        {id:'l4CodeConsole',type:'console',x:3.7,y:10.3,scale:0.94,radius:0.38,interact:'campaignPuzzle',puzzleId:'l4-codebreaker',areaId:'l4Code'},
        {id:'l4RatioPanel',type:'glyphPanel',x:11.4,y:10.2,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l4-equivalence',areaId:'l4Ratio'},
        {id:'l4ScheduleTerminal',type:'terminal',x:19.4,y:10.2,scale:0.98,radius:0.40,interact:'campaignPuzzle',puzzleId:'l4-schedule-order',areaId:'l4Schedule'}
      ]
    },

    l5main: {
      chapter:5,z:0,label:'level 5 transit and strategy wing',
      map:[
        '############################',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......D.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '####D########D########D#####',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '############################'
      ],
      rooms:[
        {areaId:'l5River',name:'River Dock',x1:1,y1:1,x2:7.9,y2:6.9,instruction:'o tawa e jan ale lon telo.',hint:'The boat carries you and one passenger; unsafe pairs cannot be left unattended.'},
        {areaId:'l5Junction',name:'Transit Junction',x1:9,y1:1,x2:17.9,y2:6.9,instruction:'o alasa e nasin tu.',hint:'The Freight Bay and Sliding Gallery can be solved in either order.'},
        {areaId:'l5Slide',name:'Sliding Gallery',x1:19,y1:1,x2:26.9,y2:6.9,instruction:'o pona e leko tawa.',hint:'Slide numbered tiles into their ordered positions.'},
        {areaId:'l5Freight',name:'Freight Bay',x1:1,y1:8,x2:7.9,y2:13.9,instruction:'o pana e poki tawa ma ona.',hint:'Push the crates onto both marked bays.'},
        {areaId:'l5Strategy',name:'Strategy Room',x1:9,y1:8,x2:17.9,y2:13.9,instruction:'o weka e palisa kepeken tawa.',hint:'Each jump removes the peg that was crossed.'},
        {areaId:'l5Pantry',name:'Pantry Observatory',x1:19,y1:8,x2:26.9,y2:13.9,instruction:'o sona e sitelen pi nanpa poka.',hint:'Use the row and column clues to reconstruct the pantry inventory pattern.'}
      ],
      doors:[
        {id:'l5JunctionDoor',x:8,y:4,open:false,label:'transit junction door',unlockState:'l5BranchAccess',autoOpenState:'l5BranchAccess'},
        {id:'l5SlideDoor',x:18,y:4,open:false,label:'sliding gallery door',unlockState:'l5BranchAccess',autoOpenState:'l5BranchAccess'},
        {id:'l5FreightDoor',x:4,y:7,open:false,label:'freight bay door',unlockState:'l5BranchAccess',autoOpenState:'l5BranchAccess'},
        {id:'l5StrategyDoor',x:13,y:7,open:false,label:'strategy room door',unlockStates:['l5FreightDone','l5SlideDone'],autoOpenStates:['l5FreightDone','l5SlideDone']},
        {id:'l5PantryDoor',x:22,y:7,open:false,label:'pantry observatory door',unlockState:'l5StrategyDone',autoOpenState:'l5StrategyDone'}
      ],
      objects:[
        {id:'l5RiverConsole',type:'console',x:3.7,y:3.4,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l5-river-crossing',areaId:'l5River'},
        {id:'l5SlidePanel',type:'glyphPanel',x:23.0,y:3.4,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l5-sliding-grid',areaId:'l5Slide'},
        {id:'l5FreightConsole',type:'console',x:3.7,y:10.6,scale:0.94,radius:0.38,interact:'campaignPuzzle',puzzleId:'l5-sokoban-freight',areaId:'l5Freight'},
        {id:'l5PegPanel',type:'glyphPanel',x:13.4,y:10.6,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l5-peg-line',areaId:'l5Strategy'},
        {id:'l5PantryTerminal',type:'terminal',x:23.0,y:10.6,scale:0.98,radius:0.40,interact:'campaignPuzzle',puzzleId:'l5-pantry-nonogram',areaId:'l5Pantry'}
      ]
    },

    l6main: {
      chapter:6,z:0,label:'level 6 records and number systems wing',
      map:[
        '############################',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......D.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '####D########D##############',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '############################'
      ],
      rooms:[
        {areaId:'l6Cards',name:'Card Archive',x1:1,y1:1,x2:7.9,y2:6.9,instruction:'o pona e lipu musi.',hint:'Sort the five sitelen playing cards by rank.'},
        {areaId:'l6Junction',name:'Records Junction',x1:9,y1:1,x2:17.9,y2:6.9,instruction:'o alasa e nasin tu.',hint:'The Calculation Bench and Country Index can be solved in either order.'},
        {areaId:'l6Crossword',name:'Country Index',x1:19,y1:1,x2:26.9,y2:6.9,instruction:'o sona e nimi ma.',hint:'Solve the crossing country proper names with reusable glyph initials.'},
        {areaId:'l6Calculator',name:'Calculation Bench',x1:1,y1:8,x2:7.9,y2:13.9,instruction:'o pali e nanpa.',hint:'Solve three renderer-backed calculations, including negative and decimal values.'},
        {areaId:'l6Bases',name:'Number Systems Lab',x1:9,y1:8,x2:17.9,y2:13.9,instruction:'o sama e nasin nanpa.',hint:'Match decimal values to binary Noka and hexadecimal Nasa cartouches.'},
        {areaId:'l6Vault',name:'Position Vault',x1:19,y1:8,x2:26.9,y2:13.9,instruction:'o pona e sike lon.',hint:'Use the relative-position clues to align four eight-position rings.'}
      ],
      doors:[
        {id:'l6JunctionDoor',x:8,y:4,open:false,label:'records junction door',unlockState:'l6BranchAccess',autoOpenState:'l6BranchAccess'},
        {id:'l6CrosswordDoor',x:18,y:4,open:false,label:'country index door',unlockState:'l6BranchAccess',autoOpenState:'l6BranchAccess'},
        {id:'l6CalculatorDoor',x:4,y:7,open:false,label:'calculation bench door',unlockState:'l6BranchAccess',autoOpenState:'l6BranchAccess'},
        {id:'l6BasesDoor',x:13,y:7,open:false,label:'number systems lab door',unlockStates:['l6CalculatorDone','l6CrosswordDone'],autoOpenStates:['l6CalculatorDone','l6CrosswordDone']},
        {id:'l6VaultDoor',x:18,y:10,open:false,label:'position vault door',unlockState:'l6BasesDone',autoOpenState:'l6BasesDone'}
      ],
      objects:[
        {id:'l6CardTable',type:'table',x:3.7,y:3.4,scale:0.98,radius:0.42,interact:'campaignPuzzle',puzzleId:'l6-card-order',areaId:'l6Cards'},
        {id:'l6CrosswordPanel',type:'glyphPanel',x:23.0,y:3.4,scale:0.94,radius:0.34,interact:'campaignPuzzle',puzzleId:'l6-country-crossword',areaId:'l6Crossword'},
        {id:'l6CalculatorConsole',type:'console',x:3.7,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l6-calculator',areaId:'l6Calculator'},
        {id:'l6BaseConsole',type:'console',x:13.4,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l6-base-match',areaId:'l6Bases'},
        {id:'l6RingTerminal',type:'terminal',x:23.0,y:10.6,scale:0.98,radius:0.40,interact:'campaignPuzzle',puzzleId:'l6-position-rings',areaId:'l6Vault'}
      ]
    },

    l7main: {
      chapter:7,z:0,label:'level 7 sensory systems wing',
      map:[
        '############################',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......D.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '####D########D##############',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '############################'
      ],
      rooms:[
        {areaId:'l7Echo',name:'Resonance Hall',x1:1,y1:1,x2:7.9,y2:6.9,instruction:'o kute. o pana sin e kalama.',hint:'Listen to the five-tone pattern and repeat it.'},
        {areaId:'l7Junction',name:'Sensor Junction',x1:9,y1:1,x2:17.9,y2:6.9,instruction:'o lukin e nasin tu.',hint:'Airflow Gallery and Pulse Chamber can be solved in either order.'},
        {areaId:'l7Airflow',name:'Airflow Gallery',x1:19,y1:1,x2:26.9,y2:6.9,instruction:'o pana e kon tawa lupa tu.',hint:'Rotate the ducts so the inlet reaches both outlets.'},
        {areaId:'l7Pulse',name:'Pulse Chamber',x1:1,y1:8,x2:7.9,y2:13.9,instruction:'o sama e pilin sijelo.',hint:'Coupled lane controls shift one pulse lane and disturb the next.'},
        {areaId:'l7Spectrum',name:'Spectrum Laboratory',x1:9,y1:8,x2:17.9,y2:13.9,instruction:'o pona e nasin kule.',hint:'Arrange the five filters so all positional clues agree.'},
        {areaId:'l7Power',name:'Blackout Substation',x1:19,y1:8,x2:26.9,y2:13.9,instruction:'o pana e wawa pi mute pona.',hint:'Choose a unique set of breaker loads matching the target.'}
      ],
      doors:[
        {id:'l7JunctionDoor',x:8,y:4,open:false,label:'sensor junction door',unlockState:'l7BranchAccess',autoOpenState:'l7BranchAccess'},
        {id:'l7AirflowDoor',x:18,y:4,open:false,label:'airflow gallery door',unlockState:'l7BranchAccess',autoOpenState:'l7BranchAccess'},
        {id:'l7PulseDoor',x:4,y:7,open:false,label:'pulse chamber door',unlockState:'l7BranchAccess',autoOpenState:'l7BranchAccess'},
        {id:'l7SpectrumDoor',x:13,y:7,open:false,label:'spectrum laboratory door',unlockStates:['l7AirflowDone','l7PulseDone'],autoOpenStates:['l7AirflowDone','l7PulseDone']},
        {id:'l7PowerDoor',x:18,y:10,open:false,label:'blackout substation door',unlockState:'l7SpectrumDone',autoOpenState:'l7SpectrumDone'}
      ],
      objects:[
        {id:'l7ToneConsole',type:'console',x:3.7,y:3.4,scale:0.98,radius:0.42,interact:'campaignPuzzle',puzzleId:'l7-tone-sequence',areaId:'l7Echo'},
        {id:'l7AirflowConsole',type:'console',x:23.0,y:3.4,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l7-airflow-network',areaId:'l7Airflow'},
        {id:'l7PulseConsole',type:'console',x:3.7,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l7-pulse-sync',areaId:'l7Pulse'},
        {id:'l7SpectrumConsole',type:'glyphPanel',x:13.4,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l7-spectrum-order',areaId:'l7Spectrum'},
        {id:'l7PowerConsole',type:'terminal',x:23.0,y:10.6,scale:0.98,radius:0.40,interact:'campaignPuzzle',puzzleId:'l7-power-balance',areaId:'l7Power'}
      ]
    },

    l8main: {
      chapter:8,z:0,label:'level 8 constraint systems wing',
      map:[
        '############################',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......D.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '####D########D##############',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........D........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '#.......#.........#........#',
        '############################'
      ],
      rooms:[
        {areaId:'l8Deduction',name:'Deduction Chamber',x1:1,y1:1,x2:7.9,y2:6.9,instruction:'o pana e ijo lon nasin pona.',hint:'All seven ordering clues must agree at once.'},
        {areaId:'l8Junction',name:'Constraint Junction',x1:9,y1:1,x2:17.9,y2:6.9,instruction:'o tawa nasin tu.',hint:'Dual Mirror Array and Truth Gate Rack are independent branches.'},
        {areaId:'l8Mirror',name:'Dual Mirror Array',x1:19,y1:1,x2:26.9,y2:6.9,instruction:'o tawa e suno tu.',hint:'Both beams must reach their own exits simultaneously.'},
        {areaId:'l8Truth',name:'Truth Gate Rack',x1:1,y1:8,x2:7.9,y2:13.9,instruction:'o pona e lupa sona.',hint:'Choose three gates that satisfy all eight test rows.'},
        {areaId:'l8Schedule',name:'Dependency Scheduler',x1:9,y1:8,x2:17.9,y2:13.9,instruction:'o pana e pali lon tenpo pona.',hint:'Every ordering dependency must hold at the same time.'},
        {areaId:'l8Transit',name:'Transit Vault',x1:19,y1:8,x2:26.9,y2:13.9,instruction:'o tawa kepeken nasin wan.',hint:'Reach the exit in exactly eight moves and hit the exact sum without revisiting.'}
      ],
      doors:[
        {id:'l8JunctionDoor',x:8,y:4,open:false,label:'constraint junction door',unlockState:'l8BranchAccess',autoOpenState:'l8BranchAccess'},
        {id:'l8MirrorDoor',x:18,y:4,open:false,label:'dual mirror array door',unlockState:'l8BranchAccess',autoOpenState:'l8BranchAccess'},
        {id:'l8TruthDoor',x:4,y:7,open:false,label:'truth gate rack door',unlockState:'l8BranchAccess',autoOpenState:'l8BranchAccess'},
        {id:'l8ScheduleDoor',x:13,y:7,open:false,label:'dependency scheduler door',unlockStates:['l8MirrorDone','l8TruthDone'],autoOpenStates:['l8MirrorDone','l8TruthDone']},
        {id:'l8TransitDoor',x:18,y:10,open:false,label:'transit vault door',unlockState:'l8ScheduleDone',autoOpenState:'l8ScheduleDone'}
      ],
      objects:[
        {id:'l8DeductionConsole',type:'console',x:3.7,y:3.4,scale:0.98,radius:0.42,interact:'campaignPuzzle',puzzleId:'l8-deduction-order',areaId:'l8Deduction'},
        {id:'l8MirrorConsole',type:'console',x:23.0,y:3.4,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l8-dual-mirror',areaId:'l8Mirror'},
        {id:'l8TruthConsole',type:'terminal',x:3.7,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l8-truth-gates',areaId:'l8Truth'},
        {id:'l8ScheduleConsole',type:'glyphPanel',x:13.4,y:10.6,scale:0.96,radius:0.38,interact:'campaignPuzzle',puzzleId:'l8-dependency-schedule',areaId:'l8Schedule'},
        {id:'l8TransitConsole',type:'terminal',x:23.0,y:10.6,scale:0.98,radius:0.40,interact:'campaignPuzzle',puzzleId:'l8-transit-vault',areaId:'l8Transit'}
      ]
    },

    l9upper: {
      chapter:9,z:1,label:'level 9 upper galleries',
      map:[
        '######################',
        '#.........#..........#',
        '#.........#..........#',
        '#....................#',
        '#.........#..........#',
        '#.........#..........#',
        '#.........#..........#',
        '#....................#',
        '#.........#..........#',
        '#.........#..........#',
        '#.........#..........#',
        '#.........#..........#',
        '######################'
      ],
      rooms:[
        {areaId:'l9Survey',name:'Survey Gallery',x1:1,y1:1,x2:9.9,y2:11.9,instruction:'o alasa e nasin anpa.',hint:'A ladder descends into the labyrinth. The final vault trapdoor will appear on this floor later.'},
        {areaId:'l9Loft',name:'Counterweight Loft',x1:10.1,y1:1,x2:20.9,y2:11.9,instruction:'o lukin e ilo pi nasin.',hint:'One relic begins here. Later, the counterweight system opens a direct vertical shortcut and the shaft-polarity console becomes useful.'}
      ],
      doors:[],
      objects:[
        {id:'l9UpperMazeLadder',type:'ladder',x:3.0,y:9.2,scale:1.08,radius:0.34,interact:'l9UpperToMaze',areaId:'l9Survey'},
        {id:'l9OrbRelic',type:'relic',word:'sike',carryId:'orb',x:7.0,y:3.2,scale:0.72,radius:0.28,interact:'l9CarryRelic',areaId:'l9Survey'},
        {id:'l9PolarityConsole',type:'console',x:15.8,y:4.1,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l9-route-polarity',areaId:'l9Loft'},
        {id:'l9SphinxShortcutLadder',type:'ladder',x:18.0,y:9.1,scale:1.06,radius:0.34,interact:'l9UpperShortcutToSphinx',areaId:'l9Loft',visibleWhen:()=>Boolean(campaignWorld().l9LowerAccess)},
        {id:'l9WeightShortcutLadder',type:'ladder',x:13.0,y:9.1,scale:1.06,radius:0.34,interact:'l9UpperShortcutToWeights',areaId:'l9Loft',visibleWhen:()=>Boolean(campaignWorld().l9ShortcutActive)},
        {id:'l9VaultTrapdoorUpper',type:'trapdoor',x:5.8,y:5.6,scale:0.9,radius:0.46,interact:'l9UpperToVault',areaId:'l9Survey',visibleWhen:()=>Boolean(campaignWorld().l9VaultAccess)}
      ]
    },

    l9maze: {
      chapter:9,z:0,label:'level 9 vertical labyrinth',defaultAreaId:'l9Maze',
      map:[
        '###############################',
        '#...........#...............#.#',
        '###.#.#.###.#.#############.#.#',
        '#.#.#.#...#...#...........#.#.#',
        '#.#.####..#####...######..#.#.#',
        '#.#.......#.......#.......#...#',
        '#.#########...#.###..########.#',
        '#...#.....#.........#.......#.#',
        '#.#.#.##..#........##.###..##.#',
        '#.#.#.#...#.............#.....#',
        '#.###.#.................#######',
        '#.#...#...#...................#',
        '#.#.###.#.#.........#####..####',
        '#.#...#.#.#.............#.....#',
        '#.###.#.#.###....####.#.#####.#',
        '#.#...#.#...#.#...#.#.#.....#.#',
        '#.#.###...###.#.#.#.#.##.##.#.#',
        '#...#.#.#.#...#.....#...#.#...#',
        '#.###.#.###.##.#####.##.#.###.#',
        '#.....#.................#.....#',
        '###############################'
      ],
      rooms:[
        {areaId:'l9Sphinx',name:'Sphinx Court',x1:12,y1:7,x2:18.99,y2:13.99,instruction:'o pana e sona tawa jan lawa.',hint:'The Sphinx answers only after all three survey markers have been inspected. Solving it opens quick exits here.'},
        {areaId:'l9Maze',name:'Vertical Labyrinth',x1:1,y1:1,x2:29.9,y2:19.9,instruction:'o alasa e sitelen tu wan.',hint:'The marked entrance ladder stays visible on the minimap. Branches begin almost immediately; inspect three distant survey markers and find the maze relic.'}
      ],
      doors:[],
      objects:[
        {id:'l9MazeEntranceLadder',type:'ladder',x:1.55,y:1.55,scale:1.02,radius:0.34,interact:'l9MazeToUpper',areaId:'l9Maze'},
        {id:'l9MarkerNorth',type:'glyphPanel',markerId:'north-marker',x:3.5,y:9.5,scale:0.7,radius:0.28,interact:'l9MazeMarker',puzzleId:'l9-maze-survey',areaId:'l9Maze'},
        {id:'l9MarkerWest',type:'glyphPanel',markerId:'west-marker',x:5.5,y:17.5,scale:0.7,radius:0.28,interact:'l9MazeMarker',puzzleId:'l9-maze-survey',areaId:'l9Maze'},
        {id:'l9MarkerSouth',type:'glyphPanel',markerId:'south-marker',x:25.5,y:17.5,scale:0.7,radius:0.28,interact:'l9MazeMarker',puzzleId:'l9-maze-survey',areaId:'l9Maze'},
        {id:'l9StoneRelic',type:'relic',word:'kiwen',carryId:'stone',x:29.5,y:1.5,scale:0.72,radius:0.28,interact:'l9CarryRelic',areaId:'l9Maze'},
        {id:'l9SphinxTerminal',type:'terminal',x:15.5,y:10.4,scale:1.05,radius:0.4,interact:'campaignPuzzle',puzzleId:'l9-sphinx-riddles',areaId:'l9Sphinx'},
        {id:'l9SphinxUpperLadder',type:'ladder',x:13.4,y:8.5,scale:1.0,radius:0.34,interact:'l9SphinxToUpper',areaId:'l9Sphinx',visibleWhen:()=>Boolean(campaignWorld().l9LowerAccess)},
        {id:'l9SphinxTrapdoor',type:'trapdoor',x:17.2,y:12.2,scale:0.88,radius:0.46,interact:'l9SphinxToLower',areaId:'l9Sphinx',visibleWhen:()=>Boolean(campaignWorld().l9LowerAccess)}
      ]
    },

    l9lower: {
      chapter:9,z:-1,label:'level 9 lower shafts',
      map:[
        '##########################',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '#..........##............#',
        '##########################'
      ],
      rooms:[
        {areaId:'l9Weights',name:'Counterweight Chamber',x1:1,y1:1,x2:10.9,y2:11.9,instruction:'o pana e ijo lon supa pona.',hint:'Three relics from three floors belong on three different pedestals. Placed relics can be picked up again.'},
        {areaId:'l9Vault',name:'Alignment Vault',x1:13,y1:1,x2:24.9,y2:11.9,instruction:'o sama e nasin pi tomo sewi en tomo anpa.',hint:'Rotate the three floor plans until all three vertical shafts line up with the marked coordinates.'}
      ],
      doors:[],
      objects:[
        {id:'l9LowerReturnLadder',type:'ladder',x:2.2,y:2.0,scale:1.04,radius:0.34,interact:'l9LowerToSphinx',areaId:'l9Weights'},
        {id:'l9VesselRelic',type:'relic',word:'poki',carryId:'vessel',x:8.3,y:3.1,scale:0.72,radius:0.28,interact:'l9CarryRelic',areaId:'l9Weights'},
        {id:'l9PedestalWest',type:'pedestal',pedestalId:'west',x:3.1,y:8.6,scale:0.82,radius:0.38,interact:'l9RelicPedestal',puzzleId:'l9-counterweight',areaId:'l9Weights'},
        {id:'l9PedestalCenter',type:'pedestal',pedestalId:'center',x:5.8,y:8.6,scale:0.82,radius:0.38,interact:'l9RelicPedestal',puzzleId:'l9-counterweight',areaId:'l9Weights'},
        {id:'l9PedestalEast',type:'pedestal',pedestalId:'east',x:8.5,y:8.6,scale:0.82,radius:0.38,interact:'l9RelicPedestal',puzzleId:'l9-counterweight',areaId:'l9Weights'},
        {id:'l9WeightsShortcutUp',type:'ladder',x:9.0,y:2.0,scale:1.04,radius:0.34,interact:'l9WeightsToUpper',areaId:'l9Weights',visibleWhen:()=>Boolean(campaignWorld().l9ShortcutActive)},
        {id:'l9VaultReturnLadder',type:'ladder',x:23.0,y:2.0,scale:1.04,radius:0.34,interact:'l9VaultToUpper',areaId:'l9Vault'},
        {id:'l9AlignmentConsole',type:'console',x:19.2,y:7.3,scale:1.05,radius:0.42,interact:'campaignPuzzle',puzzleId:'l9-layer-alignment',areaId:'l9Vault'}
      ]
    },

    l10ground: {
      chapter:10,z:0,label:'level 10 market ground',defaultAreaId:'l10Market',
      map:[
        '###############################',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#....................D........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '###############################'
      ],
      rooms:[
        {areaId:'l10Receiving',name:'Receiving Bay',x1:1,y1:1,x2:8.9,y2:13.9,instruction:'o pana e poki tawa ilo tawa.',hint:'The powered delivery cart can hold two bulk crates. Load both Receiving crates, then send the cart to the Market Arcade.'},
        {areaId:'l10Market',name:'Central Market Arcade',x1:9.1,y1:1,x2:20.9,y2:13.9,instruction:'o pona e esun. o pana e moku tawa ma pona.',hint:()=>campaignWorld().l10BasementOpen?'Delivery complete. The OPEN Cold Store hatch is marked ↓ on the minimap near the south-west side of this arcade.':'The till powers the ground-floor freight cart. The bakery stand is marked pan; the sweet-goods stand is marked suwi.'},
        {areaId:'l10Dispatch',name:'Dispatch Bay',x1:21.1,y1:1,x2:29.9,y2:13.9,instruction:'o tawa weka tan ma musi.',hint:()=>campaignWorld().l10ExitUnlocked?'Final audit approved. The exit terminal is active in this bay.':'Dispatch remains sealed until the final Ledger Office audit is approved.'}
      ],
      doors:[
        {id:'l10DispatchShutter',x:21,y:6,open:false,label:'final dispatch shutter',unlockState:'l10ExitUnlocked',autoOpenState:'l10ExitUnlocked'}
      ],
      objects:[
        {id:'l10Till',type:'console',x:15.2,y:3.0,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-market-till',areaId:'l10Market'},
        {id:'l10BreadCrate',type:'parcel',word:'pan',parcelId:'bread',x:3.0,y:3.2,scale:0.72,radius:0.3,interact:'l10BulkParcel',areaId:'l10Receiving'},
        {id:'l10SweetCrate',type:'parcel',word:'suwi',parcelId:'sweet',x:6.2,y:3.2,scale:0.72,radius:0.3,interact:'l10BulkParcel',areaId:'l10Receiving'},
        {id:'l10BakeryStand',type:'pedestal',standId:'bakery',expectedParcel:'bread',expectedWord:'pan',standLabel:'bakery',x:12.0,y:4.8,scale:0.88,radius:0.38,interact:'l10DeliveryStand',puzzleId:'l10-delivery-routing',areaId:'l10Market'},
        {id:'l10SweetStand',type:'pedestal',standId:'sweet-stall',expectedParcel:'sweet',expectedWord:'suwi',standLabel:'sweet-goods',x:18.2,y:4.8,scale:0.88,radius:0.38,interact:'l10DeliveryStand',puzzleId:'l10-delivery-routing',areaId:'l10Market'},
        {id:'l10CartReceiving',type:'cart',dockId:'receiving',x:4.5,y:10.0,scale:1.0,radius:0.5,interact:'l10Cart',areaId:'l10Receiving'},
        {id:'l10CartMarket',type:'cart',dockId:'market',x:14.8,y:10.0,scale:1.0,radius:0.5,interact:'l10Cart',areaId:'l10Market'},
        {id:'l10CartCtlReceiving',type:'console',dockId:'receiving',x:7.0,y:10.2,scale:0.78,radius:0.36,interact:'l10CartControl',areaId:'l10Receiving'},
        {id:'l10CartCtlMarket',type:'console',dockId:'market',x:18.0,y:10.2,scale:0.78,radius:0.36,interact:'l10CartControl',areaId:'l10Market'},
        {id:'l10GroundColdLift',type:'trapdoor',x:11.2,y:12.0,scale:1.12,radius:0.54,interact:'l10GroundToLower',areaId:'l10Market',visibleWhen:()=>Boolean(campaignWorld().l10BasementOpen)},
        {id:'l10GroundAwningUp',type:'ladder',x:19.3,y:12.0,scale:1.0,radius:0.36,interact:'l10GroundToUpper',areaId:'l10Market',visibleWhen:()=>Boolean(campaignWorld().l10AwningOpen)},
        {id:'l10DispatchExit',type:'terminal',x:28.0,y:4.2,scale:0.9,radius:0.4,interact:'l10ExitTerminal',areaId:'l10Dispatch',visibleWhen:()=>Boolean(campaignWorld().l10ExitUnlocked)}
      ]
    },

    l10upper: {
      chapter:10,z:1,label:'level 10 upper loft',defaultAreaId:'l10Textile',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........D...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l10Textile',name:'Textile / Dye Loft',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o sama e telo kule. o pana e len tawa ilo pona.',hint:'Reconcile the three mixed-fraction dye batches, then carry each cloth batch to the correct station. Completion drops an awning shortcut to the market floor.'},
        {areaId:'l10Ledger',name:'Ledger Office',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o lukin e lipu pana. o anu e nasin pini.',hint:()=>campaignWorld().l10TextileDone&&!campaignWorld().l10ExitUnlocked?'FINAL OBJECTIVE: use the audit console marked ! in this office. Review the pan and suwi shipment records and classify each as Dispatch or Quarantine. You are not moving the goods again.':campaignWorld().l10ExitUnlocked?'Final audit complete. Dispatch Bay is now open on the market floor.':'The final audit console activates only after the textile routing is complete.'}
      ],
      doors:[
        {id:'l10LedgerShutter',x:12,y:6,open:false,label:'inspection ledger shutter',unlockState:'l10TextileDone',autoOpenState:'l10TextileDone'}
      ],
      objects:[
        {id:'l10UpperServiceLift',type:'ladder',x:2.5,y:10.6,scale:1.02,radius:0.36,interact:'l10UpperToLower',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10UpperLift)},
        {id:'l10UpperAwningDown',type:'ladder',x:10.3,y:10.6,scale:1.02,radius:0.36,interact:'l10UpperToGround',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10AwningOpen)},
        {id:'l10BlueCloth',type:'parcel',word:'laso',textileId:'blue-cloth',x:3.35,y:6.8,scale:0.82,radius:0.34,interact:'l10TextileParcel',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10DyeReady)},
        {id:'l10WhiteCloth',type:'parcel',word:'walo',textileId:'white-cloth',x:7.05,y:6.8,scale:0.82,radius:0.34,interact:'l10TextileParcel',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10DyeReady)},
        {id:'l10DyeMixer',type:'console',x:5.2,y:6.8,scale:0.96,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-textile-mixer',areaId:'l10Textile'},
        {id:'l10DyeFrame',type:'pedestal',expectedWord:'laso',stationId:'dye-frame',x:4.0,y:10.0,scale:0.88,radius:0.40,interact:'l10TextileStation',puzzleId:'l10-textile-routing',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10DyeReady)},
        {id:'l10FinishTable',type:'pedestal',expectedWord:'walo',stationId:'finish-table',x:8.0,y:10.0,scale:0.88,radius:0.40,interact:'l10TextileStation',puzzleId:'l10-textile-routing',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10DyeReady)},
        {id:'l10AuditConsole',type:'terminal',x:18.0,y:6.0,scale:1.08,radius:0.44,interact:'campaignPuzzle',puzzleId:'l10-inspection-audit',areaId:'l10Ledger',visibleWhen:()=>Boolean(campaignWorld().l10TextileDone)&&!campaignSolved('l10-inspection-audit')} 
      ]
    },

    l10lower: {
      chapter:10,z:-1,label:'level 10 cold basement',defaultAreaId:'l10Cold',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........D...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l10Cold',name:'Cold Store',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o pona e lete. o awen e ko lon nanpa pona.',hint:()=>campaignWorld().l10ColdStable&&!campaignWorld().l10ColdRecorded?'Cold chain stable. Use the scientific-record console to normalize 0.0042, 0.00075 and 125 before the service lift will unlock.':'Three coupled controls must simultaneously reach freezer −18.0, chilled store +4.0 and gel loop +0.5.'},
        {areaId:'l10Quarantine',name:'Quarantine',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o lukin e lipu awen ike.',hint:()=>campaignWorld().l10ExitUnlocked?'Audit status: the unsafe suwi shipment record is classified for quarantine. This room is optional after completion.':'Quarantine remains sealed until the Ledger Office audit is complete.'}
      ],
      doors:[
        {id:'l10QuarantineShutter',x:12,y:6,open:false,label:'quarantine status shutter',unlockState:'l10ExitUnlocked',autoOpenState:'l10ExitUnlocked'}
      ],
      objects:[
        {id:'l10ColdConsole',type:'console',x:5.5,y:4.2,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-cold-chain',areaId:'l10Cold'},
        {id:'l10ColdRecordConsole',type:'console',x:8.5,y:4.2,scale:0.92,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-cold-record',areaId:'l10Cold',visibleWhen:()=>Boolean(campaignWorld().l10ColdStable)},
        {id:'l10LowerGroundLift',type:'ladder',x:2.5,y:10.4,scale:1.02,radius:0.36,interact:'l10LowerToGround',areaId:'l10Cold'},
        {id:'l10LowerUpperLift',type:'ladder',x:9.2,y:10.4,scale:1.02,radius:0.36,interact:'l10LowerToUpper',areaId:'l10Cold',visibleWhen:()=>Boolean(campaignWorld().l10UpperLift)},
        {id:'l10QuarantineStatus',type:'terminal',x:18.0,y:8.0,scale:0.82,radius:0.38,interact:'l10QuarantineStatus',areaId:'l10Quarantine',visibleWhen:()=>Boolean(campaignWorld().l10ExitUnlocked)}
      ]
    },

    l11ground: {
      chapter:11,z:0,label:'level 11 nocturnal sanctuary ground',defaultAreaId:'l11Hub',
      map:[
        '###############################',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#....................#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '#........#...........#........#',
        '###############################'
      ],
      rooms:[
        {areaId:'l11Field',name:'Field Station',x1:1,y1:1,x2:8.9,y2:13.9,instruction:'o kute e kalama lon ma.',hint:'Three acoustic pylons are spread across the Field Station and Habitat Hub. Get close to each one and record it with E / USE.'},
        {areaId:'l11Hub',name:'Habitat Hub',x1:9.1,y1:1,x2:20.9,y2:13.9,instruction:'o alasa e ma pi kalama waso.',hint:()=>campaignWorld().l11CanopyOpen?'The triangulation is complete. The marked canopy ladder ↑ is now available in this hub.':'After all three call pylons are recorded, use the central triangulation console.'},
        {areaId:'l11Recovery',name:'Recovery Ward',x1:22.1,y1:1,x2:29.9,y2:13.9,instruction:'o pona e tomo soweli.',hint:'This isolated ward is reached only after the parent-band placement opens the canopy shortcut. Use the accumulated sanctuary records for the final triage.'}
      ],
      doors:[],
      objects:[
        {id:'l11CallA',type:'glyphPanel',pylonId:'A',x:3.2,y:3.2,scale:0.72,radius:0.3,interact:'l11CallPylon',puzzleId:'l11-call-survey',areaId:'l11Field'},
        {id:'l11CallB',type:'glyphPanel',pylonId:'B',x:6.4,y:10.4,scale:0.72,radius:0.3,interact:'l11CallPylon',puzzleId:'l11-call-survey',areaId:'l11Field'},
        {id:'l11CallC',type:'glyphPanel',pylonId:'C',x:16.0,y:4.0,scale:0.72,radius:0.3,interact:'l11CallPylon',puzzleId:'l11-call-survey',areaId:'l11Hub'},
        {id:'l11TriangulationConsole',type:'console',x:15.5,y:9.5,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l11-call-triangulation',areaId:'l11Hub'},
        {id:'l11GroundCanopyLadder',type:'ladder',x:19.0,y:12.0,scale:1.05,radius:0.38,interact:'l11GroundToCanopy',areaId:'l11Hub',visibleWhen:()=>Boolean(campaignWorld().l11CanopyOpen)},
        {id:'l11RecoveryCanopyLadder',type:'ladder',x:23.5,y:11.0,scale:1.05,radius:0.38,interact:'l11RecoveryToCanopy',areaId:'l11Recovery',visibleWhen:()=>Boolean(campaignWorld().l11RecoveryOpen)},
        {id:'l11TriageConsole',type:'console',x:26.0,y:5.0,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l11-habitat-triage',areaId:'l11Recovery'},
        {id:'l11ExitTerminal',type:'terminal',x:28.0,y:10.0,scale:0.9,radius:0.4,interact:'l11ExitTerminal',areaId:'l11Recovery',visibleWhen:()=>Boolean(campaignWorld().l11ExitUnlocked)}
      ]
    },

    l11canopy: {
      chapter:11,z:1,label:'level 11 canopy and nests',defaultAreaId:'l11Aviary',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#.......................#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l11Aviary',name:'Aviary Walk',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o pona e tenpo lape en tenpo moku.',hint:()=>campaignWorld().l11IncubatorOpen?'The overnight schedule is restored. The OPEN incubator hatch ↓ is marked on this floor.':'Put the four overnight roost/feeding records in chronological order; the sequence crosses midnight.'},
        {areaId:'l11Nest',name:'Nest Observatory',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o pana e linja mama tawa supa pona.',hint:()=>campaignWorld().l11BandsReleased?'The lineage registry released two tags here: loje → west perch; laso → east perch. Wrong placements are recoverable.':'Complete the lineage registry below; the parent bands will then be released here.'}
      ],
      doors:[],
      objects:[
        {id:'l11CanopyGroundLadder',type:'ladder',x:2.5,y:10.6,scale:1.02,radius:0.36,interact:'l11CanopyToGround',areaId:'l11Aviary'},
        {id:'l11RoostConsole',type:'console',x:5.5,y:4.0,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l11-roost-schedule',areaId:'l11Aviary'},
        {id:'l11CanopyIncubatorHatch',type:'trapdoor',x:9.2,y:10.5,scale:1.05,radius:0.48,interact:'l11CanopyToLower',areaId:'l11Aviary',visibleWhen:()=>Boolean(campaignWorld().l11IncubatorOpen)},
        {id:'l11RedBand',type:'parcel',word:'loje',bandId:'red-band',bandLabel:'loje',x:15.5,y:3.2,scale:0.66,radius:0.28,interact:'l11BandParcel',areaId:'l11Nest',visibleWhen:()=>Boolean(campaignWorld().l11BandsReleased)},
        {id:'l11BlueBand',type:'parcel',word:'laso',bandId:'blue-band',bandLabel:'laso',x:20.5,y:3.2,scale:0.66,radius:0.28,interact:'l11BandParcel',areaId:'l11Nest',visibleWhen:()=>Boolean(campaignWorld().l11BandsReleased)},
        {id:'l11WestPerch',type:'pedestal',perchId:'west-perch',expectedBand:'red-band',expectedWord:'loje',x:15.5,y:9.0,scale:0.82,radius:0.38,interact:'l11BandPerch',puzzleId:'l11-parent-bands',areaId:'l11Nest'},
        {id:'l11EastPerch',type:'pedestal',perchId:'east-perch',expectedBand:'blue-band',expectedWord:'laso',x:20.5,y:9.0,scale:0.82,radius:0.38,interact:'l11BandPerch',puzzleId:'l11-parent-bands',areaId:'l11Nest'},
        {id:'l11CanopyRecoveryLadder',type:'ladder',x:22.5,y:11.0,scale:1.04,radius:0.38,interact:'l11CanopyToRecovery',areaId:'l11Nest',visibleWhen:()=>Boolean(campaignWorld().l11RecoveryOpen)}
      ]
    },

    l11lower: {
      chapter:11,z:-1,label:'level 11 incubator service',defaultAreaId:'l11Incubator',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#.......................#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l11Incubator',name:'Incubator Service',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o lukin e ilo mama.',hint:'The hatch returns to the Aviary Walk. The connected registry contains four parent-pair records and four hatchling records.'},
        {areaId:'l11Registry',name:'Lineage Registry',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o sona e mama pi soweli lili.',hint:'Match hatchlings to parent pairs by the two preserved trait glyphs. Each pair is used once; completion releases the two physical parent bands in the Nest Observatory.'}
      ],
      doors:[],
      objects:[
        {id:'l11LowerCanopyLadder',type:'ladder',x:2.5,y:10.5,scale:1.02,radius:0.36,interact:'l11LowerToCanopy',areaId:'l11Incubator'},
        {id:'l11LineageConsole',type:'console',x:18.0,y:6.0,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l11-lineage-match',areaId:'l11Registry'}
      ]
    },

    l12ground: {
      chapter:12,z:0,label:'level 12 final archive ground',defaultAreaId:'l12Entry',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#.......................#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l12Entry',name:'Final Archive Vestibule',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o tawa tomo sona pini.',hint:'The final archive contains four master trials and one last Sudoku. The Fracture Core must be repaired first.'},
        {areaId:'l12Core',name:'Fracture Core',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o pona e nasin pakala.',hint:()=>campaignWorld().l12SpineOnline?'Archive spine repaired. The marked upper ladder ↑ and lower hatch ↓ are both active here.':'Solve the ten-switch parity core. It has one valid switch subset; Try answer never reveals correctness until submission.'}
      ],
      doors:[],
      objects:[
        {id:'l12ParityConsole',type:'console',x:18.0,y:5.2,scale:1.02,radius:0.42,interact:'campaignPuzzle',puzzleId:'l12-parity-core',areaId:'l12Core'},
        {id:'l12CoreUpperLadder',type:'ladder',x:15.0,y:10.4,scale:1.05,radius:0.38,interact:'l12GroundToUpper',areaId:'l12Core',visibleWhen:()=>Boolean(campaignWorld().l12SpineOnline)},
        {id:'l12CoreLowerHatch',type:'trapdoor',x:21.0,y:10.4,scale:1.05,radius:0.48,interact:'l12GroundToLower',areaId:'l12Core',visibleWhen:()=>Boolean(campaignWorld().l12SpineOnline)}
      ]
    },

    l12upper: {
      chapter:12,z:1,label:'level 12 final archive upper',defaultAreaId:'l12Identity',
      map:[
        '#########################',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#.......................#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#...........#...........#',
        '#########################'
      ],
      rooms:[
        {areaId:'l12Identity',name:'Identity Gallery',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o sona e nasin pi mi en sina.',hint:()=>campaignWorld().l12IdentityDone?'Identity permutation resolved. Continue into the Relation Observatory.':'Eight records and eight simultaneous positional clues determine exactly one ordering.'},
        {areaId:'l12Relation',name:'Relation Observatory',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o pona e linja lukin ale.',hint:()=>campaignWorld().l12IdentityDone?'Route all three beams through the ten shared mirrors to their matching exits.':'The mirror console will not accept a trial until the Identity Gallery is solved.'}
      ],
      doors:[],
      objects:[
        {id:'l12UpperGroundLadder',type:'ladder',x:2.5,y:10.4,scale:1.02,radius:0.36,interact:'l12UpperToGround',areaId:'l12Identity'},
        {id:'l12IdentityConsole',type:'console',x:5.5,y:4.2,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l12-identity-order',areaId:'l12Identity'},
        {id:'l12RelationConsole',type:'console',x:18.0,y:6.0,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l12-relation-mirrors',areaId:'l12Relation'}
      ]
    },

    l12lower: {
      chapter:12,z:-1,label:'level 12 final archive lower',defaultAreaId:'l12Cipher',
      map:[
        '#############',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#############'
      ],
      rooms:[
        {areaId:'l12Cipher',name:'Totality Cipher Vault',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o alasa e nimi ale pi poki sona.',hint:()=>campaignWorld().l12CipherDone?(campaignWorld().l12RelationDone?'Cipher and relation trials complete. The marked FINAL hatch ↓ is open.':'Cipher solved. Return upstairs and finish the Relation Observatory before the final hatch can open.'):'Deduce the six-glyph permutation from exact/misplaced feedback. The hidden code persists across reloads.'}
      ],
      doors:[],
      objects:[
        {id:'l12LowerGroundLadder',type:'ladder',x:2.5,y:10.4,scale:1.02,radius:0.36,interact:'l12LowerToGround',areaId:'l12Cipher'},
        {id:'l12CipherConsole',type:'console',x:5.5,y:4.2,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l12-master-code',areaId:'l12Cipher'},
        {id:'l12FinalHatch',type:'trapdoor',x:9.5,y:10.4,scale:1.08,radius:0.5,interact:'l12LowerToFinal',areaId:'l12Cipher',visibleWhen:()=>Boolean(campaignWorld().l12IdentityDone&&campaignWorld().l12CipherDone&&campaignWorld().l12RelationDone)}
      ]
    },

    l12final: {
      chapter:12,z:-2,label:'level 12 final sudoku chamber',defaultAreaId:'l12Final',
      map:[
        '#############',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#...........#',
        '#############'
      ],
      rooms:[
        {areaId:'l12Final',name:'Final Sudoku Chamber',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o pini e musi nanpa pini.',hint:()=>campaignWorld().l12ExitUnlocked?'The final Sudoku is solved. All 120 glyphs have been recovered.':'This is the last puzzle. Complete the medium 9×9 nanpa-linja-n Sudoku; use notes if needed and press Try answer only when ready.'}
      ],
      doors:[],
      objects:[
        {id:'l12FinalReturnLadder',type:'ladder',x:2.5,y:10.4,scale:1.02,radius:0.36,interact:'l12FinalToLower',areaId:'l12Final'},
        {id:'l12SudokuConsole',type:'console',x:6.0,y:5.0,scale:1.08,radius:0.42,interact:'campaignPuzzle',puzzleId:'l12-final-sudoku',areaId:'l12Final'},
        {id:'l12ExitTerminal',type:'terminal',x:9.5,y:10.4,scale:0.92,radius:0.4,interact:'l12ExitTerminal',areaId:'l12Final',visibleWhen:()=>Boolean(campaignWorld().l12ExitUnlocked)}
      ]
    }
  };

  function freshState() {
    return {
      version: SAVE_VERSION,
      saveEpoch: makeSaveEpoch('game'),
      levelId: 'main',
      chapter: 1,
      levelIntroPending: true,
      x: 3.1,
      y: 4.5,
      angle: 0,
      carrying: null,
      ballOnTable: false,
      lowerPowerOn: false,
      trapdoorOpen: false,
      levelCompleted: false,
      sound: true,
      mapVisible: true,
      openDoors: {},
      explored: {},
      visitedRooms: {},
      collected: {},
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
      campaign: null,
      log: []
    };
  }

  let state = freshState();
  let db = null;
  let saveQueued = false;
  let saveTimer = 0;
  let keys = Object.create(null);
  const mobileMove = { forward: false, back: false, turnLeft: false, turnRight: false, moveStrength: 0, turnStrength: 0 };
  const mobileJoystickGesture = { drive:'idle', steeringAngle:0, lastPointerAngle:null };
  const viewportMove = { mode:'idle', strength:0 };
  const VIEWPORT_MOVE_THRESHOLD = 0.36;
  const VIEWPORT_MOVE_EXPONENT = 1.7;
  const MOBILE_JOYSTICK_DEAD_RATIO = 0.34;
  // Short mobile landscape has less thumb travel and makes the old response feel
  // twitchy. Keep portrait behavior intact, but give landscape a slightly larger
  // neutral centre and lower movement/turn authority for finer control.
  const MOBILE_LANDSCAPE_JOYSTICK_DEAD_RATIO = 0.37;
  const MOBILE_LANDSCAPE_JOYSTICK_MOVE_SCALE = 0.80;
  const MOBILE_LANDSCAPE_JOYSTICK_TURN_SCALE = 0.50;
  const MOBILE_LANDSCAPE_JOYSTICK_TURN_MAX = 0.62;
  const MOBILE_JOYSTICK_MOVE_EXPONENT = 1.25;
  const MOBILE_JOYSTICK_TURN_EXPONENT = 2.25;
  const MOBILE_JOYSTICK_BOOST_START = 0.20;
  const MOBILE_JOYSTICK_MOVE_MAX = 2.65;
  const MOBILE_JOYSTICK_TURN_MAX = 1.65;
  const MOBILE_JOYSTICK_STEER_FULL_ANGLE = Math.PI / 3;
  const MOBILE_JOYSTICK_STEER_DEADBAND = Math.PI / 8;
  const MOBILE_JOYSTICK_MAX_FRAME_DT = 0.24;
  const MOBILE_JOYSTICK_MAX_SIM_STEP = 1 / 60;
  const mobileMapSteer = { active:false, pointerId:null, levelId:null, targetCell:null, targetPoint:null, direction:null, path:[], pathIndex:0 };
  let lastTime = performance.now();
  let messageTimer = 0;
  let currentTarget = null;
  let pointerLocked = false;
  let dragging = false;
  let dragPointerId = null;
  let lastPointerX = 0;
  let audioCtx = null;
  let activePanelId = null;
  let modalOpen = false;
  let campaignAdapter = null;
  let activeCampaignPuzzle = null;
  let puzzleSlotValues = [];
  let selectedPuzzleGlyph = null;
  let selectedPuzzleFamily = null;
  let selectedPuzzleSlotIndex = null;
  let puzzleMechanismState = null;
  let puzzleDrag = null;
  let tutorialSubmissionFeedback = null;
  const PUZZLE_DRAG_THRESHOLD = 8;
  let levelRendererPromise = null;
  let pendingGlyphRewards = [];
  let externalSaveConflictShown = false;

  const spriteCache = new Map();

  function isCoarsePointer() {
    try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }
    catch (_) { return false; }
  }

  function glyphChar(word) {
    const cp = WORD_TO_CP[word];
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : '?';
  }

  function campaignRuntime() { return campaignAdapter && campaignAdapter.runtime ? campaignAdapter.runtime : null; }
  function campaignWorld() {
    const rt = campaignRuntime();
    if (!rt) return {};
    try { return rt.levelState().world || {}; } catch (_) { return {}; }
  }
  function campaignSolved(puzzleId) {
    const rt = campaignRuntime();
    if (!rt) return false;
    try { return rt.solvedSet().has(puzzleId); } catch (_) { return false; }
  }
  function collected(word) {
    const rt = campaignRuntime();
    if (rt) return rt.globalGlyphs.has(word);
    return Boolean(state.collected && state.collected[word]);
  }
  function isCollectibleGlyph(word) { return STANDARD_120.includes(word); }
  function collectionCount() { return STANDARD_120.reduce((n, word) => n + (collected(word) ? 1 : 0), 0); }
  function syncCollectedMirror() {
    const rt = campaignRuntime();
    if (!rt) return;
    state.collected = {};
    for (const word of STANDARD_120) if (rt.globalGlyphs.has(word)) state.collected[word] = true;
  }
  function syncCampaignArea(areaId) {
    const rt = campaignRuntime();
    if (!rt || !areaId) return;
    rt.currentArea = areaId;
  }
  function campaignPuzzle(puzzleId) {
    const rt = campaignRuntime();
    return rt ? rt.puzzle(puzzleId) : null;
  }
  function campaignPuzzleAvailable(puzzleId) {
    if (!campaignAdapter) return false;
    return campaignAdapter.availablePuzzles().some(p => p.id === puzzleId);
  }
  function syncWorldFromCampaign() {
    if (!campaignAdapter) return;
    const world = campaignWorld();
    state.lowerPowerOn = Boolean(world.powerOn);
    state.trapdoorOpen = Boolean(world.maintenanceAccess);
    state.levelCompleted = Boolean(campaignAdapter.isLevelComplete());
    if (campaignSolved('l1-ball-table')) state.ballOnTable = true;
    for (const levelData of Object.values(levels)) {
      for (const door of levelData.doors) {
        if (door.autoOpenState) {
          door.open = Boolean(world[door.autoOpenState]);
          if (door.open) state.openDoors[door.id] = true;
        }
        if (Array.isArray(door.autoOpenStates) && door.autoOpenStates.length) {
          door.open = door.autoOpenStates.every(key => Boolean(world[key]));
          if (door.open) state.openDoors[door.id] = true;
        }
      }
    }
    syncCollectedMirror();
    spriteCache.clear();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  function dbGet() {
    return new Promise((resolve) => {
      if (!db) { resolve(null); return; }
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SAVE_ID);
      req.onsuccess = () => resolve(req.result ? req.result.state : null);
      req.onerror = () => resolve(null);
    });
  }

  function dbPut(snapshot) {
    return new Promise((resolve) => {
      if (!db) { resolve(); return; }
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: SAVE_ID, state: snapshot, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  function normalizeSavedState(saved) {
    if (!saved || saved.version !== SAVE_VERSION) return freshState();
    const next = Object.assign(freshState(), saved || {});
    next.version = SAVE_VERSION;
    next.saveEpoch = String(saved?.saveEpoch || '').trim() || makeSaveEpoch('legacy');
    next.collected = Object.assign({}, saved?.collected || {});
    next.completedPanels = Object.assign({}, saved?.completedPanels || {});
    next.puzzleVariants = Object.assign({}, saved?.puzzleVariants || {});
    next.l9Markers = Object.assign({}, saved?.l9Markers || {});
    next.l9Placements = Object.assign({}, saved?.l9Placements || {});
    next.l10CartDock = ['receiving','market'].includes(String(saved?.l10CartDock || 'receiving')) ? String(saved?.l10CartDock || 'receiving') : 'market';
    next.l10CartCargo = Array.isArray(saved?.l10CartCargo) ? saved.l10CartCargo.slice(0,2) : [];
    next.l10CartTrips = Number(saved?.l10CartTrips) || 0;
    next.l10DeliveryPlacements = Object.assign({}, saved?.l10DeliveryPlacements || {});
    next.l10ParcelLocations = Object.assign({bread:'receiving',sweet:'receiving'}, saved?.l10ParcelLocations || {});
    next.l10TextilePlacements = Object.assign({}, saved?.l10TextilePlacements || {});
    next.l10TextileLocations = Object.assign({'blue-cloth':'upper-rack','white-cloth':'upper-rack'}, saved?.l10TextileLocations || {});
    next.l10AuditPlacements = Object.assign({}, saved?.l10AuditPlacements || {});
    next.l10AuditLocations = Object.assign({'bread-sample':'ledger','sweet-sample':'ledger'}, saved?.l10AuditLocations || {});
    next.l10MechanismStates = Object.assign({}, saved?.l10MechanismStates || {});
    // v0.89 replaced the old physical audit-sample carrying stage with a Ledger Office record-classification console.
    if (String(next.carrying || '').startsWith('l10:audit:')) next.carrying = null;
    next.l10AuditPlacements = {};
    next.l10AuditLocations = {};
    next.l11CallMarkers = Object.assign({}, saved?.l11CallMarkers || {});
    next.l11BandPlacements = Object.assign({}, saved?.l11BandPlacements || {});
    next.l11BandLocations = Object.assign({'red-band':'rack','blue-band':'rack'}, saved?.l11BandLocations || {});
    next.l11MechanismStates = Object.assign({}, saved?.l11MechanismStates || {});
    next.l12MechanismStates = Object.assign({}, saved?.l12MechanismStates || {});
    next.openDoors = Object.assign({}, saved?.openDoors || {});
    next.explored = Object.assign({}, saved?.explored || {});
    next.visitedRooms = Object.assign({}, saved?.visitedRooms || {});
    next.log = Array.isArray(saved?.log) ? saved.log.slice(0, 40) : [];
    if (!levels[next.levelId]) return freshState();
    // Keep v0.3 saves usable after physical map refinements. If an old saved coordinate
    // now lands inside a wall, move only that position to a safe spawn for the same area.
    const savedMap = levels[next.levelId].map;
    const sx = Math.floor(Number(next.x));
    const sy = Math.floor(Number(next.y));
    const savedCell = savedMap?.[sy]?.[sx];
    if (!savedCell || savedCell === '#') {
      const fallback = {
        main:[3.1,4.5,0], maze:[1.5,1.82,Math.PI/2], upper:[2.3,2.5,0.15], lower:[5.8,2.8,1.55], l2main:[3.2,3.6,0], l3main:[4.2,3.6,0], l4main:[3.6,3.6,0], l5main:[3.6,3.6,0], l6main:[3.6,3.6,0], l7main:[3.6,3.6,0], l8main:[3.6,3.6,0], l9upper:[3.4,3.5,0], l9maze:[1.55,1.75,Math.PI/2], l9lower:[2.8,2.7,0], l10ground:[3.5,6.3,0], l10upper:[2.5,6.3,0], l10lower:[2.5,6.3,0], l11ground:[3.5,6.3,0], l11canopy:[2.5,6.3,0], l11lower:[2.5,6.3,0], l12ground:[3.5,6.3,0], l12upper:[2.5,6.3,0], l12lower:[2.5,6.3,0], l12final:[3.5,6.3,0]
      }[next.levelId] || [3.1,4.5,0];
      [next.x,next.y,next.angle] = fallback;
    }
    return next;
  }

  function saveState() {
    saveQueued = true;
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { flushSave(); }, 80);
  }

  async function flushSave(options) {
    const opts = options || {};
    if (!saveQueued && !opts.replace) return;
    saveQueued = false;
    if (campaignAdapter) state.campaign = campaignAdapter.snapshot();
    const snapshot = JSON.parse(JSON.stringify(state));

    if (!opts.replace && db) {
      const existing = await dbGet();
      const existingEpoch = String(existing?.saveEpoch || '').trim();
      const ours = String(snapshot.saveEpoch || '').trim();
      if (existingEpoch && ours && existingEpoch !== ours) {
        const directive = currentResetDirective();
        const oursIsActiveReset = directive && directive.epoch === ours;
        if (!oursIsActiveReset) {
          if (!externalSaveConflictShown) {
            externalSaveConflictShown = true;
            showMessage('Your progress changed in another window. Reload this page to continue.');
          }
          return;
        }
      }
    }

    await dbPut(snapshot);
  }

  function level() { return levels[state.levelId]; }

  function cellAt(x, y) {
    const map = level().map;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (iy < 0 || iy >= map.length || ix < 0 || ix >= map[iy].length) return '#';
    return map[iy][ix];
  }

  function doorAtCell(x, y) { return level().doors.find(d => d.x === x && d.y === y) || null; }

  function isSolidAt(x, y) {
    const c = cellAt(x, y);
    if (c === '#') return true;
    if (c === 'D' || c === 'P') {
      const d = doorAtCell(Math.floor(x), Math.floor(y));
      return !d || !d.open;
    }
    return false;
  }

  function canOccupy(x, y) {
    const r = PLAYER_RADIUS;
    return !isSolidAt(x-r, y-r) && !isSolidAt(x+r, y-r) && !isSolidAt(x-r, y+r) && !isSolidAt(x+r, y+r);
  }

  // Mobile movement uses the same player radius as desktop, but treats the
  // player as a circle against the square wall cells. This rounds exposed wall
  // corners instead of making the mobile player catch on the four corners of
  // the desktop square collision footprint. Full wall faces, closed doors and
  // diagonally touching solid cells remain impassable.
  function canOccupyMobile(x, y) {
    const r = PLAYER_RADIUS;
    const minX = Math.floor(x - r), maxX = Math.floor(x + r);
    const minY = Math.floor(y - r), maxY = Math.floor(y + r);
    const rr = r * r;
    for (let iy = minY; iy <= maxY; iy += 1) {
      for (let ix = minX; ix <= maxX; ix += 1) {
        if (!isSolidAt(ix + 0.5, iy + 0.5)) continue;
        const nearestX = Math.max(ix, Math.min(x, ix + 1));
        const nearestY = Math.max(iy, Math.min(y, iy + 1));
        const dx = x - nearestX, dy = y - nearestY;
        if (dx * dx + dy * dy < rr) return false;
      }
    }
    return true;
  }

  function movePlayer(dx, dy, mobileCornerAssist = false) {
    const canMoveTo = mobileCornerAssist ? canOccupyMobile : canOccupy;
    const nx = state.x + dx;
    const ny = state.y + dy;
    // Preserve the existing axis-separated wall slide. On mobile the circular
    // occupancy check makes exposed corners forgiving without permitting wall
    // penetration or changing the maze topology.
    if (canMoveTo(nx, state.y)) state.x = nx;
    if (canMoveTo(state.x, ny)) state.y = ny;
  }

  function normalizeAngle(a) {
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  }

  function castRay(angle, markExplored = false) {
    const rayDirX = Math.cos(angle);
    const rayDirY = Math.sin(angle);
    let mapX = Math.floor(state.x);
    let mapY = Math.floor(state.y);
    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);
    let stepX, stepY, sideDistX, sideDistY;

    if (rayDirX < 0) { stepX = -1; sideDistX = (state.x - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1 - state.x) * deltaDistX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (state.y - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1 - state.y) * deltaDistY; }

    let side = 0;
    let distance = 0;
    let cell = '#';
    let door = null;

    for (let i = 0; i < 64; i++) {
      if (markExplored) markCellExplored(mapX, mapY);
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX; mapX += stepX; side = 0;
      } else {
        sideDistY += deltaDistY; mapY += stepY; side = 1;
      }
      if (markExplored) markCellExplored(mapX, mapY);
      cell = cellAt(mapX + 0.01, mapY + 0.01);
      if (cell === '#' || cell === 'D' || cell === 'P') {
        if (cell === 'D' || cell === 'P') {
          door = doorAtCell(mapX, mapY);
          if (door?.open) continue;
        }
        distance = side === 0
          ? (mapX - state.x + (1 - stepX) / 2) / (rayDirX || 1e-9)
          : (mapY - state.y + (1 - stepY) / 2) / (rayDirY || 1e-9);
        break;
      }
    }
    return { distance: Math.max(0.0001, distance), side, cell, mapX, mapY, door };
  }

  function markCellExplored(x, y) {
    if (!state.explored[state.levelId]) state.explored[state.levelId] = {};
    state.explored[state.levelId][`${x},${y}`] = true;
  }

  function renderScene() {
    drawBackground();
    const zBuffer = new Float32Array(VIEW_W);
    for (let x = 0; x < VIEW_W; x++) {
      const cameraX = (2 * x / VIEW_W) - 1;
      const rayAngle = state.angle + Math.atan(cameraX * Math.tan(FOV / 2));
      const ray = castRay(rayAngle, x % 6 === 0);
      const correctedDist = ray.distance * Math.cos(rayAngle - state.angle);
      zBuffer[x] = correctedDist;
      drawWallColumn(x, correctedDist, ray);
    }
    drawSprites(zBuffer);
    drawHands();
    renderMiniMap();
  }

  function drawBackground() {
    const ceiling = ctx.createLinearGradient(0, 0, 0, VIEW_H / 2);
    if (state.levelId === 'lower') {
      ceiling.addColorStop(0, '#111516'); ceiling.addColorStop(1, '#28302d');
    } else if (state.levelId === 'upper') {
      ceiling.addColorStop(0, '#1a2630'); ceiling.addColorStop(1, '#38444a');
    } else if (state.levelId === 'next') {
      ceiling.addColorStop(0, '#20262a'); ceiling.addColorStop(1, '#3f474b');
    } else {
      ceiling.addColorStop(0, '#1b2226'); ceiling.addColorStop(1, '#323a3d');
    }
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H / 2);

    const floor = ctx.createLinearGradient(0, VIEW_H / 2, 0, VIEW_H);
    floor.addColorStop(0, state.levelId === 'lower' ? '#2a2e2a' : '#353330');
    floor.addColorStop(1, '#111315');
    ctx.fillStyle = floor;
    ctx.fillRect(0, VIEW_H / 2, VIEW_W, VIEW_H / 2);

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let y = VIEW_H / 2 + 8; y < VIEW_H; y += 16) ctx.fillRect(0, y, VIEW_W, 1);
    ctx.globalAlpha = 1;
  }

  function drawWallColumn(x, dist, ray) {
    const safeDist = Math.min(MAX_RAY_DISTANCE, Math.max(0.1, dist));
    const wallHeight = Math.min(VIEW_H * 2.2, VIEW_H / safeDist);
    const start = Math.floor(VIEW_H / 2 - wallHeight / 2);
    const end = Math.ceil(VIEW_H / 2 + wallHeight / 2);

    let base;
    if (ray.cell === 'D') base = [99, 82, 63];
    else if (ray.cell === 'P') base = state.lowerPowerOn ? [72, 103, 93] : [72, 74, 77];
    else if (state.levelId === 'lower') base = [94, 103, 91];
    else if (state.levelId === 'upper') base = [108, 119, 125];
    else if (state.levelId === 'next') base = [112, 109, 126];
    else base = [118, 113, 102];

    const shade = Math.max(0.28, 1 - safeDist / 15) * (ray.side ? 0.76 : 1);
    const r = Math.floor(base[0] * shade);
    const g = Math.floor(base[1] * shade);
    const b = Math.floor(base[2] * shade);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, start, 1, end - start);

    if (ray.cell === 'D' || ray.cell === 'P') {
      if ((x & 7) === 0) {
        ctx.fillStyle = `rgba(20,20,20,${0.22 + Math.min(0.35, safeDist / 50)})`;
        ctx.fillRect(x, start, 1, end - start);
      }
      const midY = Math.floor((start + end) / 2);
      if ((x % 17) === 0) {
        const poweredAndReady = state.lowerPowerOn && collected('sewi');
        ctx.fillStyle = poweredAndReady && ray.cell === 'P' ? 'rgba(150,220,190,.62)' : 'rgba(230,210,160,.28)';
        ctx.fillRect(x, midY - 2, 1, 4);
      }
    } else if ((x & 15) === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(x, start, 1, end - start);
    }
  }

  function l9RelicWord(carryId){
    return ({orb:'sike',stone:'kiwen',vessel:'poki'})[String(carryId||'')] || 'ijo';
  }

  function l9MarkerProgress(){
    const puzzle=campaignPuzzle('l9-maze-survey');
    const ids=puzzle?.ui?.payload?.markerIds||['north-marker','west-marker','south-marker'];
    const found=ids.filter(id=>Boolean(state.l9Markers?.[id])).length;
    return {found,needed:ids.length||3};
  }

  function l9RelicPlacedPedestal(carryId){
    const placements=state.l9Placements||{};
    return Object.keys(placements).find(key=>placements[key]===carryId)||null;
  }

  function l9CounterweightPlacementCorrect(){
    const puzzle=campaignPuzzle('l9-counterweight'),pedestals=puzzle?.ui?.payload?.pedestals||[],placements=state.l9Placements||{};
    return pedestals.length>0&&pedestals.every(p=>placements[p.id]===p.accept);
  }

  function l10ParcelWord(id){
    const words={bread:'pan',sweet:'suwi','blue-cloth':'laso','white-cloth':'walo','bread-sample':'pan','sweet-sample':'suwi'};
    return words[id]||'ijo';
  }

  function l10CartDockName(id){
    return ({receiving:'Receiving Bay',market:'Market Arcade'})[id]||id;
  }

  function l10CartDockEnabled(id){
    return (id==='receiving'||id==='market') && Boolean(campaignWorld().l10PowerOn);
  }

  function l10CartRecommendedDestination(from){
    return from==='market' ? 'receiving' : 'market';
  }

  function l10DeliveryStandSpec(standId){
    const puzzle=campaignPuzzle('l10-delivery-routing');
    return puzzle?.ui?.payload?.stands?.find(item=>item.id===standId)||null;
  }

  function l10DeliveryStandLabel(obj){
    return obj?.standLabel || (obj?.standId==='sweet-stall'?'sweet-goods':'bakery');
  }

  function l10DeliveryCorrect(){
    const placements=state.l10DeliveryPlacements||{};
    return placements.bakery==='bread'&&placements['sweet-stall']==='sweet';
  }

  function l10TextileCorrect(){
    const placements=state.l10TextilePlacements||{};
    return Boolean(campaignWorld().l10DyeReady)&&placements['dye-frame']==='blue-cloth'&&placements['finish-table']==='white-cloth';
  }


  function repairLevel10TextileState(){
    if(!campaignWorld().l10DyeReady || campaignSolved('l10-textile-routing')) return false;
    state.l10TextilePlacements=state.l10TextilePlacements||{};
    state.l10TextileLocations=state.l10TextileLocations||{};
    const validStations=new Set(['dye-frame','finish-table']);
    let changed=false;
    for(const textileId of ['blue-cloth','white-cloth']){
      const carrying=state.carrying===`l10:textile:${textileId}`;
      let placedAt=null;
      for(const [stationId,placedId] of Object.entries(state.l10TextilePlacements)){
        if(placedId===textileId && validStations.has(stationId)){placedAt=stationId;break;}
      }
      if(carrying){
        if(state.l10TextileLocations[textileId]!=='carrying'){state.l10TextileLocations[textileId]='carrying';changed=true;}
      }else if(placedAt){
        if(state.l10TextileLocations[textileId]!==placedAt){state.l10TextileLocations[textileId]=placedAt;changed=true;}
      }else if(state.l10TextileLocations[textileId]!=='upper-rack'){
        state.l10TextileLocations[textileId]='upper-rack';changed=true;
      }
    }
    // Remove stale duplicate/invalid placement entries left by older test saves.
    for(const [stationId,textileId] of Object.entries({...state.l10TextilePlacements})){
      if(!validStations.has(stationId) || !['blue-cloth','white-cloth'].includes(textileId)){
        delete state.l10TextilePlacements[stationId];changed=true;
      }
    }
    if(changed)spriteCache.clear();
    return changed;
  }

  function l10MaybeCompleteDelivery(){
    if(campaignSolved('l10-delivery-routing')||!l10DeliveryCorrect())return false;
    const result=completeCampaignPuzzle('l10-delivery-routing','Earned by routing the Receiving crates through the powered market freight system.');
    if(result.ok){spriteCache.clear();showMessage('Delivery complete. The Cold Store hatch is OPEN in the Market Arcade and marked ↓ on the minimap.');log('Level 10 delivery route complete: clearly marked Cold Store hatch opened in the Market Arcade.');}
    return Boolean(result.ok);
  }

  function l10MaybeCompleteTextile(){
    if(campaignSolved('l10-textile-routing')||!l10TextileCorrect())return false;
    const result=completeCampaignPuzzle('l10-textile-routing','Earned by preparing the dye bath and routing both cloth batches to the correct loft stations.');
    if(result.ok){showMessage('Textile batch complete. FINAL OBJECTIVE: the Ledger Office is now open upstairs. Use the audit console marked ! to review the pan and suwi shipment records.');log('Level 10 textile batch complete: awning shortcut opened and final Ledger audit activated.');}
    return Boolean(result.ok);
  }

  function l11CallProgress(){
    const ids=['A','B','C'];
    const found=ids.filter(id=>Boolean(state.l11CallMarkers?.[id])).length;
    return {found,needed:ids.length};
  }

  function l11BandWord(id){
    return ({'red-band':'loje','blue-band':'laso'})[String(id||'')] || 'linja';
  }

  function l11BandPerchSpec(perchId){
    const puzzle=campaignPuzzle('l11-parent-bands');
    return puzzle?.ui?.payload?.perches?.find(item=>item.id===perchId)||null;
  }

  function l11BandsCorrect(){
    const placements=state.l11BandPlacements||{};
    return placements['west-perch']==='red-band'&&placements['east-perch']==='blue-band';
  }

  function l11MaybeCompleteBands(){
    if(campaignSolved('l11-parent-bands')||!l11BandsCorrect())return false;
    const result=completeCampaignPuzzle('l11-parent-bands','Earned by placing both released lineage bands on their correct nest perches.');
    if(result.ok){showMessage('Parent bands aligned. A direct ladder opens from the Nest Observatory to the Recovery Ward.');log('Level 11 parent-band placement complete: Recovery Ward shortcut opened.');}
    return Boolean(result.ok);
  }

  function objectVisible(obj) {
    if (obj.puzzleId && obj.interact === 'campaignPickup' && campaignSolved(obj.puzzleId)) return false;
    if (obj.type === 'glyph' && obj.word && isCollectibleGlyph(obj.word) && collected(obj.word)) return false;
    if (typeof obj.visibleWhen === 'function' && !obj.visibleWhen()) return false;
    if (obj.id === 'ball' && (state.carrying === 'ball' || state.ballOnTable)) return false;
    if (obj.interact === 'l9MazeMarker' && (campaignSolved('l9-maze-survey') || state.l9Markers?.[obj.markerId])) return false;
    if (obj.interact === 'l9CarryRelic') {
      if (campaignSolved('l9-counterweight')) return false;
      if (state.carrying === `l9:${obj.carryId}` || l9RelicPlacedPedestal(obj.carryId)) return false;
    }
    if (obj.type === 'cart') return state.l10CartDock === obj.dockId;
    if (obj.interact === 'l10BulkParcel') {
      if (campaignSolved('l10-delivery-routing')) return false;
      return state.l10ParcelLocations?.[obj.parcelId] === 'receiving';
    }
    if (obj.interact === 'l10TextileParcel') {
      if (campaignSolved('l10-textile-routing')) return false;
      return state.l10TextileLocations?.[obj.textileId] === 'upper-rack';
    }
    if (obj.interact === 'l11BandParcel') {
      if (campaignSolved('l11-parent-bands')) return false;
      return state.l11BandLocations?.[obj.bandId] === 'rack';
    }
    return true;
  }

  function visibleObjects() { return level().objects.filter(objectVisible); }

  function drawSprites(zBuffer) {
    const sprites = visibleObjects().map(obj => {
      const dx = obj.x - state.x;
      const dy = obj.y - state.y;
      return { obj, dx, dy, dist: Math.hypot(dx, dy) };
    }).sort((a, b) => b.dist - a.dist);

    for (const item of sprites) {
      const rel = normalizeAngle(Math.atan2(item.dy, item.dx) - state.angle);
      if (Math.abs(rel) > FOV * 0.72) continue;
      const dist = item.dist * Math.cos(rel);
      if (dist <= 0.08 || dist > MAX_RAY_DISTANCE) continue;
      const screenX = VIEW_W / 2 + Math.tan(rel) * (VIEW_W / (2 * Math.tan(FOV / 2)));
      const sprite = getSprite(item.obj);
      const scale = item.obj.scale || 1;
      const height = Math.min(VIEW_H * 1.4, (VIEW_H / dist) * scale);
      const width = height * (sprite.width / sprite.height);
      const startX = Math.floor(screenX - width / 2);
      const startY = Math.floor(VIEW_H / 2 - height / 2 + sprite.verticalOffset * height);

      for (let sx = 0; sx < width; sx++) {
        const px = startX + sx;
        if (px < 0 || px >= VIEW_W || dist >= zBuffer[px]) continue;
        const srcX = Math.floor((sx / width) * sprite.canvas.width);
        ctx.drawImage(sprite.canvas, srcX, 0, 1, sprite.canvas.height, px, startY, 1, height);
      }
    }

    if (state.ballOnTable && state.levelId === 'main') {
      drawSingleSprite({ id: 'placedBall', type: 'ball', x: 11.9, y: 5.06, scale: 0.36 }, zBuffer, -0.52);
    }
    if (state.levelId === 'l9lower') {
      for (const pedestal of level().objects.filter(obj=>obj.type==='pedestal')) {
        const carryId=state.l9Placements?.[pedestal.pedestalId];
        if(!carryId)continue;
        drawSingleSprite({id:`l9Placed:${pedestal.pedestalId}`,type:'relic',word:l9RelicWord(carryId),x:pedestal.x,y:pedestal.y,scale:0.40},zBuffer,-0.48);
      }
    }
    if (state.levelId === 'l10ground') {
      for (const stand of level().objects.filter(obj=>obj.interact==='l10DeliveryStand')) {
        const parcelId=state.l10DeliveryPlacements?.[stand.standId];
        if(parcelId)drawSingleSprite({id:`l10DeliveryPlaced:${stand.standId}`,type:'parcel',word:l10ParcelWord(parcelId),x:stand.x,y:stand.y,scale:0.42},zBuffer,-0.50);
      }
    }
    if (state.levelId === 'l10upper') {
      for (const station of level().objects.filter(obj=>obj.interact==='l10TextileStation')) {
        const textileId=state.l10TextilePlacements?.[station.stationId];
        if(textileId)drawSingleSprite({id:`l10TextilePlaced:${station.stationId}`,type:'parcel',word:l10ParcelWord(textileId),x:station.x,y:station.y,scale:0.40},zBuffer,-0.50);
      }
    }
    if (state.levelId === 'l11canopy') {
      for (const perch of level().objects.filter(obj=>obj.interact==='l11BandPerch')) {
        const bandId=state.l11BandPlacements?.[perch.perchId];
        if(bandId)drawSingleSprite({id:`l11BandPlaced:${perch.perchId}`,type:'parcel',word:l11BandWord(bandId),x:perch.x,y:perch.y,scale:0.40},zBuffer,-0.50);
      }
    }
  }

  function drawSingleSprite(obj, zBuffer, extraOffset = 0) {
    const dx = obj.x - state.x;
    const dy = obj.y - state.y;
    const rel = normalizeAngle(Math.atan2(dy, dx) - state.angle);
    if (Math.abs(rel) > FOV * 0.72) return;
    const dist = Math.hypot(dx, dy) * Math.cos(rel);
    if (dist <= 0.08 || dist > MAX_RAY_DISTANCE) return;
    const screenX = VIEW_W / 2 + Math.tan(rel) * (VIEW_W / (2 * Math.tan(FOV / 2)));
    const sprite = getSprite(obj);
    const height = Math.min(VIEW_H, (VIEW_H / dist) * (obj.scale || 1));
    const width = height * (sprite.width / sprite.height);
    const startX = Math.floor(screenX - width / 2);
    const startY = Math.floor(VIEW_H / 2 - height / 2 + (sprite.verticalOffset + extraOffset) * height);
    for (let sx = 0; sx < width; sx++) {
      const px = startX + sx;
      if (px < 0 || px >= VIEW_W || dist >= zBuffer[px]) continue;
      const srcX = Math.floor((sx / width) * sprite.canvas.width);
      ctx.drawImage(sprite.canvas, srcX, 0, 1, sprite.canvas.height, px, startY, 1, height);
    }
  }

  function level1MazeFullyComplete() {
    const world = campaignWorld();
    return Boolean(
      world.mazeExitReleased &&
      world.innerMazeDoorUnlocked &&
      campaignSolved('l1-maze-seli') &&
      campaignSolved('l1-maze-awen') &&
      campaignSolved('l1-maze-luka') &&
      campaignSolved('l1-maze-code') &&
      campaignSolved('l1-inner-signed-number')
    );
  }

  function getSprite(obj) {
    const puzzleSolved = Boolean(obj.puzzleId && campaignSolved(obj.puzzleId));
    const individuallyRecorded = Boolean(obj.interact === 'l11CallPylon' && state.l11CallMarkers?.[obj.pylonId]);
    const mazeFullyComplete = obj.type === 'mazeGate' ? level1MazeFullyComplete() : false;
    const key = `${obj.type}:${obj.id || ''}:${obj.puzzleId || ''}:${obj.word || ''}:${obj.panelId || ''}:${state.lowerPowerOn ? 1 : 0}:${state.trapdoorOpen ? 1 : 0}:${puzzleSolved ? 1 : 0}:${individuallyRecorded ? 1 : 0}:${mazeFullyComplete ? 1 : 0}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    let verticalOffset = 0.08;

    switch (obj.type) {
      case 'ball': {
        const grad = g.createRadialGradient(49, 42, 8, 63, 62, 43);
        grad.addColorStop(0, '#c6d8df'); grad.addColorStop(0.38, '#7f9ba7'); grad.addColorStop(1, '#31434a');
        g.fillStyle = grad; g.beginPath(); g.arc(64, 68, 36, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#dbe7ea'; g.lineWidth = 3; g.stroke(); verticalOffset = 0.24; break;
      }
      case 'table': {
        g.fillStyle = puzzleSolved ? '#47765a' : '#604d39'; g.fillRect(10, 48, 108, 18);
        g.fillStyle = '#47372b'; g.fillRect(18, 62, 15, 56); g.fillRect(95, 62, 15, 56);
        g.strokeStyle = puzzleSolved ? '#8fd0a4' : '#92785d'; g.lineWidth = 3; g.strokeRect(10, 48, 108, 18); verticalOffset = 0.04; break;
      }
      case 'ladder': {
        if (obj.id === 'l9MazeEntranceLadder') {
          g.fillStyle = '#d7c28b'; g.fillRect(8, 2, 112, 31);
          g.strokeStyle = '#4c412d'; g.lineWidth = 4; g.strokeRect(8, 2, 112, 31);
          g.fillStyle = '#17140e'; g.font = `23px "${NASIN_NANPA_FONT}"`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(glyphChar('tawa'), 64, 18);
        } else if (String(obj.id||'').startsWith('l11') || String(obj.id||'').startsWith('l12')) {
          const interact=String(obj.interact||'');
          const arrow=(interact.includes('ToCanopy')||interact==='l12GroundToUpper'||interact==='l12LowerToGround'||interact==='l12FinalToLower') ? '↑' : '↓';
          g.fillStyle='#d7c28b';g.beginPath();g.arc(64,18,16,0,Math.PI*2);g.fill();
          g.strokeStyle='#17140e';g.lineWidth=3;g.stroke();
          g.fillStyle='#17140e';g.font='900 23px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(arrow,64,17);
        }
        g.strokeStyle = (obj.id === 'l9MazeEntranceLadder' || String(obj.id||'').startsWith('l11') || String(obj.id||'').startsWith('l12')) ? '#d7c28b' : '#8f9898'; g.lineWidth = 8;
        g.beginPath(); g.moveTo(31, 8); g.lineTo(31, 124); g.moveTo(97, 8); g.lineTo(97, 124); g.stroke();
        g.lineWidth = 5; for (let y = 20; y < 122; y += 17) { g.beginPath(); g.moveTo(32, y); g.lineTo(96, y); g.stroke(); }
        verticalOffset = -0.02; break;
      }
      case 'trapdoor': {
        const isL10ColdHatch=obj.id==='l10GroundColdLift';
        const isL11RouteHatch=String(obj.id||'').startsWith('l11');
        const isL12RouteHatch=String(obj.id||'').startsWith('l12');
        const trapOpen=String(obj.id||'').startsWith('l9') || isL10ColdHatch || isL11RouteHatch || isL12RouteHatch || state.trapdoorOpen;
        if(isL10ColdHatch || isL11RouteHatch || isL12RouteHatch){
          g.fillStyle='#d7c28b';g.beginPath();g.arc(64,19,17,0,Math.PI*2);g.fill();
          g.strokeStyle='#17140e';g.lineWidth=3;g.stroke();
          g.fillStyle='#17140e';g.font='900 25px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('↓',64,18);
        }
        g.fillStyle = trapOpen ? '#050708' : '#443b32';
        g.beginPath(); g.moveTo(16, 66); g.lineTo(45, 31); g.lineTo(116, 54); g.lineTo(88, 94); g.closePath(); g.fill();
        g.strokeStyle = (isL10ColdHatch || isL11RouteHatch || isL12RouteHatch) ? '#d7c28b' : '#938474'; g.lineWidth = (isL10ColdHatch || isL11RouteHatch || isL12RouteHatch) ? 8 : 4; g.stroke();
        g.strokeStyle = trapOpen ? '#000' : '#25211d'; g.lineWidth = 5; g.beginPath(); g.moveTo(41, 54); g.lineTo(94, 72); g.stroke();
        verticalOffset = (isL10ColdHatch || isL11RouteHatch || isL12RouteHatch) ? 0.22 : 0.30; break;
      }
      case 'console': {
        g.fillStyle = '#344149'; g.fillRect(21, 26, 86, 96);
        g.strokeStyle = puzzleSolved ? '#8fd0a4' : '#91a2aa'; g.lineWidth = puzzleSolved ? 5 : 3; g.strokeRect(21, 26, 86, 96);
        g.fillStyle = '#111b20'; g.fillRect(32, 38, 64, 33);
        g.fillStyle = puzzleSolved ? '#56a874' : '#d6ad75'; g.fillRect(39, 46, 50, 17);
        if (obj.id === 'l2HiddenCache') {
          g.fillStyle = puzzleSolved ? '#e7f4ea' : '#111111';
          g.font = `18px "${NASIN_NANPA_FONT}"`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(`${glyphChar('kiwen')} ${glyphChar('ma')} ${glyphChar('kiwen')}`, 64, 55);
        }
        g.fillStyle = puzzleSolved ? '#315f42' : '#1d272c'; g.fillRect(36, 81, 14, 14); g.fillRect(57, 81, 14, 14); g.fillRect(78, 81, 14, 14);
        verticalOffset = 0.08; break;
      }
      case 'terminal': {
        const isAuditConsole=obj.id==='l10AuditConsole';
        g.fillStyle = isAuditConsole ? '#56441f' : '#303a40'; g.fillRect(18, 31, 92, 87);
        g.strokeStyle = puzzleSolved ? '#8fd0a4' : isAuditConsole ? '#f0cf72' : '#71858f'; g.lineWidth = puzzleSolved || isAuditConsole ? 5 : 3; g.strokeRect(18, 31, 92, 87);
        g.fillStyle = puzzleSolved ? '#173925' : isAuditConsole ? '#211803' : '#0f181d'; g.fillRect(28, 41, 72, 44);
        g.fillStyle = puzzleSolved ? '#a8e0b9' : isAuditConsole ? '#ffe58e' : '#96c8b6';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if(isAuditConsole){g.font='900 52px system-ui,sans-serif';g.fillText('!',64,64);}else{g.font = `48px "${NASIN_NANPA_FONT}"`;g.fillText(glyphChar('sona'), 64, 63);}
        g.fillStyle = puzzleSolved ? '#56a874' : isAuditConsole ? '#e1b846' : '#a78f6b'; g.fillRect(47, 98, 34, 7); verticalOffset = 0.07; break;
      }
      case 'mazeGate': {
        const world = campaignWorld();
        const isExit = obj.id === 'mazeExit';
        const unlocked = isExit ? Boolean(world.mazeExitReleased) : Boolean(world.mazeEntranceUnlocked);
        // Green is reserved for the maze being completely finished, including
        // the delayed-return inner chamber. Releasing the first exit is only an
        // intermediate milestone: the gate remains amber while maze work remains.
        const solved = mazeFullyComplete;
        g.fillStyle = '#3b4448'; g.fillRect(18, 14, 92, 108);
        g.strokeStyle = solved ? '#8fd0a4' : '#8b979c'; g.lineWidth = solved ? 5 : 4; g.strokeRect(18, 14, 92, 108);
        g.fillStyle = solved ? '#56a874' : unlocked ? '#c4a574' : '#7f6957'; g.fillRect(29, 26, 70, 28);
        g.fillStyle = '#14191b'; g.fillRect(30, 66, 68, 42);
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = solved ? '#9bd2b1' : unlocked ? '#d7c28b' : '#8f7359';
          g.lineWidth = solved ? 4 : 3;
          g.strokeRect(35 + i*21, 76, 15, 20);
        }
        verticalOffset = 0.03; break;
      }
      case 'glyphPanel': {
        const panelComplete = puzzleSolved || individuallyRecorded;
        g.fillStyle = panelComplete ? '#6fa47d' : '#bcae91'; g.fillRect(13, 25, 102, 78);
        g.strokeStyle = panelComplete ? '#315f42' : '#5c5548'; g.lineWidth = 5; g.strokeRect(13, 25, 102, 78);
        g.fillStyle = panelComplete ? '#10271a' : '#231f18'; g.font = `60px "${NASIN_NANPA_FONT}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyphChar('sitelen'), 64, 64);
        g.strokeStyle = panelComplete ? '#b8e2c4' : '#756b59'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 91); g.lineTo(104, 91); g.stroke(); verticalOffset = 0.06; break;
      }
      case 'relic': {
        g.save();
        g.shadowColor='rgba(232,205,125,.5)';g.shadowBlur=13;
        g.fillStyle='#8b7650';g.beginPath();g.arc(64,69,38,0,Math.PI*2);g.fill();
        g.shadowBlur=0;g.strokeStyle='#d7c28b';g.lineWidth=4;g.stroke();
        g.fillStyle='#15140f';g.font=`54px "${NASIN_NANPA_FONT}"`;g.textAlign='center';g.textBaseline='middle';g.fillText(glyphChar(obj.word||'ijo'),64,68);
        g.restore();verticalOffset=0.19;break;
      }
      case 'parcel': {
        g.fillStyle='#8a6c46';g.fillRect(22,36,84,70);
        g.strokeStyle='#d1b887';g.lineWidth=4;g.strokeRect(22,36,84,70);
        g.fillStyle='#6e5437';g.fillRect(59,36,10,70);g.fillRect(22,66,84,8);
        g.fillStyle='#efe3c1';g.fillRect(33,46,50,22);
        g.fillStyle='#17140f';g.font=`30px "${NASIN_NANPA_FONT}"`;g.textAlign='center';g.textBaseline='middle';g.fillText(glyphChar(obj.word||'ijo'),58,57);
        verticalOffset=0.18;break;
      }
      case 'cart': {
        g.fillStyle='#5d666b';g.fillRect(18,50,92,45);
        g.strokeStyle='#b1b8bb';g.lineWidth=4;g.strokeRect(18,50,92,45);
        g.fillStyle='#30373a';g.fillRect(28,39,72,18);
        g.strokeStyle='#949da1';g.lineWidth=5;g.beginPath();g.moveTo(95,51);g.lineTo(111,25);g.stroke();
        g.fillStyle='#202426';g.beginPath();g.arc(37,105,13,0,Math.PI*2);g.arc(91,105,13,0,Math.PI*2);g.fill();
        g.fillStyle='#d7c28b';g.font=`31px "${NASIN_NANPA_FONT}"`;g.textAlign='center';g.textBaseline='middle';g.fillText(glyphChar('tawa'),64,74);
        verticalOffset=0.15;break;
      }
      case 'pedestal': {
        g.fillStyle=puzzleSolved?'#47765a':'#5f574d';g.fillRect(25,66,78,48);
        g.fillStyle=puzzleSolved?'#6fa47d':'#817564';g.fillRect(16,54,96,18);
        g.strokeStyle=puzzleSolved?'#9cd3ad':'#b5a184';g.lineWidth=4;g.strokeRect(16,54,96,18);
        const pedestalWord=obj.expectedWord||'supa';
        if(obj.expectedWord){
          g.fillStyle='#d7c28b';g.fillRect(31,13,66,37);g.strokeStyle='#30291f';g.lineWidth=3;g.strokeRect(31,13,66,37);
          g.fillStyle='#17140e';g.font=`27px "${NASIN_NANPA_FONT}"`;g.textAlign='center';g.textBaseline='middle';g.fillText(glyphChar(obj.expectedWord),64,32);
        }
        g.fillStyle=puzzleSolved?'#d9f0df':'#e1d3b6';g.font=`34px "${NASIN_NANPA_FONT}"`;g.textAlign='center';g.textBaseline='middle';g.fillText(glyphChar(pedestalWord),64,93);
        verticalOffset=obj.expectedWord?0.10:0.17;break;
      }
      case 'glyph': {
        g.save();
        g.shadowColor = 'rgba(245,224,167,.7)'; g.shadowBlur = 18;
        g.fillStyle = '#d8cba8'; g.beginPath(); g.arc(64, 64, 47, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0; g.strokeStyle = '#786d57'; g.lineWidth = 5; g.stroke();
        g.fillStyle = '#171714'; g.font = `68px "${NASIN_NANPA_FONT}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyphChar(obj.word), 64, 67);
        g.restore(); verticalOffset = 0.10; break;
      }
      default: {
        g.fillStyle = '#ccc'; g.fillRect(32, 32, 64, 64);
      }
    }

    const sprite = { canvas: c, width: c.width, height: c.height, verticalOffset };
    spriteCache.set(key, sprite);
    return sprite;
  }

  function drawHands() {
    if (!state.carrying) return;
    ctx.save(); ctx.globalAlpha = 0.86; ctx.fillStyle = '#8a6f58';
    ctx.beginPath(); ctx.ellipse(VIEW_W * 0.43, VIEW_H + 8, 48, 54, -0.45, 0, Math.PI * 2); ctx.ellipse(VIEW_W * 0.57, VIEW_H + 8, 48, 54, 0.45, 0, Math.PI * 2); ctx.fill();
    if (state.carrying === 'ball') {
      const grad = ctx.createRadialGradient(VIEW_W/2 - 12, VIEW_H - 68, 8, VIEW_W/2, VIEW_H - 51, 44);
      grad.addColorStop(0, '#c9dce3'); grad.addColorStop(1, '#3c5159');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(VIEW_W/2, VIEW_H - 49, 36, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#d8e4e8'; ctx.lineWidth = 2; ctx.stroke();
    } else if (String(state.carrying||'').startsWith('l9:')) {
      const word=l9RelicWord(String(state.carrying).slice(3));
      ctx.fillStyle='#8b7650';ctx.beginPath();ctx.arc(VIEW_W/2,VIEW_H-48,34,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#d7c28b';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#111';ctx.font=`42px "${NASIN_NANPA_FONT}"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyphChar(word),VIEW_W/2,VIEW_H-47);
    } else if (String(state.carrying||'').startsWith('l10:')) {
      const id=String(state.carrying).split(':').slice(-1)[0],word=l10ParcelWord(id);
      ctx.fillStyle='#8a6c46';ctx.fillRect(VIEW_W/2-38,VIEW_H-87,76,61);
      ctx.strokeStyle='#d1b887';ctx.lineWidth=3;ctx.strokeRect(VIEW_W/2-38,VIEW_H-87,76,61);
      ctx.fillStyle='#17140f';ctx.font=`39px "${NASIN_NANPA_FONT}"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyphChar(word),VIEW_W/2,VIEW_H-56);
    } else if (String(state.carrying||'').startsWith('l11:band:')) {
      const id=String(state.carrying).slice('l11:band:'.length),word=l11BandWord(id);
      ctx.fillStyle='#8a6c46';ctx.fillRect(VIEW_W/2-34,VIEW_H-80,68,50);
      ctx.strokeStyle='#d1b887';ctx.lineWidth=3;ctx.strokeRect(VIEW_W/2-34,VIEW_H-80,68,50);
      ctx.fillStyle='#17140f';ctx.font=`34px "${NASIN_NANPA_FONT}"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyphChar(word),VIEW_W/2,VIEW_H-55);
    }
    ctx.restore();
  }

  function renderMiniMap() {
    if (!state.mapVisible) return;
    const map = level().map;
    const explored = state.explored[state.levelId] || {};
    const w = miniMap.width, h = miniMap.height;
    mapCtx.clearRect(0, 0, w, h); mapCtx.fillStyle = 'rgba(9,13,16,0.94)'; mapCtx.fillRect(0, 0, w, h);
    const cell = Math.min(w / map[0].length, h / map.length);
    const ox = (w - map[0].length * cell) / 2; const oy = (h - map.length * cell) / 2;
    const drawRouteMarker=(obj,arrow)=>{
      if(!obj)return;
      const mx=ox+obj.x*cell,my=oy+obj.y*cell,size=Math.max(8,cell*1.05);
      mapCtx.save();mapCtx.fillStyle='#d7c28b';mapCtx.strokeStyle='#111';mapCtx.lineWidth=Math.max(1.2,cell*0.12);
      mapCtx.beginPath();mapCtx.arc(mx,my,size*0.52,0,Math.PI*2);mapCtx.fill();mapCtx.stroke();
      mapCtx.fillStyle='#111';mapCtx.font=`900 ${Math.max(8,Math.floor(size*0.82))}px system-ui,sans-serif`;mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.fillText(arrow,mx,my-0.5);mapCtx.restore();
    };
    for (let y = 0; y < map.length; y++) for (let x = 0; x < map[y].length; x++) {
      if (!explored[`${x},${y}`]) continue;
      const c = map[y][x];
      if (c === '#') mapCtx.fillStyle = '#66737a';
      else if (c === 'D' || c === 'P') { const d = doorAtCell(x, y); mapCtx.fillStyle = d?.open ? '#44565c' : '#aa8c66'; }
      else mapCtx.fillStyle = '#263138';
      mapCtx.fillRect(ox + x*cell, oy + y*cell, Math.ceil(cell), Math.ceil(cell));
    }
    if (state.levelId === 'maze') {
      // The entrance/exit is deliberately shown even when the rest of the maze is only partially explored.
      const ex = ox + 1.5 * cell;
      const ey = oy + 1.18 * cell;
      const size = Math.max(6, cell * 0.82);
      mapCtx.save();
      mapCtx.fillStyle = '#f3dfc0';
      mapCtx.fillRect(ex - size/2, ey - size/2, size, size);
      mapCtx.strokeStyle = '#111';
      mapCtx.lineWidth = Math.max(1.2, cell * 0.12);
      mapCtx.strokeRect(ex - size/2, ey - size/2, size, size);
      mapCtx.beginPath();
      mapCtx.moveTo(ex - size*0.18, ey - size*0.28);
      mapCtx.lineTo(ex - size*0.18, ey + size*0.28);
      mapCtx.lineTo(ex + size*0.23, ey + size*0.28);
      mapCtx.stroke();
      mapCtx.restore();
    }
    if (state.levelId === 'l9maze') {
      // Level 9 starts on a ladder rather than a door, so keep the labyrinth entrance
      // permanently marked even when nearby cells are still unexplored.
      const ex = ox + 1.55 * cell;
      const ey = oy + 1.55 * cell;
      const size = Math.max(7, cell * 0.92);
      mapCtx.save();
      mapCtx.fillStyle = '#d7c28b';
      mapCtx.strokeStyle = '#111';
      mapCtx.lineWidth = Math.max(1.2, cell * 0.12);
      mapCtx.beginPath();
      mapCtx.arc(ex, ey, size * 0.52, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(ex - size*0.18, ey - size*0.28);
      mapCtx.lineTo(ex - size*0.18, ey + size*0.28);
      mapCtx.moveTo(ex + size*0.18, ey - size*0.28);
      mapCtx.lineTo(ex + size*0.18, ey + size*0.28);
      for (const dy of [-0.18,0,0.18]) {
        mapCtx.moveTo(ex - size*0.18, ey + size*dy);
        mapCtx.lineTo(ex + size*0.18, ey + size*dy);
      }
      mapCtx.stroke();
      mapCtx.restore();
    }
    if (state.levelId === 'l10ground') {
      const world=campaignWorld();
      if(world.l10BasementOpen&&!world.l10ColdRecorded) drawRouteMarker(level().objects.find(obj=>obj.id==='l10GroundColdLift'),'↓');
      if(world.l10TextileDone&&!world.l10ExitUnlocked) drawRouteMarker(level().objects.find(obj=>obj.id==='l10GroundAwningUp'),'↑');
      if(world.l10ExitUnlocked) drawRouteMarker(level().objects.find(obj=>obj.id==='l10DispatchExit'),'✓');
    }
    if (state.levelId === 'l10upper' && campaignWorld().l10DyeReady && !campaignWorld().l10TextileDone) {
      const carrying=String(state.carrying||'');
      const blueLoc=state.l10TextileLocations?.['blue-cloth'];
      const whiteLoc=state.l10TextileLocations?.['white-cloth'];
      if(blueLoc==='upper-rack')drawRouteMarker(level().objects.find(obj=>obj.id==='l10BlueCloth'),'!');
      if(whiteLoc==='upper-rack')drawRouteMarker(level().objects.find(obj=>obj.id==='l10WhiteCloth'),'!');
      if(carrying==='l10:textile:blue-cloth')drawRouteMarker(level().objects.find(obj=>obj.id==='l10DyeFrame'),'→');
      if(carrying==='l10:textile:white-cloth')drawRouteMarker(level().objects.find(obj=>obj.id==='l10FinishTable'),'→');
    }
    if (state.levelId === 'l10upper' && campaignWorld().l10TextileDone && !campaignWorld().l10ExitUnlocked) {
      drawRouteMarker(level().objects.find(obj=>obj.id==='l10AuditConsole'),'!');
    }
    if (state.levelId === 'l10lower' && campaignWorld().l10TextileDone && !campaignWorld().l10ExitUnlocked) {
      drawRouteMarker(level().objects.find(obj=>obj.id==='l10LowerUpperLift'),'↑');
    }
    if (state.levelId === 'l11ground') {
      if(campaignWorld().l11CanopyOpen)drawRouteMarker(level().objects.find(obj=>obj.id==='l11GroundCanopyLadder'),'↑');
      if(campaignWorld().l11RecoveryOpen)drawRouteMarker(level().objects.find(obj=>obj.id==='l11RecoveryCanopyLadder'),'↑');
    }
    if (state.levelId === 'l11canopy') {
      if(campaignWorld().l11IncubatorOpen)drawRouteMarker(level().objects.find(obj=>obj.id==='l11CanopyIncubatorHatch'),'↓');
      if(campaignWorld().l11RecoveryOpen)drawRouteMarker(level().objects.find(obj=>obj.id==='l11CanopyRecoveryLadder'),'↓');
    }
    if (state.levelId === 'l12ground' && campaignWorld().l12SpineOnline) {
      drawRouteMarker(level().objects.find(obj=>obj.id==='l12CoreUpperLadder'),'↑');
      drawRouteMarker(level().objects.find(obj=>obj.id==='l12CoreLowerHatch'),'↓');
    }
    if (state.levelId === 'l12lower' && campaignWorld().l12IdentityDone && campaignWorld().l12CipherDone && campaignWorld().l12RelationDone) {
      drawRouteMarker(level().objects.find(obj=>obj.id==='l12FinalHatch'),'↓');
    }
    if (state.levelId === 'l2main' && campaignWorld().cacheRevealed) {
      const cache = level().objects.find(obj => obj.id === 'l2HiddenCache');
      if (cache) {
        const solved = campaignSolved('l2-hidden-cache');
        const cx = ox + cache.x * cell, cy = oy + cache.y * cell;
        const r = Math.max(4.5, cell * 0.42);
        mapCtx.save();
        mapCtx.translate(cx, cy);
        mapCtx.rotate(Math.PI / 4);
        mapCtx.fillStyle = solved ? '#56a874' : '#f3dfc0';
        mapCtx.fillRect(-r/2, -r/2, r, r);
        mapCtx.strokeStyle = solved ? '#d9f0df' : '#111';
        mapCtx.lineWidth = Math.max(1.2, cell * 0.11);
        mapCtx.strokeRect(-r/2, -r/2, r, r);
        mapCtx.restore();
      }
    }
    if (mobileMapSteer.active && mobileMapSteer.levelId === state.levelId && mobileMapSteer.targetPoint) {
      // The map touch expresses direction even when the touched destination is
      // still under fog-of-war. Only draw guidance through cells the player has
      // already revealed so the steering UI never exposes hidden maze geometry.
      const preview = mobileMapSteer.direction ? mapSteerPreviewDirection(mobileMapSteer.direction.x, mobileMapSteer.direction.y) : [];
      mobileMapSteer.path = preview;
      mobileMapSteer.pathIndex = 0;
      if (preview.length) {
        mapCtx.save();
        mapCtx.strokeStyle='rgba(243,223,192,0.72)';mapCtx.lineWidth=Math.max(1.5,cell*0.12);mapCtx.setLineDash([Math.max(2,cell*0.28),Math.max(2,cell*0.22)]);
        mapCtx.beginPath();mapCtx.moveTo(ox+state.x*cell,oy+state.y*cell);
        for(const point of preview)mapCtx.lineTo(ox+point.x*cell,oy+point.y*cell);
        mapCtx.stroke();mapCtx.setLineDash([]);
        mapCtx.restore();
      }
    }
    mapCtx.fillStyle = '#f3dfc0'; mapCtx.beginPath(); mapCtx.arc(ox + state.x*cell, oy + state.y*cell, Math.max(2.5, cell*0.22), 0, Math.PI*2); mapCtx.fill();
    mapCtx.strokeStyle = '#f3dfc0'; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.moveTo(ox + state.x*cell, oy + state.y*cell); mapCtx.lineTo(ox + (state.x + Math.cos(state.angle)*0.9)*cell, oy + (state.y + Math.sin(state.angle)*0.9)*cell); mapCtx.stroke();
  }

  function currentRoom() {
    const r = level().rooms.find(room => state.x >= room.x1 && state.x <= room.x2 && state.y >= room.y1 && state.y <= room.y2);
    return r || { areaId: level().defaultAreaId || null, name: level().label, instruction: '', hint: '' };
  }

  function value(v) { return typeof v === 'function' ? v() : v; }

  function currentLevelProgress() {
    if (!campaignAdapter) return { levelNo:level().chapter, requiredOwned:0, requiredTotal:0, bonusOwned:0, totalOwned:collectionCount() };
    const levelDef = campaignAdapter.currentLevel();
    const levelNo = levelDef?.ordinal || level().chapter;
    const required = levelDef?.canonicalGlyphs || [];
    const requiredOwned = required.filter(collected).length;
    const requiredTotal = required.length;
    const levelsThroughCurrent = (campaignAdapter.runtime?.campaign?.levels || [])
      .filter(item => Number(item.ordinal) <= Number(levelNo));
    const canonicalThroughCurrent = new Set(levelsThroughCurrent.flatMap(item => item.canonicalGlyphs || []));
    const bonusOwned = STANDARD_120.reduce((count, word) => count + (collected(word) && !canonicalThroughCurrent.has(word) ? 1 : 0), 0);
    return { levelNo, requiredOwned, requiredTotal, bonusOwned, totalOwned:collectionCount() };
  }

  function progressSummaryText(progress, compact = false) {
    const p = progress || currentLevelProgress();
    if (isTpLanguage()) {
      if (compact) return `ma ${p.levelNo} · ${p.requiredOwned}/${p.requiredTotal} wile${p.bonusOwned ? ` · +${p.bonusOwned} namako` : ''} · ${p.totalOwned}/120`;
      return `ma musi ${p.levelNo}: sitelen wile ${p.requiredOwned}/${p.requiredTotal}${p.bonusOwned ? ` · sitelen namako ${p.bonusOwned}` : ''} · sitelen ale ${p.totalOwned}/120`;
    }
    if (compact) {
      return `L${p.levelNo} ${p.requiredOwned}/${p.requiredTotal} req${p.bonusOwned ? ` · +${p.bonusOwned} bonus` : ''} · ${p.totalOwned}/120`;
    }
    return `Level ${p.levelNo}: ${p.requiredOwned}/${p.requiredTotal} required glyphs${p.bonusOwned ? ` · ${p.bonusOwned} bonus glyph${p.bonusOwned === 1 ? '' : 's'}` : ''} · ${p.totalOwned}/120 total`;
  }

  function currentObjective() {
    if (!campaignAdapter) return uiText('loadingCampaign');
    const progress = currentLevelProgress();
    if (campaignAdapter.isLevelComplete()) {
      return isTpLanguage()
        ? `ma musi ${progress.levelNo} li pini · o tawa lon tenpo sina wile.`
        : `Level ${progress.levelNo} complete · continue when ready.`;
    }
    const prefix = isTpLanguage()
      ? (progress.requiredOwned >= progress.requiredTotal && progress.requiredTotal > 0
          ? `${progress.requiredOwned}/${progress.requiredTotal} sitelen wile ✓ · wile suli li awen`
          : `${progress.requiredOwned}/${progress.requiredTotal} sitelen wile${progress.bonusOwned ? ` · +${progress.bonusOwned} namako` : ''}`)
      : (progress.requiredOwned >= progress.requiredTotal && progress.requiredTotal > 0
          ? `${progress.requiredOwned}/${progress.requiredTotal} required ✓ · main objective remains`
          : `${progress.requiredOwned}/${progress.requiredTotal} required${progress.bonusOwned ? ` · +${progress.bonusOwned} bonus` : ''}`);

    if (progress.levelNo === 9 && !campaignSolved('l9-maze-survey')) {
      const survey=l9MarkerProgress();
      return isTpLanguage()
        ? `${prefix} · alasa nasin nasa ${survey.found}/${survey.needed} · o alasa e sitelen alasa awen. o lukin e ona.`
        : `${prefix} · Labyrinth survey ${survey.found}/${survey.needed} · Find and inspect the remaining survey markers.`;
    }
    if (progress.levelNo === 9 && campaignWorld().l9SphinxReady && !campaignSolved('l9-sphinx-riddles')) {
      return isTpLanguage()
        ? `${prefix} · sitelen alasa 3/3 li pini · o kama sin tawa tomo jan [[Sphinx]] lon insa nasin nasa.`
        : `${prefix} · Survey complete 3/3 · Return to the Sphinx Court at the centre of the labyrinth.`;
    }
    if (progress.levelNo === 9 && campaignSolved('l9-sphinx-riddles') && !campaignSolved('l9-counterweight')) {
      return isTpLanguage()
        ? `${prefix} · jan [[Sphinx]] li pini · o kepeken nasin weka lili tawa tomo kama.`
        : `${prefix} · Sphinx solved · Use the quick exit from the Sphinx Court to reach the next chamber.`;
    }
    if (progress.levelNo === 10) {
      const world=campaignWorld();
      if(!world.l10PowerOn)return isTpLanguage()
        ? `${prefix} · o pini e lipu pana % tu wan. ni la nasin poki tawa li kama jo e wawa.`
        : `${prefix} · Complete the three-percentage Market allocation ledger to power the freight spine.`;
      if(!world.l10DeliveryDone){
        const bakery=state.l10DeliveryPlacements?.bakery?l10ParcelWord(state.l10DeliveryPlacements.bakery):(isTpLanguage()?'weka':'empty');
        const sweet=state.l10DeliveryPlacements?.['sweet-stall']?l10ParcelWord(state.l10DeliveryPlacements['sweet-stall']):(isTpLanguage()?'weka':'empty');
        return isTpLanguage()
          ? `${prefix} · wawa tawa li lon · tomo [[pan]] li wile e [[pan]] (${bakery}); tomo [[suwi]] li wile e [[suwi]] (${sweet}).`
          : `${prefix} · Freight powered · bakery expects pan (${bakery}); sweet-goods expects suwi (${sweet}).`;
      }
      if(!world.l10ColdStable)return isTpLanguage()
        ? `${prefix} · pana poki li pini · lupa tawa tomo lete li open lon tomo esun (↓ lon sitelen ma). o tawa anpa. o pona e nanpa lete tu wan lon tenpo sama.`
        : `${prefix} · Delivery complete · Cold Store entrance OPEN in the Market Arcade (↓ on minimap). Descend and stabilize the three cold-chain readings.`;
      if(!world.l10ColdRecorded)return isTpLanguage()
        ? `${prefix} · ilo lete li pona · o ante e nanpa tu wan tawa nasin [[neko]]. o awen e ona. ni la ilo tawa sewi li open.`
        : `${prefix} · Cold chain stable · Normalize all three recorder values as scientific notation to unlock the chilled service lift.`;
      if(!world.l10DyeReady)return isTpLanguage()
        ? `${prefix} · lipu [[neko]] li pini · o tawa sewi tawa tomo len. o pona e nanpa pi wan en kipisi tu wan.`
        : `${prefix} · Scientific record complete · Take the chilled service lift to the Textile Loft and reconcile the three mixed-fraction dye batches.`;
      if(!world.l10TextileDone){
        const carrying=String(state.carrying||'');
        if(carrying==='l10:textile:blue-cloth')return isTpLanguage()
          ? `${prefix} · sina jo e len [[laso]] · o tawa e ona tawa supa kule pi sitelen [[laso]] (→ lon sitelen ma).`
          : `${prefix} · Carrying laso cloth · Take it to the laso-marked dye frame (→ on minimap).`;
        if(carrying==='l10:textile:white-cloth')return isTpLanguage()
          ? `${prefix} · sina jo e len [[walo]] · o tawa e ona tawa supa pini pi sitelen [[walo]] (→ lon sitelen ma).`
          : `${prefix} · Carrying walo cloth · Take it to the walo-marked finishing table (→ on minimap).`;
        return isTpLanguage()
          ? `${prefix} · nanpa len li pona · len [[laso]] en len [[walo]] li lon poka ilo telo kule ({{!}} lon sitelen ma). o kama jo e wan.`
          : `${prefix} · Dye ready · The laso and walo cloth bundles are beside the mixer (! on minimap). Pick one up, then follow the destination marker.`;
      }
      if(!world.l10ExitUnlocked){
        const routeEn=state.levelId==='l10upper'
          ? 'The Ledger Office is beside the Textile Loft.'
          : state.levelId==='l10lower'
            ? 'Take the chilled service lift ↑ to the Textile Loft, then enter the Ledger Office.'
            : 'Use the awning ladder ↑ in the Market Arcade to reach the Textile Loft, then enter the Ledger Office.';
        const routeTp=state.levelId==='l10upper'
          ? 'tomo lipu li lon poka tomo len.'
          : state.levelId==='l10lower'
            ? 'o tawa sewi ↑ kepeken ilo tawa lete. ni la o tawa tomo lipu.'
            : 'o tawa sewi ↑ kepeken palisa pi len sewi lon tomo esun. ni la o tawa tomo lipu.';
        return isTpLanguage()
          ? `${prefix} · wile pini · ${routeTp} o kepeken ilo lukin lipu pi sitelen {{!}}. o anu e lipu [[pan]] e lipu [[suwi]] tawa ma pana anu ma awen ike. sina tawa e moku sin ala.`
          : `${prefix} · FINAL OBJECTIVE · ${routeEn} Use the audit console marked !. Review the pan and suwi records and classify each as Dispatch or Quarantine. You are NOT moving the goods again.`;
      }
    }
    if (progress.levelNo === 11) {
      const world=campaignWorld(),calls=l11CallProgress();
      if(!world.l11CallsLogged)return isTpLanguage()
        ? `${prefix} · alasa kalama ${calls.found}/${calls.needed} · o awen e sona tan palisa kalama tu wan lon tomo alasa ma en tomo ma soweli.`
        : `${prefix} · Acoustic survey ${calls.found}/${calls.needed} · Record all three call pylons in the Field Station and Habitat Hub.`;
      if(!world.l11CanopyOpen)return isTpLanguage()
        ? `${prefix} · kalama 3/3 li awen · o kepeken ilo alasa ma lon tomo ma soweli. o alasa e ma awen pimeja.`
        : `${prefix} · Calls logged 3/3 · Use the Habitat Hub triangulation console to locate the night roost.`;
      if(!world.l11RoostDone)return isTpLanguage()
        ? `${prefix} · ma awen li sona · o tawa sewi kepeken palisa ↑. o pona e nasin tenpo pimeja.`
        : `${prefix} · Roost located · Climb the marked canopy ladder ↑ and restore the overnight roost/feeding schedule.`;
      if(!world.l11LineageDone)return isTpLanguage()
        ? `${prefix} · nasin tenpo li pona · o tawa anpa kepeken lupa ↓. o pini e lipu mama.`
        : `${prefix} · Schedule restored · Descend through the marked incubator hatch ↓ and solve the Lineage Registry.`;
      if(!world.l11PairDone){
        const west=state.l11BandPlacements?.['west-perch']?l11BandWord(state.l11BandPlacements['west-perch']):(isTpLanguage()?'weka':'empty');
        const east=state.l11BandPlacements?.['east-perch']?l11BandWord(state.l11BandPlacements['east-perch']):(isTpLanguage()?'weka':'empty');
        return isTpLanguage()
          ? `${prefix} · lipu mama li pini · supa poka loje li wile e [[loje]] (${west}); supa poka laso li wile e [[laso]] (${east}).`
          : `${prefix} · Lineage solved · Nest bands: west expects loje (${west}); east expects laso (${east}).`;
      }
      if(!world.l11ExitUnlocked)return isTpLanguage()
        ? `${prefix} · sitelen mama li pona · o kepeken nasin sin ↓ tan tomo lukin mama tawa tomo pona sin. o pini e musi ma soweli.`
        : `${prefix} · Parent bands aligned · Take the new Nest Observatory shortcut ↓ to the Recovery Ward and complete habitat triage.`;
    }
    if (progress.levelNo === 12) {
      const world=campaignWorld();
      if(!world.l12SpineOnline)return isTpLanguage()
        ? `${prefix} · tomo lipu pini · o pona e ilo luka pi ante tu lon open.`
        : `${prefix} · Final archive · Solve the Fracture Core ten-switch parity network first.`;
      if(!world.l12IdentityDone && !world.l12CipherDone)return isTpLanguage()
        ? `${prefix} · linja lipu li lon · nasin tu li open: ↑ tomo nasin sitelen; ↓ tomo linja len. o pini e tu.`
        : `${prefix} · Archive spine online · Two marked routes are open: ↑ Identity Gallery and ↓ Totality Cipher Vault. Both branches are required.`;
      if(!world.l12IdentityDone)return isTpLanguage()
        ? `${prefix} · linja len li pini · o tawa ↑. o pini e nasin sitelen 8.`
        : `${prefix} · Totality cipher solved · Take the marked upper route and solve the eight-record Identity permutation.`;
      if(!world.l12RelationDone)return isTpLanguage()
        ? `${prefix} · nasin sitelen li pona · o pini e ilo lukin linja tu wan lon tomo sewi.`
        : `${prefix} · Identity resolved · Complete the Triple Relation mirror array in the upper observatory.`;
      if(!world.l12CipherDone)return isTpLanguage()
        ? `${prefix} · musi sewi li pini · o kama sin tawa ilo pakala insa. o tawa anpa. o pini e linja len sitelen 6.`
        : `${prefix} · Upper trials complete · Return to the Fracture Core and descend to solve the six-glyph Totality cipher.`;
      if(!world.l12ExitUnlocked)return isTpLanguage()
        ? `${prefix} · musi open ale li pini · lupa [[FINAL]] ↓ li open lon tomo linja len. o tawa anpa tawa [[Sudoku]] pini.`
        : `${prefix} · All preliminary trials complete · FINAL hatch ↓ is open in the Totality Cipher Vault. Descend to the final medium Sudoku.`;
    }

    if (progress.levelNo === 2 && campaignWorld().cacheRevealed && !campaignSolved('l2-hidden-cache')) {
      const cachePuzzle = campaignPuzzle('l2-hidden-cache');
      const cacheObjective = puzzleText(cachePuzzle, 'objective') || (isTpLanguage() ? 'o tawa sin tawa tomo lipu anpa. o lukin e poki sin.' : 'Return to the Lower Archive and inspect the revealed cache.');
      return `${prefix} · ${cacheObjective}`;
    }

    const available = campaignAdapter.availablePuzzles();
    const nextPuzzle = available.find(p => p.requiredForMinimum !== false) || available[0] || null;
    const nextObjective = nextPuzzle ? (puzzleText(nextPuzzle,'objective') || puzzleText(nextPuzzle,'title') || nextPuzzle.id) : campaignAdapter.objective();
    return `${prefix} · ${isTpLanguage() ? exactText(nextObjective) : nextObjective}`;
  }

  function updateHUD() {
    syncWorldFromCampaign();
    const room = currentRoom();
    if (room.areaId) syncCampaignArea(room.areaId);
    renderLocalized(roomEl, roomNameText(room.name));
    renderLocalized(levelEl, isTpLanguage()
      ? `ma musi ${level().chapter}`
      : `level ${level().chapter}`);
    const rawInstruction = value(room.instruction) || '';
    const rawHint = value(room.hint) || '';
    if (isTpLanguage()) {
      renderLocalized(tpInstructionEl, exactText(rawInstruction) || '—');
      const hint = roomHintText(rawHint);
      renderLocalized(enInstructionEl, hint || '');
      enInstructionEl.hidden = !hint;
    } else {
      // The authored English hint is deliberately the primary English instruction;
      // room.instruction is often already a compact Toki Pona imperative.
      renderLocalized(tpInstructionEl, rawHint || rawInstruction || '—', {sitelen:false});
      enInstructionEl.textContent = '';
      enInstructionEl.classList.remove('tpProse');
      enInstructionEl.hidden = true;
    }
    renderLocalized(objectiveEl, currentObjective());
    const progress = currentLevelProgress();
    const carryRaw=String(state.carrying||'');
    const carriedName=state.carrying==='ball'?'sike':carryRaw.startsWith('l9:')?l9RelicWord(carryRaw.slice(3)):carryRaw.startsWith('l10:')?l10ParcelWord(carryRaw.split(':').slice(-1)[0]):carryRaw.startsWith('l11:band:')?`${l11BandWord(carryRaw.slice('l11:band:'.length))} ${isTpLanguage()?'sitelen mama':'band'}`:'—';
    if(progress.levelNo===10){
      const cartCargo=(state.l10CartCargo||[]).map(l10ParcelWord);
      const dock = isTpLanguage() ? termLabelText(state.l10CartDock) : l10CartDockName(state.l10CartDock);
      renderLocalized(inventoryEl, isTpLanguage()
        ? `sina jo e: [[${carriedName}]] · ilo tawa: ${dock} ${cartCargo.length}/2${cartCargo.length?` (${cartCargo.map(w=>`[[${w}]]`).join(', ')})`:''}`
        : `carrying: ${carriedName} · cart: ${l10CartDockName(state.l10CartDock)} ${cartCargo.length}/2${cartCargo.length?` (${cartCargo.join(', ')})`:''}`);
    } else {
      renderLocalized(inventoryEl, isTpLanguage() ? `sina jo e: ${carriedName==='—'?'—':`[[${carriedName}]]`}` : `carrying: ${carriedName}`);
    }
    const count = progress.totalOwned;
    renderLocalized(hudGlyphCountEl, progressSummaryText(progress, true));
    renderLocalized(collectionBtnCountEl, `${count} / 120`);
    if (continueCampaignBtn) {
      const next = campaignAdapter?.nextLevel?.();
      const complete = Boolean(campaignAdapter?.isLevelComplete());
      continueCampaignBtn.hidden = !complete;
      renderLocalized(continueCampaignBtn, next
        ? (isTpLanguage() ? `o tawa ma musi ${next.ordinal}` : `Continue to Level ${next.ordinal}`)
        : uiText('replayCelebration'));
    }
    renderLocalized(soundBtn, state.sound ? uiText('soundOn') : uiText('soundOff'));
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    renderLocalized(mapBtn, state.mapVisible ? uiText('mapOn') : uiText('mapOff'));
    mapBtn.setAttribute('aria-pressed', String(state.mapVisible));
    renderLocalized(resetBtn, uiText('newGame'));
    miniMap.classList.toggle('isHidden', !state.mapVisible);
    if (mazeQuickExitBtn) {
      mazeQuickExitBtn.hidden = !(state.levelId === 'maze' && campaignWorld().mazeExitReleased);
      renderLocalized(mazeQuickExitBtn, uiText('leaveMaze'));
    }

    if (!state.visitedRooms[`${state.levelId}:${room.name}`]) {
      state.visitedRooms[`${state.levelId}:${room.name}`] = true;
      log(`Entered ${room.name}.`);
    }
  }

  function interactionLineOfSightClear(targetX, targetY, endpointAllowance = 0.08) {
    // Interaction discovery is intentionally independent of camera facing, but walls and
    // closed doors must block it. This is a point-ray visibility check only; object prompts
    // additionally use interactionDirectReachClear() so a ray that merely clips an open
    // cell corner cannot expose an interaction the player's body cannot actually reach.
    const dx = targetX - state.x, dy = targetY - state.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= endpointAllowance) return true;
    const checkDistance = Math.max(0, dist - Math.max(0, endpointAllowance));
    const step = 0.04;
    const samples = Math.max(1, Math.ceil(checkDistance / step));
    for (let i = 1; i <= samples; i += 1) {
      const d = Math.min(checkDistance, i * step);
      const t = d / dist;
      if (isSolidAt(state.x + dx * t, state.y + dy * t)) return false;
    }
    return true;
  }

  function interactionDirectReachClear(targetX, targetY, endpointAllowance = 0.08) {
    if (!interactionLineOfSightClear(targetX, targetY, endpointAllowance)) return false;
    const dx = targetX - state.x, dy = targetY - state.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= endpointAllowance) return true;
    const checkDistance = Math.max(0, dist - Math.max(0, endpointAllowance));
    const step = 0.04;
    const samples = Math.max(1, Math.ceil(checkDistance / step));
    const canReach = isCoarsePointer() ? canOccupyMobile : canOccupy;
    for (let i = 1; i <= samples; i += 1) {
      const d = Math.min(checkDistance, i * step);
      const t = d / dist;
      if (!canReach(state.x + dx * t, state.y + dy * t)) return false;
    }
    return true;
  }

  function findInteractionTarget() {
    // Global interaction rule: proximity + unobstructed world line of sight.
    // Facing/camera alignment is NOT required; rotating toward an in-range object is enough.
    const candidates = [];
    const maxDistance = isCoarsePointer() ? MOBILE_INTERACT_DISTANCE : INTERACT_DISTANCE;
    for (const obj of visibleObjects()) {
      if (!obj.interact) continue;
      const dx = obj.x - state.x, dy = obj.y - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDistance + (obj.radius || 0)) continue;
      if (!interactionDirectReachClear(obj.x, obj.y, 0.08)) continue;
      candidates.push({ kind: 'object', obj, dist });
    }

    for (const door of level().doors) {
      if (door.open) continue;
      const targetX = door.x + 0.5, targetY = door.y + 0.5;
      const dx = targetX - state.x, dy = targetY - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDistance + 0.4) continue;
      // Stop the visibility trace before entering the target door cell itself; the door is
      // supposed to be solid until opened, but an intervening wall/door must still block it.
      if (!interactionLineOfSightClear(targetX, targetY, 0.74)) continue;
      candidates.push({ kind: 'door', door, dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0] || null;
  }

  function interactionPrefix() { return isCoarsePointer() ? 'USE' : 'E'; }
  function interactionPrefixLocalized() { return isCoarsePointer() ? 'o luka e [[kepeken]]' : 'o luka e [[E]]'; }

  function doorRequirementStatus(door) {
    const world = campaignWorld();
    const missingStates = [];
    const missingGlyphs = [];
    if (door.unlockState && !world[door.unlockState]) missingStates.push(door.unlockState);
    if (door.autoOpenState && !world[door.autoOpenState]) missingStates.push(door.autoOpenState);
    for (const k of door.autoOpenStates || []) if (!world[k]) missingStates.push(k);
    for (const k of door.unlockStates || []) if (!world[k]) missingStates.push(k);
    for (const g of door.unlockGlyphs || []) if (!collected(g)) missingGlyphs.push(g);
    return { ok: missingStates.length === 0 && missingGlyphs.length === 0, missingStates, missingGlyphs };
  }

  const DOOR_STATE_HINTS = {
    workshopDoorOpen: { en:'Put the ball on the table first.', tp:'o pana e [[sike]] lon [[supa]] lon open.' },
    innerMazeDoorUnlocked: { en:'Restore power in Maintenance first.', tp:'o pali e wawa lon ma pali lon open.' },
    observationDoorUnlocked: { en:'Complete the Upper Gallery number puzzle first.', tp:'o pini e musi nanpa lon tomo sewi lon open.' },
    l2ArchiveAccess: { en:'Solve the first Atrium puzzle first.', tp:'o pini e musi open lon tomo open nanpa tu lon open.' },
    l2CartographyAccess: { en:'Solve the Workshop stone puzzle first.', tp:'o pini e musi kiwen lon tomo pali nanpa lon open.' },
    l2LabAccess: { en:'Reveal the hidden cache in the Archive first.', tp:'o kama sona e poki len lon tomo lipu lon open.' },
    l2VaultAccess: { en:'Finish the Laboratory bridge puzzle first.', tp:'o pini e musi pi nasin lon tomo sona sitelen lon open.' },
    l3RelayAccess: { en:'Solve Clock alignment first.', tp:'o pini e musi tenpo lon open.' },
    l3NavigationAccess: { en:'Finish the Relay Gallery first.', tp:'o pini e tomo nasin wawa lon open.' },
    l3ObservationAccess: { en:'Finish the Navigation Floor first.', tp:'o pini e ma nasin lon open.' },
    l3WorkshopAccess: { en:'Finish the Observation Chamber first.', tp:'o pini e tomo lukin lon open.' },
    l3CoreAccess: { en:'Finish the Instrument Workshop first.', tp:'o pini e tomo ilo lon open.' },
    l4BranchAccess: { en:'Solve Reservoir Measure first.', tp:'o pini e musi pi tomo telo lon open.' },
    l4StackDone: { en:'Finish Stackworks first.', tp:'o pini e tomo kiwen sike lon open.' },
    l4CodeDone: { en:'Finish Codebreaker Lab first.', tp:'o pini e tomo linja len lon open.' },
    l4RatioDone: { en:'Finish the Equivalence Gallery first.', tp:'o pini e tomo nanpa sama lon open.' },
    l5BranchAccess: { en:'Solve the River Crossing first.', tp:'o pini e musi telo tawa lon open.' },
    l5FreightDone: { en:'Finish Freight Bay first.', tp:'o pini e tomo poki tawa lon open.' },
    l5SlideDone: { en:'Finish Sliding Gallery first.', tp:'o pini e tomo sitelen tawa lon open.' },
    l5StrategyDone: { en:'Finish the Strategy Room first.', tp:'o pini e tomo nasin sona lon open.' },
    l6BranchAccess: { en:'Solve the Card Archive first.', tp:'o pini e tomo lipu musi lon open.' },
    l6CalculatorDone: { en:'Finish the Calculation Bench first.', tp:'o pini e supa nanpa lon open.' },
    l6CrosswordDone: { en:'Finish the Country Index first.', tp:'o pini e kulupu ma lon open.' },
    l6BasesDone: { en:'Finish the Number Systems Lab first.', tp:'o pini e tomo nasin nanpa lon open.' },
    l7BranchAccess: { en:'Solve the Resonance Hall first.', tp:'o pini e tomo kalama lon open.' },
    l7AirflowDone: { en:'Finish the Airflow Gallery first.', tp:'o pini e tomo nasin kon lon open.' },
    l7PulseDone: { en:'Finish the Pulse Chamber first.', tp:'o pini e tomo wawa tenpo lon open.' },
    l7SpectrumDone: { en:'Finish the Spectrum Laboratory first.', tp:'o pini e tomo kule lon open.' },
    l8BranchAccess: { en:'Solve the Deduction Chamber first.', tp:'o pini e musi pi sona pali lon open.' },
    l8MirrorDone: { en:'Finish the Dual Mirror Array first.', tp:'o pini e ilo lukin tu lon open.' },
    l8TruthDone: { en:'Finish the Truth Gate Rack first.', tp:'o pini e lupa sona lon open.' },
    l8ScheduleDone: { en:'Finish the Dependency Scheduler first.', tp:'o pini e nasin tenpo lon open.' },
    l10TextileDone: { en:'Finish the dye-batch reconciliation and route both cloth batches in the Textile / Dye Loft first. Then the Ledger Office opens for the final audit.', tp:'o pini e nanpa telo kule. o pana e len tu tawa ma pali pona lon tomo len. ni la tomo lipu li open tawa lukin pini.' },
    l10ExitUnlocked: { en:'Complete the final shipment audit at the marked ! console in the Ledger Office first.', tp:'o pini e lukin pini lon ilo {{!}} lon tomo lipu lon open.' }
  };

  function capitalizeSentence(text) {
    const s = String(text || '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function doorLockedMessage(door, status) {
    const missingStateHints = [];
    const seenStates = new Set();
    for (const key of status.missingStates || []) {
      if (seenStates.has(key)) continue;
      seenStates.add(key);
      const hint = DOOR_STATE_HINTS[key];
      if (hint) missingStateHints.push(hint);
    }
    if (isTpLanguage()) {
      const parts = [];
      if (missingStateHints.length) parts.push(...missingStateHints.map(h => h.tp));
      if ((status.missingGlyphs || []).length) parts.push(`o kama jo e sitelen ni lon open: ${status.missingGlyphs.map(g => `[[${g}]]`).join(', ')}.`);
      if (!parts.length) parts.push('o pini e musi open lon ma ni.');
      return `lupa ni li pini. ${parts.join(' ')}`;
    }
    const parts = [];
    if (missingStateHints.length) parts.push(...missingStateHints.map(h => h.en));
    if ((status.missingGlyphs || []).length) parts.push(`Recover these glyphs first: ${status.missingGlyphs.join(', ')}.`);
    if (!parts.length) parts.push('Complete the required earlier puzzle first.');
    return `${capitalizeSentence(door?.label || 'door')} is locked. ${parts.join(' ')}`;
  }

  function showMessagePair(en, tp) {
    if (isTpLanguage()) showLocalizedMessage(tp);
    else showMessage(en);
  }

  function interactionText(target) {
    if (!target) return '';
    const p = interactionPrefix();
    if (target.kind === 'door') {
      const status = doorRequirementStatus(target.door);
      if (!status.ok) return `${p} · ${target.door.label} — locked · solve earlier puzzle`;
      return `${p} · open ${target.door.label}`;
    }
    const obj = target.obj;
    switch (obj.interact) {
      case 'campaignPickup': return `${p} · recover glyph: ${obj.word}`;
      case 'campaignPuzzle': {
        const puzzle = campaignPuzzle(obj.puzzleId);
        if (campaignSolved(obj.puzzleId)) return `${p} · inspect completed ${puzzle?.ui?.title || 'puzzle'}`;
        if (obj.puzzleId === 'l9-sphinx-riddles' && !campaignPuzzleAvailable(obj.puzzleId)) {
          const survey=l9MarkerProgress();
          return `${p} · Sphinx — survey ${survey.found}/${survey.needed}`;
        }
        if (obj.puzzleId === 'l11-call-triangulation' && !campaignPuzzleAvailable(obj.puzzleId)) {
          const calls=l11CallProgress();
          return `${p} · triangulation console — calls ${calls.found}/${calls.needed}`;
        }
        return `${p} · ${puzzle?.ui?.title || 'use puzzle'}`;
      }
      case 'ball': return `${p} · take sike`;
      case 'table': return state.carrying === 'ball' ? `${p} · put sike on supa` : (state.ballOnTable && !campaignSolved('l1-ball-table') ? `${p} · activate the completed sike / supa puzzle` : `${p} · inspect supa`);
      case 'mazeEnter': return campaignWorld().mazeEntranceUnlocked ? `${p} · enter maze` : `${p} · maze door — sealed`;
      case 'mazeExit': {
        if (campaignWorld().mazeExitReleased) return `${p} · leave maze`;
        if (campaignPuzzleAvailable(obj.puzzleId)) return `${p} · enter the three-glyph maze code`;
        return `${p} · sealed maze exit — three glyph keys required`;
      }
      case 'ladderUp': return campaignWorld().upperAccess ? `${p} · climb ladder up` : `${p} · upper ladder hatch sealed`;
      case 'ladderDown': return `${p} · climb ladder down`;
      case 'trapdoor': return campaignWorld().maintenanceAccess ? `${p} · descend to Maintenance` : `${p} · maintenance hatch sealed`;
      case 'lowerLadderUp': return `${p} · climb ladder up`;
      case 'l9UpperToMaze': return `${p} · climb down into the labyrinth`;
      case 'l9MazeToUpper': return `${p} · climb up to the Survey Gallery`;
      case 'l9SphinxToUpper': return `${p} · climb the quick-exit ladder to the upper loft`;
      case 'l9UpperShortcutToSphinx': return `${p} · climb down to the Sphinx Court`;
      case 'l9SphinxToLower': return `${p} · descend through the quick-exit trapdoor`;
      case 'l9LowerToSphinx': return `${p} · climb back to the Sphinx Court`;
      case 'l9WeightsToUpper': return `${p} · climb the counterweight shortcut to the loft`;
      case 'l9UpperShortcutToWeights': return `${p} · climb down to the Counterweight Chamber`;
      case 'l9UpperToVault': return `${p} · descend through the new vault trapdoor`;
      case 'l9VaultToUpper': return `${p} · climb back to the upper gallery`;
      case 'l9MazeMarker': {
        const survey=l9MarkerProgress();
        return `${p} · inspect survey marker (${survey.found}/${survey.needed} already found)`;
      }
      case 'l9CarryRelic':
        return state.carrying ? `${p} · hands full` : `${p} · take ${obj.word||l9RelicWord(obj.carryId)}`;
      case 'l9RelicPedestal': {
        const puzzle=campaignPuzzle('l9-counterweight'),spec=puzzle?.ui?.payload?.pedestals?.find(x=>x.id===obj.pedestalId),placed=state.l9Placements?.[obj.pedestalId];
        if(state.carrying&&String(state.carrying).startsWith('l9:'))return placed?`${p} · pedestal occupied`:`${p} · place carried relic · ${spec?.clue||''}`;
        if(placed)return `${p} · take placed ${l9RelicWord(placed)} · ${spec?.clue||''}`;
        return `${p} · inspect pedestal · ${spec?.clue||''}`;
      }
      case 'l10Cart': {
        const cargo=(state.l10CartCargo||[]).map(l10ParcelWord);
        return `${p} · delivery cart ${cargo.length}/2${cargo.length?` · ${cargo.join(' + ')}`:''}`;
      }
      case 'l10CartControl': {
        if(!campaignWorld().l10PowerOn)return `${p} · freight control — no power`;
        if(!l10CartDockEnabled(obj.dockId))return `${p} · freight stop unavailable`;
        if(state.l10CartDock!==obj.dockId)return `${p} · call cart to ${l10CartDockName(obj.dockId)}`;
        const dest=l10CartRecommendedDestination(obj.dockId);
        return l10CartDockEnabled(dest)?`${p} · send cart to ${l10CartDockName(dest)}`:`${p} · freight route waiting`;
      }
      case 'l10BulkParcel': {
        if(!campaignWorld().l10PowerOn)return `${p} · ${obj.word} crate — freight power required`;
        if(state.l10CartDock!=='receiving')return `${p} · ${obj.word} crate · bring cart to Receiving`;
        if((state.l10CartCargo||[]).length>=2)return `${p} · delivery cart is full`;
        return `${p} · load ${obj.word} crate onto cart`;
      }
      case 'l10DeliveryStand': {
        const placed=state.l10DeliveryPlacements?.[obj.standId],spec=l10DeliveryStandSpec(obj.standId),expected=spec?.accept||obj.expectedParcel,expectedWord=l10ParcelWord(expected),label=l10DeliveryStandLabel(obj);
        if(campaignSolved('l10-delivery-routing'))return `${p} · ${label} supplied with ${expectedWord}`;
        if(l10DeliveryCorrect())return `${p} · confirm completed delivery manifest`;
        if(placed){
          const correct=placed===expected;
          return state.l10CartDock==='market'&&(state.l10CartCargo||[]).length<2?`${p} · ${label}: ${l10ParcelWord(placed)} ${correct?'✓':'WRONG'} · return crate to cart`:`${p} · ${label}: ${l10ParcelWord(placed)} ${correct?'✓':'WRONG'} · expects ${expectedWord}`;
        }
        if(state.l10CartDock!=='market')return `${p} · ${label} expects ${expectedWord} · bring cart to Market Arcade`;
        if(!(state.l10CartCargo||[]).length)return `${p} · ${label} expects ${expectedWord} · cart empty`;
        return (state.l10CartCargo||[]).includes(expected)?`${p} · unload ${expectedWord} at ${label}`:`${p} · ${label} expects ${expectedWord} · matching crate not on cart`;
      }
      case 'l10GroundToLower': return `${p} · OPEN Cold Store hatch ↓ · descend`;
      case 'l10LowerToGround': return `${p} · lift to Market Arcade`;
      case 'l10LowerToUpper': return `${p} · chilled service lift to Textile Loft`;
      case 'l10UpperToLower': return `${p} · chilled service lift to Cold Store`;
      case 'l10GroundToUpper': return `${p} · climb the awning shortcut to Textile Loft`;
      case 'l10UpperToGround': return `${p} · descend the awning shortcut to Market Arcade`;
      case 'l10TextileParcel': return state.carrying?`${p} · hands full`:`${p} · take ${obj.word} cloth batch`;
      case 'l10TextileStation': {
        const placed=state.l10TextilePlacements?.[obj.stationId];
        if(campaignSolved('l10-textile-routing'))return `${p} · inspect completed textile station`;
        if(placed)return state.carrying?`${p} · ${l10ParcelWord(placed)} batch placed here`:`${p} · take placed ${l10ParcelWord(placed)} batch`;
        if(String(state.carrying||'').startsWith('l10:textile:'))return `${p} · place carried cloth batch here`;
        return `${p} · empty textile station`;
      }
      case 'l10QuarantineStatus': return `${p} · inspect quarantine audit status`;
      case 'l10ExitTerminal': return `${p} · leave completed Level 10`;
      case 'l11CallPylon': {
        const calls=l11CallProgress(),done=Boolean(state.l11CallMarkers?.[obj.pylonId]);
        return done?`${p} · call pylon ${obj.pylonId} recorded · survey ${calls.found}/${calls.needed}`:`${p} · record call pylon ${obj.pylonId} · survey ${calls.found}/${calls.needed}`;
      }
      case 'l11GroundToCanopy': return `${p} · marked canopy ladder ↑ · climb to Aviary Walk`;
      case 'l11CanopyToGround': return `${p} · descend to Habitat Hub`;
      case 'l11CanopyToLower': return `${p} · OPEN incubator hatch ↓ · descend`;
      case 'l11LowerToCanopy': return `${p} · climb back to Aviary Walk`;
      case 'l11CanopyToRecovery': return `${p} · new Recovery Ward shortcut ↓ · descend`;
      case 'l11RecoveryToCanopy': return `${p} · climb back to Nest Observatory`;
      case 'l11BandParcel': return state.carrying?`${p} · hands full`:`${p} · take ${obj.bandLabel||l11BandWord(obj.bandId)} parent band`;
      case 'l11BandPerch': {
        const placed=state.l11BandPlacements?.[obj.perchId],spec=l11BandPerchSpec(obj.perchId),expected=spec?.accept||obj.expectedBand,expectedWord=l11BandWord(expected),side=obj.perchId==='west-perch'?'west':'east';
        if(campaignSolved('l11-parent-bands'))return `${p} · ${side} perch aligned with ${expectedWord}`;
        if(placed)return state.carrying?`${p} · ${side} perch holds ${l11BandWord(placed)} · expects ${expectedWord}`:`${p} · take placed ${l11BandWord(placed)} band from ${side} perch`;
        if(String(state.carrying||'').startsWith('l11:band:'))return `${p} · place carried band on ${side} perch · expects ${expectedWord}`;
        return `${p} · ${side} perch expects ${expectedWord}`;
      }
      case 'l11ExitTerminal': return `${p} · inspect restored sanctuary exit`;
      case 'l12GroundToUpper': return `${p} · marked master-trial ladder ↑ · climb to Identity Gallery`;
      case 'l12UpperToGround': return `${p} · descend to Fracture Core`;
      case 'l12GroundToLower': return `${p} · marked master-trial hatch ↓ · descend to Totality Cipher Vault`;
      case 'l12LowerToGround': return `${p} · climb back to Fracture Core`;
      case 'l12LowerToFinal': return `${p} · FINAL hatch ↓ · descend to last Sudoku`;
      case 'l12FinalToLower': return `${p} · climb back to Totality Cipher Vault`;
      case 'l12ExitTerminal': return `${p} · inspect completed final archive`;
      default: return `${p} · interact`;
    }
  }

  function interactionTextLocalized(target) {
    if (!isTpLanguage()) return interactionText(target);
    if (!target) return '';
    const p = interactionPrefixLocalized();
    if (target.kind === 'door') {
      const status = doorRequirementStatus(target.door);
      return status.ok ? `${p} · o open e lupa` : `${p} · lupa li pini · o pini e musi open`;
    }
    const obj = target.obj;
    switch (obj.interact) {
      case 'campaignPickup': return `${p} · o kama jo e sitelen [[${obj.word}]]`;
      case 'campaignPuzzle': {
        const puzzle = campaignPuzzle(obj.puzzleId);
        if (campaignSolved(obj.puzzleId)) return `${p} · o lukin e musi pini: ${puzzleText(puzzle,'title') || 'musi'}`;
        if (obj.puzzleId === 'l9-sphinx-riddles' && !campaignPuzzleAvailable(obj.puzzleId)) {
          const survey=l9MarkerProgress(); return `${p} · jan [[Sphinx]] · alasa ${survey.found}/${survey.needed}`;
        }
        if (obj.puzzleId === 'l11-call-triangulation' && !campaignPuzzleAvailable(obj.puzzleId)) {
          const calls=l11CallProgress(); return `${p} · ilo alasa ma · kalama ${calls.found}/${calls.needed}`;
        }
        return `${p} · ${puzzleText(puzzle,'title') || 'o kepeken ilo musi'}`;
      }
      case 'ball': return `${p} · o kama jo e [[sike]]`;
      case 'table': return state.carrying === 'ball' ? `${p} · o pana e [[sike]] lon [[supa]]` : `${p} · o lukin e [[supa]]`;
      case 'mazeEnter': return campaignWorld().mazeEntranceUnlocked ? `${p} · o tawa insa nasin nasa` : `${p} · lupa nasin nasa li pini`;
      case 'mazeExit': return campaignWorld().mazeExitReleased ? `${p} · o tawa weka tan nasin nasa` : (campaignPuzzleAvailable(obj.puzzleId) ? `${p} · o pana e linja sitelen tu wan` : `${p} · lupa li pini · sitelen tu wan li wile`);
      case 'ladderUp': return campaignWorld().upperAccess ? `${p} · o tawa sewi` : `${p} · lupa sewi li pini`;
      case 'ladderDown': case 'lowerLadderUp': return `${p} · o tawa kepeken palisa`;
      case 'trapdoor': return campaignWorld().maintenanceAccess ? `${p} · o tawa anpa tawa ma pali` : `${p} · lupa anpa li pini`;
      case 'l9UpperToMaze': return `${p} · o tawa anpa tawa nasin nasa`;
      case 'l9MazeToUpper': return `${p} · o tawa sewi tawa tomo alasa`;
      case 'l9SphinxToUpper': return `${p} · o kepeken nasin weka lili tawa sewi`;
      case 'l9UpperShortcutToSphinx': return `${p} · o tawa anpa tawa jan [[Sphinx]]`;
      case 'l9SphinxToLower': return `${p} · o tawa anpa kepeken lupa lili`;
      case 'l9LowerToSphinx': return `${p} · o kama sin tawa jan [[Sphinx]]`;
      case 'l9WeightsToUpper': return `${p} · o tawa sewi kepeken nasin kiwen awen`;
      case 'l9UpperShortcutToWeights': return `${p} · o tawa anpa tawa tomo kiwen awen`;
      case 'l9UpperToVault': return `${p} · o tawa anpa kepeken lupa sin`;
      case 'l9VaultToUpper': return `${p} · o kama sin tawa tomo sewi`;
      case 'l9MazeMarker': { const survey=l9MarkerProgress(); return `${p} · o lukin e sitelen alasa (${survey.found}/${survey.needed})`; }
      case 'l9CarryRelic': return state.carrying ? `${p} · luka sina li jo e ijo` : `${p} · o kama jo e [[${obj.word||l9RelicWord(obj.carryId)}]]`;
      case 'l9RelicPedestal': {
        const puzzle=campaignPuzzle('l9-counterweight'),spec=puzzle?.ui?.payload?.pedestals?.find(x=>x.id===obj.pedestalId),placed=state.l9Placements?.[obj.pedestalId];
        const clue=exactText(spec?.clue||'');
        if(state.carrying&&String(state.carrying).startsWith('l9:'))return placed?`${p} · supa li jo e ijo`:`${p} · o pana e ijo jo lon supa · ${clue}`;
        if(placed)return `${p} · o kama jo e [[${l9RelicWord(placed)}]] · ${clue}`;
        return `${p} · o lukin e supa · ${clue}`;
      }
      case 'l10Cart': { const cargo=(state.l10CartCargo||[]).map(w=>`[[${l10ParcelWord(w)}]]`); return `${p} · ilo tawa ${cargo.length}/2${cargo.length?` · ${cargo.join(' + ')}`:''}`; }
      case 'l10CartControl': {
        if(!campaignWorld().l10PowerOn)return `${p} · ilo tawa li jo ala e wawa`;
        if(!l10CartDockEnabled(obj.dockId))return `${p} · ma tawa ni li open ala`;
        if(state.l10CartDock!==obj.dockId)return `${p} · o kama e ilo tawa tawa ${termLabelText(obj.dockId)}`;
        const dest=l10CartRecommendedDestination(obj.dockId); return l10CartDockEnabled(dest)?`${p} · o tawa e ilo tawa tawa ${termLabelText(dest)}`:`${p} · nasin tawa li awen`;
      }
      case 'l10BulkParcel': return !campaignWorld().l10PowerOn?`${p} · wawa tawa li wile`:state.l10CartDock!=='receiving'?`${p} · o kama e ilo tawa tawa ma kama`:(state.l10CartCargo||[]).length>=2?`${p} · ilo tawa li jo e poki tu`:`${p} · o pana e poki [[${obj.word}]] lon ilo tawa`;
      case 'l10DeliveryStand': { const spec=l10DeliveryStandSpec(obj.standId),expected=l10ParcelWord(spec?.accept||obj.expectedParcel); return `${p} · ma ni li wile e [[${expected}]]`; }
      case 'l10GroundToLower': return `${p} · lupa tomo lete li open ↓ · o tawa anpa`;
      case 'l10LowerToGround': return `${p} · o tawa sewi tawa tomo esun`;
      case 'l10LowerToUpper': return `${p} · o tawa sewi tawa tomo len`;
      case 'l10UpperToLower': return `${p} · o tawa anpa tawa tomo lete`;
      case 'l10GroundToUpper': return `${p} · o tawa sewi kepeken nasin lili`;
      case 'l10UpperToGround': return `${p} · o tawa anpa tawa tomo esun`;
      case 'l10TextileParcel': return state.carrying?`${p} · luka sina li jo e ijo`:`${p} · o kama jo e len [[${obj.word}]]`;
      case 'l10TextileStation': return String(state.carrying||'').startsWith('l10:textile:')?`${p} · o pana e len jo lon ni`:`${p} · o lukin e ma pali len`;
      case 'l10QuarantineStatus': return `${p} · o lukin e lipu pi ma awen ike`;
      case 'l10ExitTerminal': return `${p} · o tawa tan ma musi 10 pini`;
      case 'l11CallPylon': { const calls=l11CallProgress(),done=Boolean(state.l11CallMarkers?.[obj.pylonId]); return `${p} · palisa kalama ${obj.pylonId} · ${done?'sona li awen':'o awen e sona'} · ${calls.found}/${calls.needed}`; }
      case 'l11GroundToCanopy': return `${p} · palisa ↑ · o tawa sewi`;
      case 'l11CanopyToGround': return `${p} · o tawa anpa tawa tomo ma soweli`;
      case 'l11CanopyToLower': return `${p} · lupa poki mama ↓ · o tawa anpa`;
      case 'l11LowerToCanopy': return `${p} · o kama sin tawa nasin waso`;
      case 'l11CanopyToRecovery': return `${p} · nasin tomo pona sin ↓`;
      case 'l11RecoveryToCanopy': return `${p} · o kama sin tawa tomo lukin mama`;
      case 'l11BandParcel': return state.carrying?`${p} · luka sina li jo e ijo`:`${p} · o kama jo e sitelen mama [[${obj.bandLabel||l11BandWord(obj.bandId)}]]`;
      case 'l11BandPerch': { const spec=l11BandPerchSpec(obj.perchId),expected=l11BandWord(spec?.accept||obj.expectedBand); return `${p} · supa ${obj.perchId==='west-perch'?'←':'→'} li wile e [[${expected}]]`; }
      case 'l11ExitTerminal': return `${p} · o lukin e nasin weka pona`;
      case 'l12GroundToUpper': return `${p} · palisa ↑ · o tawa tawa tomo nasin sitelen`;
      case 'l12UpperToGround': return `${p} · o tawa anpa tawa ilo pakala insa`;
      case 'l12GroundToLower': return `${p} · lupa ↓ · o tawa tawa tomo linja len`;
      case 'l12LowerToGround': return `${p} · o kama sin tawa ilo pakala insa`;
      case 'l12LowerToFinal': return `${p} · lupa [[FINAL]] ↓ · o tawa tawa [[Sudoku]] pini`;
      case 'l12FinalToLower': return `${p} · o kama sin tawa tomo linja len`;
      case 'l12ExitTerminal': return `${p} · o lukin e tomo lipu pini`;
      default: return `${p} · o kepeken`;
    }
  }

  function describePuzzleRequirements(puzzle) {
    if (!puzzle) return isTpLanguage() ? 'ilo ni li ken ala lon tenpo ni.' : 'This mechanism is not ready.';
    const rt = campaignRuntime();
    const solved = rt ? rt.solvedSet() : new Set();
    const world = campaignWorld();
    const missingGlyphs = (puzzle.requirements.glyphs || []).filter(g => !collected(g));
    const missingStates = Object.entries(puzzle.requirements.states || {}).filter(([k,v]) => world[k] !== v).map(([k]) => k);
    const missingPuzzles = (puzzle.requirements.solvedPuzzles || []).filter(id => !solved.has(id));
    if (isTpLanguage()) {
      const parts = [];
      if (missingGlyphs.length) parts.push(`sitelen wile: ${missingGlyphs.map(g=>`[[${g}]]`).join(', ')}`);
      if (missingStates.length) parts.push(`wile ma/ilo ${missingStates.length} li pini ala`);
      if (missingPuzzles.length) parts.push(`musi open ${missingPuzzles.length} li pini ala`);
      return parts.length ? `ilo ni li ken ala. ${parts.join(' · ')}.` : 'ilo ni li ken ala lon tenpo ni.';
    }
    const parts = [];
    if (missingGlyphs.length) parts.push(`glyph keys: ${missingGlyphs.join(', ')}`);
    if (missingStates.length) parts.push(`world state: ${missingStates.join(', ')}`);
    if (missingPuzzles.length) parts.push(`earlier puzzle: ${missingPuzzles.join(', ')}`);
    return parts.length ? `Not ready — missing ${parts.join(' · ')}.` : 'This mechanism is not ready.';
  }

  function showGlyphReward(word, source) {
    if (!isCollectibleGlyph(word)) return;
    glyphPopupGlyph.textContent = glyphChar(word);
    glyphPopupTitle.textContent = word;
    glyphPopupTitle.classList.toggle('tpTerm', isTpLanguage());
    renderExact(glyphPopupSource, source || 'Glyph recovered.');
    renderLocalized(glyphPopupCount, progressSummaryText(currentLevelProgress()));
    openModal(glyphPopup);
    pickupTone();
    glyphPopupClose.focus({ preventScroll: true });
  }

  function queueAwardedGlyphs(words, source) {
    const list = (words || []).filter(isCollectibleGlyph);
    if (!list.length) return;
    pendingGlyphRewards.push(...list.map(word => ({ word, source })));
    if (glyphPopup.hidden) {
      const next = pendingGlyphRewards.shift();
      showGlyphReward(next.word, next.source);
    }
  }

  function completeCampaignPuzzle(puzzleId, source) {
    if (!campaignAdapter) return { ok:false, reason:'campaign-unavailable' };
    const puzzle = campaignPuzzle(puzzleId);
    if (!puzzle) return { ok:false, reason:'unknown-puzzle' };
    syncCampaignArea(puzzle.area);
    const result = campaignAdapter.completePuzzle(puzzleId);
    if (!result.ok) {
      showMessage(describePuzzleRequirements(puzzle));
      blockedTone();
      return result;
    }
    syncWorldFromCampaign();
    state.campaign = campaignAdapter.snapshot();
    if (result.awarded && result.awarded.length) {
      for (const word of result.awarded) log(`Recovered glyph: ${word} (${collectionCount()}/120)${source ? ` — ${source}` : ''}`);
      queueAwardedGlyphs(result.awarded, source || puzzle.ui.title || 'Puzzle completed.');
    } else {
      successTone();
    }
    log(`Completed puzzle: ${puzzle.ui.title || puzzle.id}.`);
    if (puzzleId === 'l9-sphinx-riddles') {
      showMessage('The Sphinx yields. A quick-exit ladder to the upper loft and a trapdoor to the lower chambers open in the court.');
      log('The Sphinx Court changes: a quick-exit ladder rises to the upper loft and a trapdoor opens to the lower chambers.');
    }
    if (puzzleId === 'l10-market-till') {
      showMessage('All three market allocations are correct. Conveyor and freight-cart power comes online across the market.');
      log('Level 10 freight spine powered from the percentage allocation ledger.');
    }
    if (puzzleId === 'l10-cold-chain') {
      showMessage('Cold chain stable. The recorder console is now active; normalize its three values before the service lift can run.');
      log('Level 10 cold chain stable: scientific recorder activated.');
    }
    if (puzzleId === 'l10-cold-record') {
      showMessage('Scientific record accepted. The chilled service lift now runs directly between the basement and textile loft.');
      log('Level 10 scientific notation record complete: upper service lift activated.');
    }
    if (puzzleId === 'l10-textile-mixer') {
      // The routing stage starts here. Older builds exposed the cloth before the
      // mixer was solved, so a persisted test save could leave it somewhere the
      // player would not reasonably know to look. Start this stage from a clear,
      // deterministic visual state beside the mixer.
      if(!campaignSolved('l10-textile-routing')){
        if(String(state.carrying||'').startsWith('l10:textile:'))state.carrying=null;
        state.l10TextilePlacements={};
        state.l10TextileLocations={'blue-cloth':'upper-rack','white-cloth':'upper-rack'};
        spriteCache.clear();
      }
      showMessagePair(
        'Dye batches complete. Two cloth bundles are now beside the mixer: laso on the left and walo on the right. Carry laso to the laso-marked dye frame and walo to the walo-marked finishing table.',
        'nanpa telo kule li pini. len tu li kama lon poka ilo: len [[laso]] li lon poka loje; len [[walo]] li lon poka laso. o pana e [[laso]] tawa supa kule pi sitelen [[laso]]. o pana e [[walo]] tawa supa pini pi sitelen [[walo]].'
      );
      log('Level 10 dye-batch reconciliation complete: textile routing objects released beside the mixer.');
    }
    if (puzzleId === 'l10-inspection-audit') {
      showMessage('Final audit approved. pan is cleared for Dispatch; suwi is classified for Quarantine. The Dispatch Bay exit is now OPEN on the market floor.');
      log('Level 10 final shipment audit complete: Dispatch exit opened.');
    }
    if (puzzleId === 'l11-call-triangulation') {
      showMessage('Roost located. A marked canopy ladder ↑ opens in the Habitat Hub.');
      log('Level 11 call triangulation complete: canopy route opened.');
    }
    if (puzzleId === 'l11-roost-schedule') {
      showMessage('Overnight cycle restored. The incubator hatch ↓ is now open on the Aviary Walk.');
      log('Level 11 roost schedule complete: incubator route opened.');
    }
    if (puzzleId === 'l11-lineage-match') {
      showMessage('Lineage matched. The loje and laso parent bands are released in the Nest Observatory.');
      log('Level 11 lineage registry complete: parent bands released.');
    }
    if (puzzleId === 'l11-habitat-triage') {
      showMessage('Habitat triage complete. The sanctuary exit is restored.');
      log('Level 11 habitat recovery complete: exit restored.');
    }
    if (puzzleId === 'l12-parity-core') {
      showMessage('Archive spine repaired. A marked upper ladder ↑ and lower hatch ↓ are now active in the Fracture Core.');
      log('Level 12 fracture parity core complete: upper and lower master-trial routes activated.');
    }
    if (puzzleId === 'l12-identity-order') {
      showMessage('Identity permutation resolved. The Relation Observatory trial is now available upstairs.');
      log('Level 12 identity permutation complete.');
    }
    if (puzzleId === 'l12-master-code') {
      if (campaignWorld().l12RelationDone) showMessage('Totality cipher resolved. All preliminary trials are complete: the FINAL hatch ↓ is open in this vault.');
      else showMessage('Totality cipher resolved. Complete the upper Relation Observatory to open the final hatch.');
      log('Level 12 totality cipher complete.');
    }
    if (puzzleId === 'l12-relation-mirrors') {
      if (campaignWorld().l12CipherDone) showMessage('Triple mirror relation solved. All preliminary trials are complete: the FINAL hatch ↓ is open in the lower cipher vault.');
      else showMessage('Triple mirror relation solved. Complete the lower Totality Cipher before the final hatch can open.');
      log('Level 12 triple relation mirror array complete.');
    }
    if (puzzleId === 'l12-final-sudoku') {
      showMessage('Final Sudoku solved. All 120 glyphs are recovered. The game is complete.');
      log('Level 12 final Sudoku complete: 120/120 glyphs recovered.');
    }
    saveState();
    renderCollection();
    updateHUD();
    if (result.levelComplete) window.setTimeout(() => { if (glyphPopup.hidden) openLevelComplete(); }, 80);
    return result;
  }

  function openCampaignPuzzleById(puzzleId) {
    const puzzle = campaignPuzzle(puzzleId);
    if (!puzzle) { showMessage('Unknown campaign puzzle.'); blockedTone(); return; }
    syncCampaignArea(puzzle.area);
    if (campaignSolved(puzzleId)) { showMessage('This puzzle is already complete.'); softTone(); return; }
    if (!campaignPuzzleAvailable(puzzleId)) {
      if (puzzleId === 'l2-map-cache') {
        showLocalizedMessage(isTpLanguage()
          ? 'sitelen ma nanpa li awen. o pini e musi lon tomo lipu anpa lon open.'
          : 'The Coordinate Map is waiting for the Archive Sequence in the Lower Archive. Complete that panel first.');
      } else if (puzzleId === 'l9-sphinx-riddles') {
        const survey=l9MarkerProgress();
        showMessage(`The Sphinx is waiting for the labyrinth survey: ${survey.found}/${survey.needed} markers inspected.`);
      } else if (puzzleId === 'l11-call-triangulation') {
        const calls=l11CallProgress();
        showMessage(`The triangulation console needs all three acoustic pylons: ${calls.found}/${calls.needed} recorded.`);
      } else if (puzzleId === 'l12-relation-mirrors') {
        showMessage('The Relation Observatory is waiting for the Identity permutation to be resolved first.');
      } else if (puzzleId === 'l12-final-sudoku') {
        showMessage('The final Sudoku is sealed until the Identity, Totality and Relation trials are all complete.');
      } else showMessage(describePuzzleRequirements(puzzle));
      blockedTone(); return;
    }
    campaignAdapter.openPuzzle(puzzleId);
  }

  function performInteraction(targetOverride = null) {
    if (modalOpen) return;
    const target = targetOverride || findInteractionTarget();
    if (!target) { showMessage('Nothing within reach.'); blockedTone(); return; }

    if (target.kind === 'door') {
      const d = target.door;
      const status = doorRequirementStatus(d);
      if (!status.ok) {
        showLocalizedMessage(doorLockedMessage(d, status));
        blockedTone(); return;
      }
      d.open = true; state.openDoors[d.id] = true;
      showMessage(`${d.label} opens.`);
      doorTone(); log(`Opened ${d.label}.`); saveState(); return;
    }

    const obj = target.obj;
    if (obj.areaId) syncCampaignArea(obj.areaId);
    if(QA_MODE && obj.puzzleId && !campaignSolved(obj.puzzleId)){
      const qaPuzzle=campaignPuzzle(obj.puzzleId);
      if(qaPuzzle) qaRecordPuzzleCheckpoint(qaPuzzle);
    }
    switch (obj.interact) {
      case 'campaignPickup': {
        const result = completeCampaignPuzzle(obj.puzzleId, obj.rewardSource || `Recovered at ${currentRoom().name}.`);
        if (result.ok) spriteCache.clear();
        break;
      }
      case 'campaignPuzzle':
        openCampaignPuzzleById(obj.puzzleId);
        break;
      case 'ball':
        state.carrying = 'ball'; showMessage('You take the sike.'); pickupTone(); log('Picked up the sike.');
        break;
      case 'table':
        if (state.carrying === 'ball') {
          state.carrying = null; state.ballOnTable = true; spriteCache.clear();
          const result = completeCampaignPuzzle('l1-ball-table', 'Earned by solving: o pana e sike lon supa.');
          if (result.ok) showMessage('pona! The sike rests on the supa. The concourse gate opens immediately and the maze route is now active.');
          else showMessage('The sike is correctly placed, but the mechanism still expects the introductory glyph keys.');
        } else if (state.ballOnTable && !campaignSolved('l1-ball-table')) {
          completeCampaignPuzzle('l1-ball-table', 'Earned by solving: o pana e sike lon supa.');
        } else showMessage('A heavy work table: supa.');
        break;
      case 'mazeEnter':
        if (!campaignWorld().mazeEntranceUnlocked) {
          showMessagePair('The maze entrance is still locked. Put the ball on the table to open the gate.','lupa open pi nasin nasa li pini. o pana e [[sike]] lon [[supa]]; ni la lupa li open.'); blockedTone();
        } else if (campaignWorld().mazeExitReleased) {
          transitionLevel('maze', 1.5, 1.82, Math.PI/2, 'You re-enter the solved maze. Use Leave maze (X) from anywhere when you want to return outside.');
        } else {
          transitionLevel('maze', 1.5, 1.82, Math.PI/2, 'You enter the maze. The entrance seals behind you.');
        }
        break;
      case 'mazeExit':
        if (campaignWorld().mazeExitReleased) {
          transitionLevel('main', 3.2, 9.3, 0, 'You leave the maze. Its entrance remains open for the rest of the level.');
        } else if (campaignPuzzleAvailable(obj.puzzleId)) {
          openCampaignPuzzleById(obj.puzzleId);
        } else {
          showMessagePair('The maze exit is still locked. Find the three hidden glyphs in the maze, then return here.','lupa weka pi nasin nasa li pini. o alasa e sitelen tu wan lon nasin nasa; ni la o kama sin tawa ni.'); blockedTone();
        }
        break;
      case 'ladderUp':
        if (!campaignWorld().upperAccess) { showMessagePair('The upper hatch is still locked. Solve the maze code to unlock the Upper Gallery.','lupa sewi li pini. o pini e musi nanpa lon nasin nasa; ni la tomo sewi li open.'); blockedTone(); }
        else transitionLevel('upper', 2.3, 2.5, 0.15, 'You climb into the Upper Gallery.');
        break;
      case 'ladderDown':
        transitionLevel('main', 16.0, 9.35, Math.PI, 'You climb down into the Lower Concourse.');
        break;
      case 'trapdoor':
        if (!campaignWorld().maintenanceAccess) { showMessagePair('The maintenance hatch is still locked. Complete the first number puzzle upstairs to open it.','lupa tawa ma pali li pini. o pini e musi nanpa open lon tomo sewi; ni la lupa li open.'); blockedTone(); }
        else transitionLevel('lower', 5.8, 2.8, 1.55, 'You descend into the Maintenance Level.');
        break;
      case 'lowerLadderUp':
        transitionLevel('upper', 5.6, 8.6, -1.55, 'You climb back into the Upper Gallery.');
        break;
      case 'l9UpperToMaze':
        transitionLevel('l9maze',1.55,1.75,Math.PI/2,'You descend into the Vertical Labyrinth.');
        break;
      case 'l9MazeToUpper':
        transitionLevel('l9upper',3.0,9.0,-Math.PI/2,'You climb back into the Survey Gallery.');
        break;
      case 'l9SphinxToUpper':
        transitionLevel('l9upper',18.0,8.5,Math.PI,'You take the quick-exit ladder from the Sphinx Court into the Counterweight Loft.');
        break;
      case 'l9UpperShortcutToSphinx':
        transitionLevel('l9maze',13.5,8.6,0,'You descend directly into the Sphinx Court.');
        break;
      case 'l9SphinxToLower':
        transitionLevel('l9lower',2.8,2.7,0,'You take the quick-exit trapdoor beneath the Sphinx Court into the Counterweight Chamber.');
        break;
      case 'l9LowerToSphinx':
        transitionLevel('l9maze',17.0,11.6,Math.PI,'You climb back into the Sphinx Court.');
        break;
      case 'l9WeightsToUpper':
        transitionLevel('l9upper',13.2,8.8,Math.PI,'The counterweight ladder carries you directly to the upper loft.');
        break;
      case 'l9UpperShortcutToWeights':
        transitionLevel('l9lower',8.8,2.5,Math.PI,'You descend the counterweight shortcut.');
        break;
      case 'l9UpperToVault':
        transitionLevel('l9lower',22.4,2.8,Math.PI,'You descend through the newly exposed vault trapdoor.');
        break;
      case 'l9VaultToUpper':
        transitionLevel('l9upper',5.8,6.2,0,'You climb back to the Survey Gallery.');
        break;
      case 'l9MazeMarker': {
        if(campaignSolved('l9-maze-survey')){showMessage('The labyrinth survey is already complete.');softTone();break;}
        state.l9Markers=state.l9Markers||{};
        state.l9Markers[obj.markerId]=true;
        const puzzle=campaignPuzzle('l9-maze-survey'),ids=puzzle?.ui?.payload?.markerIds||[];
        const found=ids.filter(id=>state.l9Markers[id]).length;
        if(ids.length&&found===ids.length){
          const result=completeCampaignPuzzle('l9-maze-survey','Earned by surveying all three distant labyrinth markers.');
          if(result.ok){
            showMessage('Survey complete: 3/3. Return to the Sphinx Court at the centre of the labyrinth.');
            log('Labyrinth survey complete: 3/3. Return to the Sphinx Court.');
          }
        }else{
          showMessage(`Survey marker recorded: ${found}/${ids.length||3}.`);
          log(`Survey marker recorded: ${found}/${ids.length||3}.`);
          pickupTone();
        }
        spriteCache.clear();
        break;
      }
      case 'l9CarryRelic': {
        if(campaignSolved('l9-counterweight')){showMessage('The counterweight relics are already balanced.');softTone();break;}
        if(state.carrying){showMessage('You can carry only one object at a time.');blockedTone();break;}
        state.carrying=`l9:${obj.carryId}`;showMessage(`You take the ${obj.word||l9RelicWord(obj.carryId)} relic.`);pickupTone();spriteCache.clear();
        break;
      }
      case 'l9RelicPedestal': {
        const puzzle=campaignPuzzle('l9-counterweight'),spec=puzzle?.ui?.payload?.pedestals?.find(x=>x.id===obj.pedestalId);
        state.l9Placements=state.l9Placements||{};
        const placed=state.l9Placements[obj.pedestalId];
        if(state.carrying&&String(state.carrying).startsWith('l9:')){
          if(placed){showMessage('That pedestal is occupied. Pick up its relic first.');blockedTone();break;}
          const carryId=String(state.carrying).slice(3);
          state.l9Placements[obj.pedestalId]=carryId;state.carrying=null;spriteCache.clear();
          if(l9CounterweightPlacementCorrect()){
            const result=completeCampaignPuzzle('l9-counterweight','Earned by carrying and correctly placing all three relics across the three floors.');
            if(result.ok)showMessage('The counterweights balance. A direct ladder to the upper loft drops into place.');
          }else showMessage(`Relic placed. ${spec?.clue||'Check the pedestal clue.'}`);
          stepTone();
        }else if(placed){
          state.carrying=`l9:${placed}`;delete state.l9Placements[obj.pedestalId];spriteCache.clear();
          showMessage(`You take the placed ${l9RelicWord(placed)} relic.`);pickupTone();
        }else{
          showMessage(spec?.clue||'An empty counterweight pedestal.');softTone();
        }
        break;
      }
      case 'l10Cart': {
        const cargo=(state.l10CartCargo||[]).map(l10ParcelWord);
        showMessage(cargo.length?`Cart cargo ${cargo.length}/2: ${cargo.join(', ')}.`:'The delivery cart is empty (0/2).');softTone();
        break;
      }
      case 'l10CartControl': {
        if(!campaignWorld().l10PowerOn){showMessage('The freight controls have no power. Complete the Market allocation ledger first.');blockedTone();break;}
        if(!l10CartDockEnabled(obj.dockId)){showMessage('That freight stop is not available yet.');blockedTone();break;}
        if(state.l10CartDock!==obj.dockId){
          const old=l10CartDockName(state.l10CartDock);state.l10CartDock=obj.dockId;state.l10CartTrips=(Number(state.l10CartTrips)||0)+1;spriteCache.clear();
          showMessage(`The delivery cart arrives from ${old}.`);stepTone();log(`Delivery cart called to ${l10CartDockName(obj.dockId)}.`);break;
        }
        const dest=l10CartRecommendedDestination(obj.dockId);
        if(!l10CartDockEnabled(dest)){showMessage('The next freight route is not available yet.');blockedTone();break;}
        state.l10CartDock=dest;state.l10CartTrips=(Number(state.l10CartTrips)||0)+1;spriteCache.clear();
        showMessage(`The delivery cart moves to ${l10CartDockName(dest)}.`);stepTone();log(`Delivery cart moved to ${l10CartDockName(dest)}.`);break;
      }
      case 'l10BulkParcel': {
        if(!campaignWorld().l10PowerOn){showMessage('The cart system is not powered yet.');blockedTone();break;}
        if(state.l10CartDock!=='receiving'){showMessage('Bring the delivery cart to Receiving before loading the bulk crate.');blockedTone();break;}
        state.l10CartCargo=state.l10CartCargo||[];
        if(state.l10CartCargo.length>=2){showMessage('The delivery cart already carries two crates.');blockedTone();break;}
        if(!state.l10CartCargo.includes(obj.parcelId))state.l10CartCargo.push(obj.parcelId);
        state.l10ParcelLocations[obj.parcelId]='cart';spriteCache.clear();
        showMessage(`${obj.word} crate loaded onto the cart (${state.l10CartCargo.length}/2).`);pickupTone();log(`${obj.word} crate loaded onto delivery cart.`);break;
      }
      case 'l10DeliveryStand': {
        if(campaignSolved('l10-delivery-routing')){showMessage('This delivery stand is already correctly supplied.');softTone();break;}
        if(l10DeliveryCorrect()){l10MaybeCompleteDelivery();break;}
        state.l10DeliveryPlacements=state.l10DeliveryPlacements||{};state.l10CartCargo=state.l10CartCargo||[];
        const placed=state.l10DeliveryPlacements[obj.standId],spec=l10DeliveryStandSpec(obj.standId),expected=spec?.accept||obj.expectedParcel,expectedWord=l10ParcelWord(expected),label=l10DeliveryStandLabel(obj);
        if(placed){
          if(state.l10CartDock!=='market'||state.l10CartCargo.length>=2){showMessage(`${label} holds ${l10ParcelWord(placed)}; bring an available cart to recover it.`);blockedTone();break;}
          state.l10CartCargo.push(placed);delete state.l10DeliveryPlacements[obj.standId];state.l10ParcelLocations[placed]='cart';spriteCache.clear();
          showMessage(`${l10ParcelWord(placed)} crate returned from ${label} to the cart.`);pickupTone();break;
        }
        if(state.l10CartDock!=='market'){showMessage(`${label} expects ${expectedWord}. Bring the delivery cart to the Market Arcade first.`);blockedTone();break;}
        const cargoIndex=state.l10CartCargo.indexOf(expected);
        if(cargoIndex<0){showMessage(`${label} expects ${expectedWord}, but that crate is not on the cart.`);blockedTone();break;}
        const [parcelId]=state.l10CartCargo.splice(cargoIndex,1);
        state.l10DeliveryPlacements[obj.standId]=parcelId;state.l10ParcelLocations[parcelId]=obj.standId;spriteCache.clear();
        showMessage(`${expectedWord} crate delivered to ${label} ✓`);stepTone();
        if(!l10MaybeCompleteDelivery())log(`Delivery placement: ${l10ParcelWord(parcelId)} → ${obj.standId}.`);
        break;
      }
      case 'l10GroundToLower': transitionLevel('l10lower',2.5,6.3,0,'You descend through the marked Cold Store hatch.');break;
      case 'l10LowerToGround': transitionLevel('l10ground',11.2,11.2,-Math.PI/2,'You return to the Central Market Arcade.');break;
      case 'l10LowerToUpper': transitionLevel('l10upper',2.7,9.8,0,'The chilled service lift carries you directly to the Textile / Dye Loft.');break;
      case 'l10UpperToLower': transitionLevel('l10lower',9.0,9.8,Math.PI,'The chilled service lift descends to the Cold Store.');break;
      case 'l10GroundToUpper': transitionLevel('l10upper',10.0,10.0,Math.PI,'You climb the lowered awning shortcut into the Textile / Dye Loft.');break;
      case 'l10UpperToGround': transitionLevel('l10ground',19.0,11.2,0,'You descend the awning shortcut into the Central Market Arcade.');break;
      case 'l10TextileParcel': {
        if(!campaignWorld().l10DyeReady){showMessagePair('Finish the dye-batch reconciliation first. The cloth-routing stage has not started yet.','o pini e nanpa telo kule lon open. pali tawa len li open ala lon tenpo ni.');blockedTone();break;}
        if(campaignSolved('l10-textile-routing')){showMessage('The textile batch is already complete.');softTone();break;}
        if(state.carrying){showMessage('You can carry only one object at a time.');blockedTone();break;}
        state.carrying=`l10:textile:${obj.textileId}`;state.l10TextileLocations[obj.textileId]='carrying';spriteCache.clear();
        showMessage(`You take the ${obj.word} cloth batch.`);pickupTone();break;
      }
      case 'l10TextileStation': {
        if(!campaignWorld().l10DyeReady){showMessagePair('Finish the dye-batch reconciliation first. The textile stations are not active yet.','o pini e nanpa telo kule lon open. ma pali len li pali ala lon tenpo ni.');blockedTone();break;}
        if(campaignSolved('l10-textile-routing')){showMessage('The cloth batch is already correctly processed.');softTone();break;}
        state.l10TextilePlacements=state.l10TextilePlacements||{};const placed=state.l10TextilePlacements[obj.stationId];
        if(placed){
          if(state.carrying){showMessage('Your hands are full.');blockedTone();break;}
          state.carrying=`l10:textile:${placed}`;delete state.l10TextilePlacements[obj.stationId];state.l10TextileLocations[placed]='carrying';spriteCache.clear();
          showMessage(`You take the placed ${l10ParcelWord(placed)} cloth batch.`);pickupTone();break;
        }
        if(!String(state.carrying||'').startsWith('l10:textile:')){showMessage('This textile station is empty.');softTone();break;}
        const textileId=String(state.carrying).slice('l10:textile:'.length);state.l10TextilePlacements[obj.stationId]=textileId;state.l10TextileLocations[textileId]=obj.stationId;state.carrying=null;spriteCache.clear();
        showMessage(`${l10ParcelWord(textileId)} cloth placed at ${obj.stationId}.`);stepTone();
        if(!l10MaybeCompleteTextile())log(`Textile placement: ${l10ParcelWord(textileId)} → ${obj.stationId}.`);
        break;
      }
      case 'l10QuarantineStatus': showMessage('Quarantine status: the suwi shipment record is classified unsafe after a +8.5 cold-history excursion.');softTone();break;
      case 'l10ExitTerminal': showMessage('The final dispatch shutter is open. Level 10 is complete.');successTone();break;
      case 'l11CallPylon': {
        state.l11CallMarkers=state.l11CallMarkers||{};
        if(state.l11CallMarkers[obj.pylonId]){const calls=l11CallProgress();showMessage(`Call pylon ${obj.pylonId} is already recorded (${calls.found}/${calls.needed}).`);softTone();break;}
        state.l11CallMarkers[obj.pylonId]=true;
        spriteCache.clear();
        const calls=l11CallProgress();
        if(calls.found>=calls.needed&&!campaignSolved('l11-call-survey')){
          const result=completeCampaignPuzzle('l11-call-survey','Recorded all three Level 11 acoustic pylons.');
          if(result.ok){showMessage('Acoustic survey complete: 3/3. Use the triangulation console in the Habitat Hub.');log('Level 11 acoustic survey complete: 3/3 call pylons recorded.');}
        }else{showMessage(`Call pylon ${obj.pylonId} recorded (${calls.found}/${calls.needed}).`);log(`Level 11 call pylon ${obj.pylonId} recorded (${calls.found}/${calls.needed}).`);pickupTone();}
        break;
      }
      case 'l11GroundToCanopy': transitionLevel('l11canopy',2.8,10.0,0,'You climb the marked ladder into the Aviary Walk.');break;
      case 'l11CanopyToGround': transitionLevel('l11ground',18.5,11.2,Math.PI,'You descend to the Habitat Hub.');break;
      case 'l11CanopyToLower': transitionLevel('l11lower',2.8,10.0,0,'You descend through the open incubator hatch.');break;
      case 'l11LowerToCanopy': transitionLevel('l11canopy',8.8,9.8,Math.PI,'You climb back to the Aviary Walk.');break;
      case 'l11CanopyToRecovery': transitionLevel('l11ground',23.6,10.4,0,'You descend the new shortcut into the isolated Recovery Ward.');break;
      case 'l11RecoveryToCanopy': transitionLevel('l11canopy',22.0,10.2,Math.PI,'You climb back to the Nest Observatory.');break;
      case 'l11BandParcel': {
        if(campaignSolved('l11-parent-bands')){showMessage('The parent-band placement is already complete.');softTone();break;}
        if(state.carrying){showMessage('You can carry only one object at a time.');blockedTone();break;}
        state.carrying=`l11:band:${obj.bandId}`;state.l11BandLocations[obj.bandId]='carrying';spriteCache.clear();
        showMessage(`You take the ${obj.bandLabel||l11BandWord(obj.bandId)} parent band.`);pickupTone();break;
      }
      case 'l11BandPerch': {
        if(campaignSolved('l11-parent-bands')){showMessage('The parent bands are already aligned.');softTone();break;}
        state.l11BandPlacements=state.l11BandPlacements||{};
        const placed=state.l11BandPlacements[obj.perchId],side=obj.perchId==='west-perch'?'west':'east';
        if(placed){
          if(state.carrying){showMessage('Your hands are full.');blockedTone();break;}
          state.carrying=`l11:band:${placed}`;delete state.l11BandPlacements[obj.perchId];state.l11BandLocations[placed]='carrying';spriteCache.clear();
          showMessage(`You take the placed ${l11BandWord(placed)} band from the ${side} perch.`);pickupTone();break;
        }
        if(!String(state.carrying||'').startsWith('l11:band:')){showMessage(`The ${side} perch is empty.`);softTone();break;}
        const bandId=String(state.carrying).slice('l11:band:'.length);
        state.l11BandPlacements[obj.perchId]=bandId;state.l11BandLocations[bandId]=obj.perchId;state.carrying=null;spriteCache.clear();
        showMessage(`${l11BandWord(bandId)} band placed on the ${side} perch.`);stepTone();
        if(!l11MaybeCompleteBands())log(`Parent-band placement: ${l11BandWord(bandId)} → ${side} perch.`);
        break;
      }
      case 'l11ExitTerminal': showMessage('The sanctuary systems are stable. Level 11 is complete.');successTone();break;
      case 'l12GroundToUpper': transitionLevel('l12upper',2.8,10.0,0,'You climb into the Identity Gallery.');break;
      case 'l12UpperToGround': transitionLevel('l12ground',15.0,9.8,Math.PI,'You descend to the Fracture Core.');break;
      case 'l12GroundToLower': transitionLevel('l12lower',2.8,10.0,0,'You descend into the Totality Cipher Vault.');break;
      case 'l12LowerToGround': transitionLevel('l12ground',21.0,9.8,Math.PI,'You climb back to the Fracture Core.');break;
      case 'l12LowerToFinal': transitionLevel('l12final',3.0,10.0,0,'You descend through the FINAL hatch into the last Sudoku chamber.');break;
      case 'l12FinalToLower': transitionLevel('l12lower',9.0,9.8,Math.PI,'You climb back to the Totality Cipher Vault.');break;
      case 'l12ExitTerminal': showMessage('The final archive is stable. All 120 glyphs are recovered.');successTone();break;
    }
    saveState(); updateHUD();
  }

  function collectGlyph(word, source, options = {}) {
    if (!WORD_TO_CP[word]) return false;
    if (collected(word)) { showMessage(`${word} is already in your collection.`); return false; }
    state.collected[word] = true;
    spriteCache.clear();
    const count = collectionCount();
    log(`Recovered glyph: ${word} (${count}/120).`);
    saveState();
    renderCollection();
    glyphPopupGlyph.textContent = glyphChar(word);
    glyphPopupTitle.textContent = word;
    glyphPopupTitle.classList.toggle('tpTerm', isTpLanguage());
    renderExact(glyphPopupSource, source || 'Glyph recovered.');
    renderLocalized(glyphPopupCount, progressSummaryText(currentLevelProgress()));
    openModal(glyphPopup);
    pickupTone();
    if (!options.suppressCloseFocus) glyphPopupClose.focus({ preventScroll: true });
    updateHUD();
    return true;
  }

  function openSentencePanel(panelId) {
    const panel = PANELS[panelId];
    if (!panel) return;
    activePanelId = panelId;
    renderLocalized(sentenceTitle, isTpLanguage()
      ? (panelId === 'entrySentence' ? 'sitelen open' : 'sitelen tomo sewi')
      : panel.title);
    renderSentencePanel();
    openModal(sentenceOverlay);
    sentenceCloseBtn.focus({ preventScroll: true });
  }

  function renderSentencePanel() {
    const panel = PANELS[activePanelId];
    if (!panel) return;
    sentenceSlots.textContent = '';
    const missing = panel.words.filter(w => !collected(w));
    for (const word of panel.words) {
      const slot = document.createElement('div');
      const has = collected(word);
      slot.className = `sentenceSlot${has ? '' : ' missing'}`;
      const glyph = document.createElement('div');
      glyph.className = has ? 'sentenceSlotGlyph sitelenGlyph' : 'sentenceSlotGlyph';
      glyph.textContent = has ? glyphChar(word) : '?';
      const label = document.createElement('div');
      label.className = 'sentenceSlotWord'; label.textContent = word;
      slot.append(glyph, label); sentenceSlots.appendChild(slot);
    }

    if (state.completedPanels[activePanelId] || missing.length === 0) {
      renderLocalized(sentenceStatus, isTpLanguage() ? `pini: [[${panel.completionText}]]` : `Complete: ${panel.completionText}`);
      sentenceCompleteBtn.disabled = true;
      renderLocalized(sentenceCompleteBtn, isTpLanguage() ? 'toki li pini' : 'Sentence complete');
    } else if (missing.length === 1 && missing[0] === panel.reward) {
      renderLocalized(sentenceStatus, isTpLanguage()
        ? 'sitelen wan taso li kama ala. sitelen lon kulupu sina li ken pini e toki ni.'
        : 'Only one glyph is missing. Your collection is sufficient to reconstruct the sentence.');
      sentenceCompleteBtn.disabled = false;
      renderLocalized(sentenceCompleteBtn, uiText('completeSentence'));
    } else {
      renderLocalized(sentenceStatus, isTpLanguage()
        ? `sitelen ${missing.length} li kama ala. o alasa e sitelen ante, li kama sin tawa sitelen toki ni.`
        : `${missing.length} glyphs are still missing. Recover more glyphs and return to this inscription.`);
      sentenceCompleteBtn.disabled = true;
      renderLocalized(sentenceCompleteBtn, isTpLanguage() ? 'sitelen ante li wile' : 'More glyphs required');
    }
  }

  function completeActiveSentence() {
    const panel = PANELS[activePanelId];
    if (!panel || state.completedPanels[activePanelId]) return;
    const missing = panel.words.filter(w => !collected(w));
    if (missing.length !== 1 || missing[0] !== panel.reward) { renderSentencePanel(); blockedTone(); return; }
    state.completedPanels[activePanelId] = true;
    saveState();
    closeModal(sentenceOverlay);
    collectGlyph(panel.reward, `Deduced from the completed sentence: ${panel.completionText}`);
    log(`Completed inscription: ${panel.completionText}`);
  }

  function puzzleSequence(puzzle) {
    return Array.isArray(puzzle?.inputSequence) ? puzzle.inputSequence.slice() : [];
  }

  function puzzleRewardGlyphs(puzzle) {
    return (puzzle?.rewards?.glyphs || []).slice();
  }

  const TOKI_PONA_LETTERS = ['A','E','I','J','K','L','M','N','O','P','S','T','U','W'];
  const PUZZLE_PUNCTUATION = [':','·',',','[',']'];

  function puzzleOwnedCandidates() {
    const rt = campaignRuntime();
    const words = rt ? [...rt.globalGlyphs] : STANDARD_120.filter(collected);
    return words.filter(word => WORD_TO_CP[word] != null).sort((a,b) => a.localeCompare(b));
  }

  function puzzleFamilyMap() {
    const map = new Map();
    for (const letter of TOKI_PONA_LETTERS) map.set(letter, []);
    for (const word of puzzleOwnedCandidates()) {
      const letter = String(word)[0]?.toUpperCase();
      if (map.has(letter)) map.get(letter).push(word);
    }
    return map;
  }

  function displayPuzzleToken(token) {
    if (WORD_TO_CP[token] != null) return glyphChar(token);
    return token === '·' ? '·' : String(token || '');
  }

  const NUMERIC_PREVIEW_HALF_SCALE_HEADS = new Set(['nanpa','nasa','noka','tenpo','suno','toki','ma','lon']);
  const NUMERIC_PREVIEW_HALF_SCALE_CLOSERS = new Set(['nanpa','nasa','noka']);
  const NUMERIC_PREVIEW_FIXED_SCALE = new Map([
    ['ala','1/4'], ['ike','1/4'], ['uta','1/4'], ['open','1/4'],
    ['kasi','1/3'], ['kule','1/3'], ['kiwen','1/3'],
    ['kala','1/2'],
    ['ona','2/3'], ['o','2/3'], ['kulupu','2/3'], ['kipisi','2/3'], ['kin','2/3']
  ]);
  let puzzleLiveCartoucheRenderSerial = 0;

  function isNumericCartoucheConstructionPuzzle(puzzle) {
    const seq = puzzleSequence(puzzle);
    const groups = puzzle?.ui?.payload?.answerGroups;
    if (Array.isArray(groups) && groups.length) return false;
    return puzzle?.type === 'glyph-key-code' && seq.length >= 3 &&
      NUMERIC_PREVIEW_HALF_SCALE_HEADS.has(seq[0]) &&
      NUMERIC_PREVIEW_HALF_SCALE_CLOSERS.has(seq[seq.length - 1]);
  }

  function numericPreviewScaleForSlot(token, index, seq) {
    const word = String(token || '');
    if (!word) return '';
    if (index === 0 && NUMERIC_PREVIEW_HALF_SCALE_HEADS.has(word)) return '1/2';
    if (index === 1 && word === ':' && NUMERIC_PREVIEW_HALF_SCALE_HEADS.has(seq[0])) return '1/2';
    if (index === seq.length - 1 && NUMERIC_PREVIEW_HALF_SCALE_CLOSERS.has(word)) return '1/2';
    const positiveIndex = seq[1] === ':' ? 2 : 1;
    if (index === positiveIndex && word === 'en' && NUMERIC_PREVIEW_HALF_SCALE_HEADS.has(seq[0])) return '2/3';
    if (WORD_TO_CP[word] != null && /^[en]/i.test(word)) return '1/4';
    return NUMERIC_PREVIEW_FIXED_SCALE.get(word) || '';
  }

  function currentNumericCartouchePreviewSource(puzzle) {
    const seq = puzzleSequence(puzzle);
    if (!isNumericCartoucheConstructionPuzzle(puzzle)) return '';
    const pieces = [];
    for (let index = 0; index < seq.length; index++) {
      const token = puzzleSlotValues[index];
      if (!token) continue;
      const scale = numericPreviewScaleForSlot(token, index, seq);
      pieces.push(`${token}${scale}`);
    }
    return `[${pieces.join(' ')}]`;
  }

  function hidePuzzleLiveCartouchePreview() {
    puzzleLiveCartoucheRenderSerial += 1;
    if (puzzleLiveCartoucheWrap) puzzleLiveCartoucheWrap.hidden = true;
    if (puzzleLiveCartoucheSource) puzzleLiveCartoucheSource.textContent = '—';
    if (puzzleLiveCartoucheCanvas) {
      const c = puzzleLiveCartoucheCanvas.getContext('2d', { alpha:true });
      c?.clearRect(0, 0, puzzleLiveCartoucheCanvas.width, puzzleLiveCartoucheCanvas.height);
    }
  }

  async function renderPuzzleLiveCartouchePreview(puzzle) {
    if (!puzzleLiveCartoucheWrap || !puzzleLiveCartoucheCanvas || !puzzleLiveCartoucheSource || !isNumericCartoucheConstructionPuzzle(puzzle)) {
      hidePuzzleLiveCartouchePreview();
      return;
    }
    const source = currentNumericCartouchePreviewSource(puzzle);
    const hasGlyphs = puzzleSlotValues.some(Boolean);
    const serial = ++puzzleLiveCartoucheRenderSerial;
    puzzleLiveCartoucheWrap.hidden = false;
    puzzleLiveCartoucheSource.textContent = source || '—';
    const ctxOut = puzzleLiveCartoucheCanvas.getContext('2d', { alpha:true });
    ctxOut.clearRect(0, 0, puzzleLiveCartoucheCanvas.width, puzzleLiveCartoucheCanvas.height);
    if (!hasGlyphs) {
      ctxOut.fillStyle = 'rgba(17,17,17,.52)';
      ctxOut.font = '15px system-ui, sans-serif';
      ctxOut.textAlign = 'center';
      ctxOut.textBaseline = 'middle';
      ctxOut.fillText('—', puzzleLiveCartoucheCanvas.width / 2, puzzleLiveCartoucheCanvas.height / 2);
      return;
    }
    try {
      const renderer = await ensureLevelRenderer();
      const rendered = await renderer.renderTextToNewCanvas({
        input:source,
        layout:{fontPx:48,align:'center',spacingPreset:'compact',paddingPx:6},
        parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true,cartoucheVulgarFractions:true}
      });
      if (serial !== puzzleLiveCartoucheRenderSerial) return;
      const src = rendered?.canvas;
      if (!src) throw new Error('no canvas');
      const scale = Math.min((puzzleLiveCartoucheCanvas.width - 12) / src.width, (puzzleLiveCartoucheCanvas.height - 12) / src.height, 1.8);
      const dw = src.width * scale, dh = src.height * scale;
      ctxOut.clearRect(0, 0, puzzleLiveCartoucheCanvas.width, puzzleLiveCartoucheCanvas.height);
      ctxOut.drawImage(src, (puzzleLiveCartoucheCanvas.width - dw) / 2, (puzzleLiveCartoucheCanvas.height - dh) / 2, dw, dh);
    } catch (err) {
      if (serial !== puzzleLiveCartoucheRenderSerial) return;
      ctxOut.clearRect(0, 0, puzzleLiveCartoucheCanvas.width, puzzleLiveCartoucheCanvas.height);
      ctxOut.fillStyle = '#111';
      ctxOut.font = '18px system-ui, sans-serif';
      ctxOut.textAlign = 'center';
      ctxOut.textBaseline = 'middle';
      ctxOut.fillText(source, puzzleLiveCartoucheCanvas.width / 2, puzzleLiveCartoucheCanvas.height / 2);
      console.warn('[game] live cartouche renderer unavailable', err);
    }
  }

  function nextEmptyPuzzleSlotIndex(afterIndex = -1) {
    const count = puzzleSlotValues.length;
    if (!count) return null;
    for (let offset = 1; offset <= count; offset++) {
      const index = (Number(afterIndex) + offset + count) % count;
      if (!puzzleSlotValues[index]) return index;
    }
    return null;
  }

  function placeSelectedPuzzleGlyphIntoSlot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= puzzleSlotValues.length || !selectedPuzzleGlyph) return false;
    clearTutorialSubmissionFeedback();
    puzzleSlotValues[index] = selectedPuzzleGlyph;
    selectedPuzzleGlyph = null;
    selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(index);
    return true;
  }

  function activatePuzzleSlot(index) {
    if (!Number.isInteger(index) || index < 0 || index >= puzzleSlotValues.length) return;
    selectedPuzzleSlotIndex = index;
    if (selectedPuzzleGlyph) placeSelectedPuzzleGlyphIntoSlot(index);
    renderCampaignPuzzle();
  }

  function choosePuzzleGlyph(token) {
    if (!token) return;
    if (Number.isInteger(selectedPuzzleSlotIndex) && selectedPuzzleSlotIndex >= 0 && selectedPuzzleSlotIndex < puzzleSlotValues.length) {
      selectedPuzzleGlyph = token;
      placeSelectedPuzzleGlyphIntoSlot(selectedPuzzleSlotIndex);
    } else {
      selectedPuzzleGlyph = token;
    }
    renderCampaignPuzzle();
  }

  function appendPuzzleFamilyButtons(container, families, { insideDrawer = false } = {}) {
    const chooseFamily = family => {
      selectedPuzzleFamily = insideDrawer ? family : (selectedPuzzleFamily === family ? null : family);
      selectedPuzzleGlyph = null;
      renderCampaignPuzzle();
    };

    for (const letter of TOKI_PONA_LETTERS) {
      const words = families.get(letter) || [];
      if (!words.length) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `puzzleFamilyKey${insideDrawer ? ' puzzleGlyphDrawerFamilyKey' : ''}${selectedPuzzleFamily === letter ? ' isSelected' : ''}`;
      btn.textContent = letter;
      btn.setAttribute('aria-label', `${letter} glyph family, ${words.length} available`);
      btn.setAttribute('aria-pressed', String(selectedPuzzleFamily === letter));
      btn.addEventListener('click', () => chooseFamily(letter));
      container.appendChild(btn);
    }

    const punctuation = document.createElement('button');
    punctuation.type = 'button';
    punctuation.className = `puzzleFamilyKey punctuation${insideDrawer ? ' puzzleGlyphDrawerFamilyKey' : ''}${selectedPuzzleFamily === 'PUNCT' ? ' isSelected' : ''}`;
    punctuation.textContent = '·';
    punctuation.title = 'Punctuation / structural symbols';
    punctuation.setAttribute('aria-label','Punctuation and structural symbols');
    punctuation.setAttribute('aria-pressed', String(selectedPuzzleFamily === 'PUNCT'));
    punctuation.addEventListener('click', () => chooseFamily('PUNCT'));
    container.appendChild(punctuation);
  }

  function renderGlyphFamilyPicker() {
    puzzleTray.textContent = '';
    const families = puzzleFamilyMap();
    const familyRow = document.createElement('div');
    familyRow.className = 'puzzleFamilyRow';
    appendPuzzleFamilyButtons(familyRow, families);
    if (selectedPuzzleFamily) familyRow.setAttribute('aria-hidden','true');
    puzzleTray.appendChild(familyRow);

    if (!selectedPuzzleFamily) return;

    const drawer = document.createElement('div');
    drawer.className = 'puzzleGlyphDrawer';
    drawer.setAttribute('role', 'group');
    drawer.setAttribute('aria-label', selectedPuzzleFamily === 'PUNCT' ? 'Punctuation glyphs' : `${selectedPuzzleFamily} glyphs`);

    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'puzzleGlyphDrawerHeader';
    const drawerTitle = document.createElement('strong');
    drawerTitle.className = 'puzzleGlyphDrawerTitle';
    renderLocalized(drawerTitle, selectedPuzzleFamily === 'PUNCT' ? (isTpLanguage()?'sitelen toki':'Punctuation') : selectedPuzzleFamily, {sitelen:selectedPuzzleFamily === 'PUNCT'});
    const drawerClose = document.createElement('button');
    drawerClose.type = 'button';
    drawerClose.className = 'puzzleGlyphDrawerClose';
    drawerClose.textContent = '×';
    drawerClose.setAttribute('aria-label', 'Close glyph drawer');
    drawerClose.addEventListener('click', () => {
      selectedPuzzleFamily = null;
      selectedPuzzleGlyph = null;
      renderCampaignPuzzle();
    });
    drawerHeader.append(drawerTitle, drawerClose);
    drawer.appendChild(drawerHeader);

    // Keep every available letter family inside the open drawer.  This lets the
    // player jump directly A → K → N etc. without closing and reopening the picker.
    const drawerFamilies = document.createElement('div');
    drawerFamilies.className = 'puzzleGlyphDrawerFamilies';
    drawerFamilies.setAttribute('aria-label','Glyph letter families');
    appendPuzzleFamilyButtons(drawerFamilies, families, { insideDrawer:true });
    drawer.appendChild(drawerFamilies);

    const drawerKeys = document.createElement('div');
    drawerKeys.className = 'puzzleGlyphDrawerKeys';
    const tokens = selectedPuzzleFamily === 'PUNCT' ? PUZZLE_PUNCTUATION : (families.get(selectedPuzzleFamily) || []);
    for (const token of tokens) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = `puzzleKey${selectedPuzzleGlyph === token ? ' isSelected' : ''}`;
      key.dataset.word = token;
      key.textContent = displayPuzzleToken(token);
      key.title = token;
      key.setAttribute('aria-label', selectedPuzzleFamily === 'PUNCT' ? `Punctuation ${token}` : `Glyph key ${token}`);
      // One physical tap/click must produce exactly one placement. Touch browsers
      // synthesize a click after pointerup, so direct insertion is handled only by
      // click; pointer events are reserved for the optional fine-pointer drag path.
      key.addEventListener('click', () => choosePuzzleGlyph(token));
      key.addEventListener('pointerdown', beginPuzzleGlyphDrag, { passive:false });
      drawerKeys.appendChild(key);
    }
    drawer.appendChild(drawerKeys);
    puzzleTray.appendChild(drawer);
  }

  const MECHANISM_PUZZLE_TYPES = new Set(['dial-bank','route-board','path-grid','lights-out','balance-scale','context-match','jug-transfer','hanoi-stack','codebreaker','equivalence-grid','schedule-order','river-crossing','sokoban','sliding-grid','peg-solitaire','pattern-sequence','nonogram','card-sort','calculator-sequence','base-match','ring-lock','tone-sequence','airflow-network','pulse-sync','spectrum-order','power-balance','deduction-order','dual-mirror','truth-gates','dependency-order','exact-path','sphinx-riddles','coupled-switches','layer-alignment','market-till','cold-chain','textile-mixer','record-classification','call-triangulation','lineage-match','habitat-triage','sudoku']);
  const DIGIT_GLYPH_WORDS = ['ijo','wan','tu','seli','awen','luka','utala','mun','pipi','jo'];

  function isMechanismPuzzle(puzzle) {
    return Boolean(puzzle && MECHANISM_PUZZLE_TYPES.has(puzzle.type));
  }

  function sudokuDigitGlyph(value) {
    const n = Number(value);
    const word = Number.isInteger(n) && n >= 0 && n <= 9 ? DIGIT_GLYPH_WORDS[n] : null;
    return word ? glyphChar(word) : String(value);
  }


  function bareNanpaDigitsText(value) {
    return [...String(value ?? '')].map(ch => /[0-9]/.test(ch) ? glyphChar(DIGIT_GLYPH_WORDS[Number(ch)]) : ch).join('');
  }

  function renderBareNanpaDigits(el, value, options = {}) {
    if (!el) return el;
    el.classList.add('bareNanpaDigits');
    if (options.className) el.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
    el.textContent = bareNanpaDigitsText(value);
    el.setAttribute('aria-label', String(value ?? ''));
    el.title = String(value ?? '');
    return el;
  }

  function renderMechanismNumber(el, value, options = {}) {
    if (!el) return el;
    // Every non-Sudoku mechanism number is a renderer-backed nanpa-linja-n
    // cartouche in Toki Pona mode. Mark the host so CSS can fit the rendered
    // canvas to the control instead of allowing its intrinsic canvas width to
    // overflow buttons, tiles, lamps, discs, clue cells, etc.
    el.classList.add('mechanismNumberHost');
    if (options.className) el.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
    renderLocalized(el, String(value ?? ''), { sitelen:isTpLanguage() });
    return el;
  }

  function renderAlwaysNanpaMechanismNumber(el, value, options = {}) {
    if (!el) return el;
    el.classList.add('mechanismNumberHost');
    if (options.className) el.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
    const raw=String(value ?? '').trim();
    const numeric=document.createElement('span');
    numeric.className='tpNumeric';
    numeric.setAttribute('data-nanpa-source',explicitNanpaSource(raw));
    numeric.setAttribute('data-latin',raw);
    numeric.setAttribute('aria-label',raw);
    numeric.setAttribute('title',raw);
    el.replaceChildren(numeric);
    hydrateInlineNumericCartouches(numeric);
    return el;
  }

  function mechanismNumberNode(value, className = '') {
    const el = document.createElement('span');
    return renderMechanismNumber(el, value, { className });
  }

  function explicitNanpaSource(source) {
    const raw = String(source ?? '').trim();
    return I18N?.numericCartoucheSource?.(raw) || raw;
  }


  async function hydrateInlineNumericCartouches(root) {
    if (!root) return;
    const nodes=[];
    if (root.matches?.('.tpNumeric[data-nanpa-source]')) nodes.push(root);
    root.querySelectorAll?.('.tpNumeric[data-nanpa-source]').forEach(node=>nodes.push(node));
    for (const node of nodes) {
      if (node.dataset?.nanpaHydrating === '1' || node.dataset?.nanpaHydrated === '1') continue;
      const source=node.getAttribute?.('data-nanpa-source') || node.dataset?.nanpaSource || '';
      if (!source) continue;
      if (node.dataset) node.dataset.nanpaHydrating='1';
      try {
        const renderer=await ensureLevelRenderer();
        const rendered=await renderer.renderTextToNewCanvas({
          input:source,
          layout:{fontPx:48,align:'center',spacingPreset:'compact',paddingPx:4},
          parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true}
        });
        const src=rendered?.canvas;
        if(!src) throw new Error('no inline numeric canvas');
        const canvas=document.createElement('canvas');
        canvas.className='tpNumericCanvas';
        canvas.width=Math.max(1,src.width); canvas.height=Math.max(1,src.height);
        canvas.setAttribute('aria-hidden','true');
        const c=canvas.getContext('2d',{alpha:true});
        c.clearRect(0,0,canvas.width,canvas.height); c.drawImage(src,0,0);
        node.replaceChildren(canvas);
        node.classList.remove('tpNumeric--fallback');
        if (node.dataset) { node.dataset.nanpaHydrated='1'; delete node.dataset.nanpaHydrating; }
      } catch (err) {
        // Never expose parser/source syntax to the player. Latin is the safe fallback.
        const latin=node.getAttribute?.('data-latin') || node.dataset?.latin || '';
        node.textContent=latin;
        node.classList.add('tpNumeric--fallback');
        if (node.dataset) delete node.dataset.nanpaHydrating;
        console.warn('[game] inline numeric cartouche renderer unavailable',err);
      }
    }
  }

  function randomIndex(maxExclusive) {
    const max = Math.max(0, Math.floor(Number(maxExclusive) || 0));
    if (max <= 1) return 0;
    try {
      if (window.crypto?.getRandomValues) {
        const limit = Math.floor(0x100000000 / max) * max;
        const buf = new Uint32Array(1);
        do { window.crypto.getRandomValues(buf); } while (buf[0] >= limit);
        return buf[0] % max;
      }
    } catch (_) {}
    return Math.floor(Math.random() * max);
  }

  function shuffledCopy(values) {
    const out = Array.from(values || []);
    for (let i = out.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function codebreakerGlyphPool() {
    const campaign = campaignAdapter?.runtime?.campaign;
    const current = campaignAdapter?.currentLevel?.();
    if (!campaign || !current) return STANDARD_120.filter(word => collected(word));
    const seen = new Set();
    const out = [];
    for (const levelDef of campaign.levels || []) {
      if (Number(levelDef.ordinal) >= Number(current.ordinal)) continue;
      for (const word of levelDef.canonicalGlyphs || []) {
        if (!STANDARD_120.includes(word) || seen.has(word)) continue;
        seen.add(word); out.push(word);
      }
    }
    return out;
  }

  function getCodebreakerVariant(puzzle) {
    if (!state.puzzleVariants || typeof state.puzzleVariants !== 'object') state.puzzleVariants = {};
    const requested = Math.max(2, Math.floor(Number(puzzle?.ui?.payload?.symbolCount) || 4));
    const saved = state.puzzleVariants[puzzle.id];
    const validSaved = saved && Array.isArray(saved.words) && Array.isArray(saved.secret) &&
      saved.words.length === requested && saved.secret.length === requested &&
      new Set(saved.words).size === requested && new Set(saved.secret.map(Number)).size === requested &&
      saved.words.every(word => Number.isFinite(WORD_TO_CP[word])) &&
      saved.secret.every(index => Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < requested);
    if (validSaved) return { words:Array.from(saved.words), secret:saved.secret.map(Number) };

    let pool = codebreakerGlyphPool();
    if (pool.length < requested) pool = STANDARD_120.filter(word => collected(word));
    if (pool.length < requested) pool = STANDARD_120.slice();
    const words = shuffledCopy(pool).slice(0, requested);
    const secret = shuffledCopy(Array.from({length:requested}, (_, index) => index));
    const variant = { words, secret };
    state.puzzleVariants[puzzle.id] = variant;
    saveState();
    return { words:Array.from(words), secret:Array.from(secret) };
  }

  function getSphinxVariant(puzzle) {
    if (!state.puzzleVariants || typeof state.puzzleVariants !== 'object') state.puzzleVariants = {};
    const payload = puzzle?.ui?.payload || {};
    const riddles = Array.isArray(payload.riddles) ? payload.riddles : [];
    const requested = Math.max(1, Math.min(riddles.length, Math.floor(Number(payload.selectCount) || riddles.length || 1)));
    const saved = state.puzzleVariants[puzzle.id];
    const validSaved = saved && Array.isArray(saved.riddleOrder) && Array.isArray(saved.choiceOrders) &&
      saved.riddleOrder.length === requested && saved.choiceOrders.length === requested &&
      new Set(saved.riddleOrder.map(Number)).size === requested &&
      saved.riddleOrder.every(index => Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < riddles.length) &&
      saved.choiceOrders.every((choices, stage) => {
        const riddle = riddles[Number(saved.riddleOrder[stage])];
        return Array.isArray(choices) && choices.length === (riddle?.choices || []).length &&
          new Set(choices).size === choices.length &&
          choices.every(word => (riddle?.choices || []).includes(word));
      });
    if (validSaved) return {
      riddleOrder:saved.riddleOrder.map(Number),
      choiceOrders:saved.choiceOrders.map(choices => Array.from(choices))
    };

    const byBand = new Map();
    riddles.forEach((riddle,index) => {
      const band = String(riddle?.band || '');
      if (!band) return;
      if (!byBand.has(band)) byBand.set(band, []);
      byBand.get(band).push(index);
    });
    let chosen = [];
    if (byBand.size && byBand.size <= requested) {
      for (const indices of byBand.values()) chosen.push(shuffledCopy(indices)[0]);
    }
    const chosenSet = new Set(chosen);
    const remaining = shuffledCopy(riddles.map((_,index)=>index).filter(index => !chosenSet.has(index)));
    while (chosen.length < requested && remaining.length) chosen.push(remaining.shift());
    chosen = shuffledCopy(chosen).slice(0, requested);
    const choiceOrders = chosen.map(index => shuffledCopy(riddles[index]?.choices || []));
    const variant = { riddleOrder:chosen, choiceOrders };
    state.puzzleVariants[puzzle.id] = variant;
    saveState();
    return { riddleOrder:Array.from(chosen), choiceOrders:choiceOrders.map(choices => Array.from(choices)) };
  }

  function dualMirrorRandomInitialOrientations(puzzle) {
    const payload = puzzle?.ui?.payload || {};
    const mirrors = payload.mirrors || [];
    const authored = Array.from(payload.initialOrientations || mirrors.map(()=>0)).map(v=>Number(v)?1:0);
    const target = Array.from(payload.targetOrientations || authored).map(v=>Number(v)?1:0);
    if (!mirrors.length) return authored;

    // Keep the first mirror encountered by each beam in its authored orientation so
    // the entry geometry remains recognizable. Every later mirror on the authored
    // solution paths is randomized once per campaign, preventing the old visual
    // pattern where the player could simply flip every mirror.
    state.puzzleVariants = state.puzzleVariants || {};
    const saved = state.puzzleVariants[puzzle.id]?.mirrorInitialOrientations;
    if (Array.isArray(saved) && saved.length === mirrors.length && saved.every(v=>Number(v)===0||Number(v)===1)) {
      return saved.map(v=>Number(v)?1:0);
    }

    const firstMirrorIndexes = new Set();
    const targetState = { orientations:target };
    for (let sourceIndex=0; sourceIndex<(payload.sources||[]).length; sourceIndex++) {
      const trace = dualMirrorTrace(puzzle,targetState,sourceIndex);
      if (trace.hitMirrors?.length) firstMirrorIndexes.add(Number(trace.hitMirrors[0]));
    }

    const randomized = authored.map((value,index)=>firstMirrorIndexes.has(index)?value:(Math.random()<0.5?0:1));
    const randomizableIndexes = mirrors.map((_,index)=>index).filter(index=>!firstMirrorIndexes.has(index));
    // Do not allow the random draw to recreate the old "flip every mirror"
    // starting pattern by chance. At least one later mirror must differ from the
    // authored all-opposite start while the first mirror of each beam stays fixed.
    if (randomizableIndexes.length && randomizableIndexes.every(index=>randomized[index]===authored[index])) {
      const index = randomizableIndexes[Math.floor(Math.random()*randomizableIndexes.length)];
      randomized[index] = authored[index] ? 0 : 1;
    }
    const previous = state.puzzleVariants[puzzle.id] || {};
    state.puzzleVariants[puzzle.id] = {
      ...previous,
      mirrorInitialOrientations:Array.from(randomized),
      mirrorFixedFirstIndexes:Array.from(firstMirrorIndexes).sort((a,b)=>a-b)
    };
    saveState();
    return randomized;
  }

  function freshMechanismState(puzzle) {
    const payload = puzzle?.ui?.payload || {};
    switch (puzzle?.type) {
      case 'dial-bank': return { values:(payload.startValues || [0,0,0]).map(v => Number(v) || 0) };
      case 'route-board': return { rotations:(payload.tiles || []).map(tile => Number(tile.rotation) || 0) };
      case 'path-grid': return { x:Number(payload.start?.[0]) || 0, y:Number(payload.start?.[1]) || 0, nextCheckpoint:0, finished:false };
      case 'lights-out': return { lights:(payload.initial || []).map(v => Number(v) ? 1 : 0) };
      case 'balance-scale': return { selected:(payload.weights || []).map(() => false) };
      case 'context-match': return { selectedIndex:null };
      case 'jug-transfer': return { amounts:(payload.capacities || [3,5]).map(() => 0) };
      case 'hanoi-stack': {
        const n=Math.max(1,Number(payload.discCount)||3), start=Math.max(0,Number(payload.startRod)||0);
        const rods=[[],[],[]]; rods[start]=Array.from({length:n},(_,i)=>n-i);
        return { rods, selectedRod:null, moves:0 };
      }
      case 'codebreaker': {
        const variant = getCodebreakerVariant(puzzle);
        return { guess:Array(variant.secret.length).fill(0), history:[], solved:false };
      }
      case 'equivalence-grid': return {
        decimalOrder:Array.from(payload.decimalOrder || (payload.decimals || []).map((_,i)=>i)),
        percentOrder:Array.from(payload.percentOrder || (payload.percents || []).map((_,i)=>i)),
        selected:null
      };
      case 'schedule-order': return { order:Array.from(payload.initialOrder || (payload.events || []).map((_,i)=>i)) };
      case 'river-crossing': return { playerSide:0, boatRow:0, itemSides:(payload.travellers || []).map(()=>0), itemRows:(payload.travellers || []).map((_,i)=>i+1), selectedItem:null, moves:0 };
      case 'sokoban': {
        const rows=payload.rows || []; let player=[0,0]; const crates=[];
        rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='@'||ch==='+')player=[x,y];if(ch==='$'||ch==='*')crates.push([x,y]);}));
        return {player,crates};
      }
      case 'sliding-grid': return { tiles:Array.from(payload.initial || []) };
      case 'peg-solitaire': return { pegs:Array.from(payload.initial || []).map(v=>Number(v)?1:0), selected:null, moves:0 };
      case 'nonogram': {
        const rows=Array.from(payload.target || []), width=rows[0]?.length || Number(payload.width) || 0;
        return { cells:Array(Math.max(0, rows.length * width)).fill(0) };
      }
      case 'card-sort': return { order:Array.from(payload.initialOrder || (payload.cards || []).map((_,i)=>i)), selected:null, swaps:0 };
      case 'calculator-sequence': return { stage:0, input:'', solved:false, message:'' };
      case 'base-match': return { stage:0, selectedIndex:null, solved:false, message:'', attempt:0, answers:[], rounds:baseMatchRoundsForAttempt(payload,0) };
      case 'ring-lock': return { positions:Array.from(payload.startPositions || (payload.markers || []).map(()=>0)).map(v=>Number(v)||0) };
      case 'tone-sequence': return { input:[], solved:false, playing:false, message:'' };
      case 'airflow-network': return { rotations:(payload.tiles || []).map(tile=>Number(tile.rotation)||0) };
      case 'pulse-sync': return { phases:Array.from(payload.startPhases || []).map(v=>Number(v)||0), moves:0 };
      case 'spectrum-order': return { order:Array.from(payload.initialOrder || (payload.filters || []).map(x=>x.id)), selected:null, swaps:0 };
      case 'power-balance': return { selected:(payload.loads || []).map(()=>false) };
      case 'deduction-order': return { order:Array.from(payload.initialOrder || payload.tokens || []), selected:null, swaps:0 };
      case 'dual-mirror': return { orientations:dualMirrorRandomInitialOrientations(puzzle) };
      case 'truth-gates': return { gates:Array.from(payload.initialGates || ['AND','AND','AND']) };
      case 'dependency-order': return { order:Array.from(payload.initialOrder || payload.tasks || []), selected:null, swaps:0 };
      case 'exact-path': return { path:[Array.from(payload.start || [0,0])], message:'' };
      case 'sphinx-riddles': {
        const variant=getSphinxVariant(puzzle);
        return { stage:0, mistakes:0, solved:false, message:'', riddleOrder:variant.riddleOrder, choiceOrders:variant.choiceOrders };
      }
      case 'coupled-switches': return { lamps:Array.from(payload.start || []).map(v=>Number(v)?1:0), moves:0 };
      case 'layer-alignment': return { rotations:(payload.layers || []).map(layer=>((Number(layer.startRotation)||0)%4+4)%4) };
      case 'market-till': return { selected:(payload.tokens||[]).map(()=>false) };
      case 'cold-chain': return { controls:Array.from(payload.start||[0,0,0]).map(v=>Math.max(0,Math.min(2,Number(v)||0))) };
      case 'textile-mixer': return { selectedIndex:null };
      case 'record-classification': return { assignments:{} };
      case 'call-triangulation': return { selected:null };
      case 'lineage-match': return { assignments:(payload.hatchlings||[]).map(()=>null) };
      case 'habitat-triage': return { akesi:null, moli:null };
      case 'sudoku': {
        const cells=Array.from(payload.puzzle||[]).slice(0,81).map(v=>Number(v)||0);
        while(cells.length<81)cells.push(0);
        return { cells, notes:Array.from({length:81},()=>[]), selected:null, noteMode:false };
      }
      case 'pattern-sequence': return { selectedIndex:null };
      default: return {};
    }
  }

  function resetMechanismState(puzzle) {
    clearTutorialSubmissionFeedback();
    puzzleMechanismState = freshMechanismState(puzzle);
  }

  function routeOpenings(type, rotation) {
    const r = ((Number(rotation) || 0) % 4 + 4) % 4;
    if (type === 'straight') return r % 2 === 0 ? new Set(['W','E']) : new Set(['N','S']);
    if (type === 'corner') return [new Set(['N','E']),new Set(['E','S']),new Set(['S','W']),new Set(['W','N'])][r];
    return new Set();
  }

  function routeTileSymbol(type, rotation) {
    const r = ((Number(rotation) || 0) % 4 + 4) % 4;
    if (type === 'straight') return r % 2 === 0 ? '━' : '┃';
    if (type === 'corner') return ['└','┌','┐','┘'][r];
    return '';
  }

  function routeConnectivity(puzzle, rotationsOverride=null) {
    const payload = puzzle.ui?.payload || {};
    const width = Number(payload.width) || 4, height = Number(payload.height) || 4;
    const tiles = payload.tiles || [];
    const state = puzzleMechanismState || freshMechanismState(puzzle);
    const byPos = new Map();
    tiles.forEach((tile,index) => byPos.set(`${tile.x},${tile.y}`, {tile,index,rotation:rotationsOverride?.[index] ?? state.rotations?.[index] ?? tile.rotation ?? 0}));
    const sourceRow = Number(payload.sourceRow) || 0;
    const start = byPos.get(`0,${sourceRow}`);
    const connected = new Set();
    if (!start || !routeOpenings(start.tile.type,start.rotation).has('W')) return {connected,solved:false};
    const q=[[0,sourceRow]]; connected.add(`0,${sourceRow}`);
    const dirs={N:[0,-1,'S'],E:[1,0,'W'],S:[0,1,'N'],W:[-1,0,'E']};
    for(let qi=0; qi<q.length; qi++) {
      const [x,y]=q[qi]; const here=byPos.get(`${x},${y}`); if(!here) continue;
      const openings=routeOpenings(here.tile.type,here.rotation);
      for(const d of openings) {
        const [dx,dy,back]=dirs[d]; const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=width||ny>=height) continue;
        const there=byPos.get(`${nx},${ny}`); if(!there) continue;
        if(!routeOpenings(there.tile.type,there.rotation).has(back)) continue;
        const key=`${nx},${ny}`; if(!connected.has(key)){connected.add(key);q.push([nx,ny]);}
      }
    }
    const sinkRow = Number(payload.sinkRow) || 0;
    const sink = byPos.get(`${width-1},${sinkRow}`);
    const solved = Boolean(sink && connected.has(`${width-1},${sinkRow}`) && routeOpenings(sink.tile.type,sink.rotation).has('E'));
    return {connected,solved};
  }

  function balanceSum(puzzle) {
    const weights = puzzle.ui?.payload?.weights || [];
    const selected = puzzleMechanismState?.selected || [];
    return weights.reduce((sum,w,i) => sum + (selected[i] ? Number(w) || 0 : 0), 0);
  }


  function riverCrossingUnsafeDetail(puzzle, state=puzzleMechanismState) {
    const payload=puzzle?.ui?.payload||{};
    const pairs=payload.forbiddenPairs||[];
    const travellers=payload.travellers||[];
    const labels=payload.dangerLabels||[];
    const sides=state?.itemSides||[];
    for(const bank of [0,1]) {
      if(Number(state?.playerSide)===bank) continue;
      for(let pairIndex=0; pairIndex<pairs.length; pairIndex++) {
        const pair=pairs[pairIndex]||[];
        const a=Number(pair[0]), b=Number(pair[1]);
        if(sides[a]===bank && sides[b]===bank) {
          const fallback=`${travellers[a]?.label||`passenger ${a+1}`} + ${travellers[b]?.label||`passenger ${b+1}`}`;
          return {bank,pairIndex,a,b,label:String(labels[pairIndex]||fallback)};
        }
      }
    }
    return null;
  }

  function riverCrossingUnsafe(puzzle, state=puzzleMechanismState) {
    return Boolean(riverCrossingUnsafeDetail(puzzle,state));
  }

  function sokobanModel(puzzle) {
    const rows=puzzle?.ui?.payload?.rows||[]; const walls=new Set(),goals=new Set();
    rows.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='#')walls.add(`${x},${y}`);if(ch==='.'||ch==='*'||ch==='+')goals.add(`${x},${y}`);}));
    return {rows,walls,goals,width:rows[0]?.length||0,height:rows.length};
  }

  function slidingSolved(puzzle) {
    return JSON.stringify(puzzleMechanismState?.tiles||[])===JSON.stringify(puzzle?.ui?.payload?.target||[]);
  }

  function pegMoves(pegs) {
    const out=[]; const a=Array.from(pegs||[]).map(v=>Number(v)?1:0);
    for(let from=0;from<a.length;from++) if(a[from]) for(const d of [-1,1]) {
      const mid=from+d,to=from+2*d;
      if(to>=0&&to<a.length&&a[mid]&&!a[to]) out.push({from,mid,to});
    }
    return out;
  }


  function airflowOpenings(type,rotation){
    const r=((Number(rotation)||0)%4+4)%4;
    if(type==='straight')return r%2===0?new Set(['W','E']):new Set(['N','S']);
    if(type==='corner')return [new Set(['N','E']),new Set(['E','S']),new Set(['S','W']),new Set(['W','N'])][r];
    if(type==='tee')return [new Set(['N','E','W']),new Set(['N','E','S']),new Set(['E','S','W']),new Set(['N','S','W'])][r];
    return new Set();
  }

  function airflowTileSymbol(type,rotation){
    const r=((Number(rotation)||0)%4+4)%4;
    if(type==='straight')return r%2===0?'━':'┃';
    if(type==='corner')return ['└','┌','┐','┘'][r];
    if(type==='tee')return ['┻','┣','┳','┫'][r];
    return '';
  }

  function airflowConnectivity(puzzle,state=puzzleMechanismState){
    const payload=puzzle?.ui?.payload||{},tiles=payload.tiles||[],rotations=state?.rotations||[];
    const width=Number(payload.width)||4,height=Number(payload.height)||4,byPos=new Map();
    tiles.forEach((tile,index)=>byPos.set(`${tile.x},${tile.y}`,{tile,index,rotation:rotations[index]??tile.rotation??0}));
    const source=payload.source||{x:0,y:0,edge:'W'},start=byPos.get(`${source.x},${source.y}`),connected=new Set();
    if(!start||!airflowOpenings(start.tile.type,start.rotation).has(source.edge))return {connected,solved:false};
    const dirs={N:[0,-1,'S'],E:[1,0,'W'],S:[0,1,'N'],W:[-1,0,'E']},q=[[source.x,source.y]];
    connected.add(`${source.x},${source.y}`);
    for(let qi=0;qi<q.length;qi++){
      const [x,y]=q[qi],here=byPos.get(`${x},${y}`);if(!here)continue;
      for(const d of airflowOpenings(here.tile.type,here.rotation)){
        const [dx,dy,back]=dirs[d],nx=x+dx,ny=y+dy;
        if(nx<0||ny<0||nx>=width||ny>=height)continue;
        const there=byPos.get(`${nx},${ny}`);if(!there||!airflowOpenings(there.tile.type,there.rotation).has(back))continue;
        const key=`${nx},${ny}`;if(!connected.has(key)){connected.add(key);q.push([nx,ny]);}
      }
    }
    const sinks=Array.from(payload.sinks||[]);
    const solved=sinks.length>0&&sinks.every(sink=>{
      const item=byPos.get(`${sink.x},${sink.y}`);
      return Boolean(item&&connected.has(`${sink.x},${sink.y}`)&&airflowOpenings(item.tile.type,item.rotation).has(sink.edge));
    });
    return {connected,solved};
  }

  function pulseLaneHasGate(period,phase,targetColumn){
    const p=Math.max(1,Number(period)||1),ph=((Number(phase)||0)%p+p)%p,col=Number(targetColumn)||0;
    return ((col-ph)%p+p)%p===0;
  }

  function pulseSyncSolved(puzzle,state=puzzleMechanismState){
    const payload=puzzle?.ui?.payload||{},periods=payload.periods||[],phases=state?.phases||[],target=Number(payload.targetColumn)||0;
    return periods.length>0&&periods.length===phases.length&&periods.every((period,index)=>pulseLaneHasGate(period,phases[index],target));
  }

  function powerBalanceSum(puzzle,state=puzzleMechanismState){
    const loads=puzzle?.ui?.payload?.loads||[],selected=state?.selected||[];
    return loads.reduce((sum,value,index)=>sum+(selected[index]?(Number(value)||0):0),0);
  }


  function dualMirrorReflect(direction,orientation){
    const slash={N:'E',E:'N',S:'W',W:'S'},back={N:'W',W:'N',S:'E',E:'S'};
    return (Number(orientation)===0?slash:back)[direction]||direction;
  }

  function dualMirrorSourceStart(source,width,height){
    const edge=source?.edge,index=Number(source?.index)||0;
    if(edge==='W')return {x:-1,y:index,d:'E'};
    if(edge==='E')return {x:width,y:index,d:'W'};
    if(edge==='N')return {x:index,y:-1,d:'S'};
    return {x:index,y:height,d:'N'};
  }

  function dualMirrorTrace(puzzle,state=puzzleMechanismState,sourceIndex=0){
    const payload=puzzle?.ui?.payload||{},width=Number(payload.width)||5,height=Number(payload.height)||5,mirrors=payload.mirrors||[],orient=state?.orientations||[];
    const mirrorMap=new Map(mirrors.map((m,i)=>[`${m.x},${m.y}`,i])),dirs={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
    const source=payload.sources?.[sourceIndex]||{edge:'W',index:0},st=dualMirrorSourceStart(source,width,height);
    let {x,y,d}=st;const points=[{x:x+.5,y:y+.5}],seen=new Set(),hitMirrors=[];
    for(let step=0;step<100;step++){
      const [dx,dy]=dirs[d];x+=dx;y+=dy;points.push({x:x+.5,y:y+.5});
      if(x<0||y<0||x>=width||y>=height){
        let edge,index;
        if(x<0){edge='W';index=y;}else if(x>=width){edge='E';index=y;}else if(y<0){edge='N';index=x;}else{edge='S';index=x;}
        return {edge,index,points,hitMirrors,loop:false};
      }
      const keyState=`${x},${y},${d}`;if(seen.has(keyState))return {edge:null,index:null,points,hitMirrors,loop:true};seen.add(keyState);
      const mi=mirrorMap.get(`${x},${y}`);
      if(mi!=null){hitMirrors.push(mi);d=dualMirrorReflect(d,orient[mi]??0);}
    }
    return {edge:null,index:null,points,hitMirrors,loop:true};
  }

  function dualMirrorSolved(puzzle,state=puzzleMechanismState){
    const targets=puzzle?.ui?.payload?.targets||[],sources=puzzle?.ui?.payload?.sources||[];
    return sources.length>0&&sources.length===targets.length&&sources.every((_,i)=>{
      const trace=dualMirrorTrace(puzzle,state,i),target=targets[i];
      return !trace.loop&&trace.edge===target.edge&&Number(trace.index)===Number(target.index);
    });
  }

  function truthGateApply(name,a,b){
    a=Number(a)?1:0;b=Number(b)?1:0;
    if(name==='AND')return a&b;
    if(name==='OR')return a|b;
    return a^b;
  }

  function truthGateOutput(gates,row){
    const left=truthGateApply(gates?.[0],row.a,row.b),right=truthGateApply(gates?.[1],row.b,row.c);
    return truthGateApply(gates?.[2],left,right);
  }

  function truthGatesSolved(puzzle,state=puzzleMechanismState){
    const rows=puzzle?.ui?.payload?.rows||[],gates=state?.gates||[];
    return rows.length>0&&rows.every(row=>truthGateOutput(gates,row)===Number(row.y));
  }

  function exactPathSum(puzzle,state=puzzleMechanismState){
    const values=puzzle?.ui?.payload?.values||[],path=state?.path||[];
    return path.reduce((sum,pos)=>sum+(Number(values?.[Number(pos[1])]?.[Number(pos[0])])||0),0);
  }

  function exactPathSolved(puzzle,state=puzzleMechanismState){
    const payload=puzzle?.ui?.payload||{},path=state?.path||[],end=payload.end||[],moves=Number(payload.moves)||0;
    if(path.length!==moves+1)return false;
    const last=path[path.length-1]||[];
    return Number(last[0])===Number(end[0])&&Number(last[1])===Number(end[1])&&exactPathSum(puzzle,state)===Number(payload.targetSum);
  }

  function coupledSwitchSolved(puzzle,state=puzzleMechanismState){
    return JSON.stringify((state?.lamps||[]).map(v=>Number(v)?1:0))===JSON.stringify((puzzle?.ui?.payload?.target||[]).map(v=>Number(v)?1:0));
  }

  function rotateLayerPoint(point,rotation,size){
    let x=Number(point?.[0])||0,y=Number(point?.[1])||0,n=Math.max(1,Number(size)||1),r=((Number(rotation)||0)%4+4)%4;
    while(r--){const nx=n-1-y,ny=x;x=nx;y=ny;}
    return [x,y];
  }

  function layerAlignmentSolved(puzzle,state=puzzleMechanismState){
    const payload=puzzle?.ui?.payload||{},size=Number(payload.size)||5,target=payload.targetMarkers||{},layers=payload.layers||[],rot=state?.rotations||[];
    return layers.length>0&&layers.every((layer,index)=>{
      return Object.entries(target).every(([label,want])=>{
        const actual=rotateLayerPoint(layer.markers?.[label],rot[index],size);
        return Number(actual[0])===Number(want?.[0])&&Number(actual[1])===Number(want?.[1]);
      });
    });
  }

  function marketTillSum(puzzle,state=puzzleMechanismState){
    const tokens=puzzle?.ui?.payload?.tokens||[],selected=state?.selected||[];
    return tokens.reduce((sum,value,index)=>sum+(selected[index]?(Number(value)||0):0),0);
  }

  function l10ColdReadings(state=puzzleMechanismState){
    const c=Array.from(state?.controls||[0,0,0]).map(v=>Math.max(0,Math.min(2,Number(v)||0)));
    const A=c[0]||0,B=c[1]||0,C=c[2]||0;
    return {freezer:-14.5-2*A+0.5*B,chill:6-B-0.5*C,gel:1.5-A+0.5*C};
  }

  function l10ColdSolved(puzzle,state=puzzleMechanismState){
    const got=l10ColdReadings(state),want=puzzle?.ui?.payload?.targetReadings||{};
    return ['freezer','chill','gel'].every(k=>Math.abs(Number(got[k])-Number(want[k]))<1e-9);
  }

  function mechanismSolved(puzzle) {
    const payload = puzzle?.ui?.payload || {};
    const st = puzzleMechanismState || {};
    switch (puzzle?.type) {
      case 'dial-bank': return Array.isArray(st.values) && JSON.stringify(st.values) === JSON.stringify((payload.targetValues || []).map(Number));
      case 'route-board': return routeConnectivity(puzzle).solved;
      case 'path-grid': return Boolean(st.finished);
      case 'lights-out': return Array.isArray(st.lights) && st.lights.length > 0 && st.lights.every(v => Number(v) === Number(payload.target ?? 1));
      case 'balance-scale': return balanceSum(puzzle) === Number(payload.target);
      case 'context-match': return Number(st.selectedIndex) === Number(payload.correctIndex);
      case 'jug-transfer': return Array.isArray(st.amounts) && st.amounts.some(v => Number(v) === Number(payload.target));
      case 'hanoi-stack': {
        const n=Math.max(1,Number(payload.discCount)||3), target=Math.max(0,Number(payload.targetRod)||2);
        const want=Array.from({length:n},(_,i)=>n-i);
        return Array.isArray(st.rods?.[target]) && JSON.stringify(st.rods[target]) === JSON.stringify(want);
      }
      case 'codebreaker': return Boolean(st.solved);
      case 'equivalence-grid': {
        const fr=payload.fractions || [], dec=payload.decimals || [], pct=payload.percents || [];
        if(!fr.length || fr.length!==st.decimalOrder?.length || fr.length!==st.percentOrder?.length) return false;
        for(let row=0;row<fr.length;row++) {
          const a=Number(fr[row]?.value), b=Number(dec[st.decimalOrder[row]]?.value), c=Number(pct[st.percentOrder[row]]?.value);
          if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c)||Math.abs(a-b)>1e-9||Math.abs(a-c)>1e-9) return false;
        }
        return true;
      }
      case 'schedule-order': return JSON.stringify(st.order || []) === JSON.stringify(payload.targetOrder || []);
      case 'river-crossing': return Number(st.playerSide)===Number(payload.targetSide??1) && Array.isArray(st.itemSides) && st.itemSides.length>0 && st.itemSides.every(v=>Number(v)===Number(payload.targetSide??1)) && !riverCrossingUnsafe(puzzle,st);
      case 'sokoban': {
        const model=sokobanModel(puzzle), crates=new Set((st.crates||[]).map(([x,y])=>`${x},${y}`));
        return model.goals.size>0 && [...model.goals].every(k=>crates.has(k));
      }
      case 'sliding-grid': return slidingSolved(puzzle);
      case 'peg-solitaire': return Array.isArray(st.pegs) && st.pegs.reduce((n,v)=>n+(v?1:0),0)===1;
      case 'nonogram': {
        const rows=Array.from(payload.target || []); if(!rows.length) return false;
        const width=rows[0]?.length || 0, cells=Array.from(st.cells || []);
        if(!width || cells.length !== rows.length * width) return false;
        for(let y=0;y<rows.length;y++) for(let x=0;x<width;x++) {
          const shouldFill=String(rows[y]||'')[x]==='1';
          if((Number(cells[y*width+x])===1) !== shouldFill) return false;
        }
        return true;
      }
      case 'card-sort': return JSON.stringify(st.order || [])===JSON.stringify(payload.targetOrder || []);
      case 'calculator-sequence': return Boolean(st.solved);
      case 'base-match': return Boolean(st.solved);
      case 'ring-lock': return JSON.stringify((st.positions || []).map(Number))===JSON.stringify((payload.targetPositions || []).map(Number));
      case 'tone-sequence': return Boolean(st.solved);
      case 'airflow-network': return airflowConnectivity(puzzle,st).solved;
      case 'pulse-sync': return pulseSyncSolved(puzzle,st);
      case 'spectrum-order': return JSON.stringify(st.order||[])===JSON.stringify(payload.targetOrder||[]);
      case 'power-balance': return powerBalanceSum(puzzle,st)===Number(payload.target);
      case 'deduction-order': return JSON.stringify(st.order||[])===JSON.stringify(payload.targetOrder||[]);
      case 'dual-mirror': return dualMirrorSolved(puzzle,st);
      case 'truth-gates': return truthGatesSolved(puzzle,st);
      case 'dependency-order': return JSON.stringify(st.order||[])===JSON.stringify(payload.targetOrder||[]);
      case 'exact-path': return exactPathSolved(puzzle,st);
      case 'sphinx-riddles': return Boolean(st.solved);
      case 'coupled-switches': return coupledSwitchSolved(puzzle,st);
      case 'layer-alignment': return layerAlignmentSolved(puzzle,st);
      case 'market-till': return marketTillSum(puzzle,st)===Number(payload.targetCents);
      case 'cold-chain': return l10ColdSolved(puzzle,st);
      case 'textile-mixer': return Number(st.selectedIndex)===Number(payload.correctIndex);
      case 'record-classification': {
        const assignments=st.assignments||{};
        const records=payload.records||[];
        return records.length>0 && records.every(record=>String(assignments[record.id]||'')===String(record.destination||''));
      }
      case 'call-triangulation': return Array.isArray(st.selected) && Number(st.selected[0])===Number(payload.target?.[0]) && Number(st.selected[1])===Number(payload.target?.[1]);
      case 'lineage-match': return JSON.stringify(st.assignments||[])===JSON.stringify(payload.targetAssignments||[]);
      case 'habitat-triage': return String(st.akesi||'')===String(payload.target?.akesi||'') && String(st.moli||'')===String(payload.target?.moli||'');
      case 'sudoku': return Array.isArray(st.cells) && st.cells.length===81 && JSON.stringify(st.cells.map(Number))===JSON.stringify((payload.solution||[]).map(Number));
      case 'pattern-sequence': return Number(st.selectedIndex)===Number(payload.correctIndex);
      default: return false;
    }
  }

  function tutorialPuzzleLevel(puzzle) {
    const match=String(puzzle?.id||'').match(/^l(\d+)-/i);
    return match ? Number(match[1]) : null;
  }

  function tutorialFeedbackEnabled(puzzle) {
    const levelNo=tutorialPuzzleLevel(puzzle);
    return Number.isInteger(levelNo) && levelNo>=1 && levelNo<=3;
  }

  function clearTutorialSubmissionFeedback() {
    tutorialSubmissionFeedback=null;
  }

  function tutorialFeedbackMatches(puzzle,kind,index) {
    return Boolean(tutorialSubmissionFeedback && tutorialSubmissionFeedback.puzzleId===puzzle?.id && tutorialSubmissionFeedback.kind===kind && tutorialSubmissionFeedback.correctIndices.includes(Number(index)));
  }

  function routeBoardTutorialCorrectIndices(puzzle) {
    const payload=puzzle.ui?.payload||{},tiles=payload.tiles||[],limits=tiles.map(tile=>tile.type==='straight'?2:4);
    if(!tiles.length) return [];
    const solutions=[]; const rotations=Array(tiles.length).fill(0);
    const search=index=>{
      if(index===rotations.length){if(routeConnectivity(puzzle,rotations).solved)solutions.push(rotations.slice());return;}
      for(let r=0;r<limits[index];r++){rotations[index]=r;search(index+1);}
    };
    search(0);
    if(!solutions.length) return [];
    const current=puzzleMechanismState?.rotations||[],confirmed=[];
    for(let i=0;i<tiles.length;i++){
      const normalized=((Number(current[i])||0)%limits[i]+limits[i])%limits[i];
      if(solutions.every(solution=>Number(solution[i])===normalized)) confirmed.push(i);
    }
    return confirmed;
  }

  function balanceTutorialCorrectIndices(puzzle) {
    const payload=puzzle.ui?.payload||{},weights=(payload.weights||[]).map(Number),target=Number(payload.target),solutions=[];
    for(let mask=0;mask<(1<<weights.length);mask++){
      let sum=0; for(let i=0;i<weights.length;i++) if(mask&(1<<i)) sum+=weights[i];
      if(sum===target) solutions.push(mask);
    }
    if(!solutions.length) return [];
    const selected=puzzleMechanismState?.selected||[],confirmed=[];
    for(let i=0;i<weights.length;i++) if(selected[i] && solutions.every(mask=>Boolean(mask&(1<<i)))) confirmed.push(i);
    return confirmed;
  }

  function buildTutorialSubmissionFeedback(puzzle) {
    if(!tutorialFeedbackEnabled(puzzle)) return null;
    const correctIndices=[];
    if(puzzle.type==='country-cartouche'){
      const answer=String(puzzle.ui?.payload?.answer||'').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
      [...answer].forEach((letter,index)=>{
        const word=String(puzzleSlotValues[index]||'');
        if(WORD_TO_CP[word]!=null && word[0]?.toUpperCase()===letter) correctIndices.push(index);
      });
      return {puzzleId:puzzle.id,kind:'slot',correctIndices};
    }
    const seq=puzzleSequence(puzzle);
    if(seq.length){
      seq.forEach((expected,index)=>{if(puzzleSlotValues[index]===expected) correctIndices.push(index);});
      return {puzzleId:puzzle.id,kind:'slot',correctIndices};
    }
    if(puzzle.type==='dial-bank'){
      const target=(puzzle.ui?.payload?.targetValues||[]).map(Number),values=puzzleMechanismState?.values||[];
      target.forEach((value,index)=>{if(Number(values[index])===value) correctIndices.push(index);});
      return {puzzleId:puzzle.id,kind:'dial',correctIndices};
    }
    if(puzzle.type==='route-board') return {puzzleId:puzzle.id,kind:'route',correctIndices:routeBoardTutorialCorrectIndices(puzzle)};
    if(puzzle.type==='lights-out'){
      const target=Number(puzzle.ui?.payload?.target??1);
      (puzzleMechanismState?.lights||[]).forEach((value,index)=>{if(Number(value)===target) correctIndices.push(index);});
      return {puzzleId:puzzle.id,kind:'light',correctIndices};
    }
    if(puzzle.type==='balance-scale') return {puzzleId:puzzle.id,kind:'weight',correctIndices:balanceTutorialCorrectIndices(puzzle)};
    return null;
  }

  function tutorialFeedbackMessage(feedback) {
    const count=feedback?.correctIndices?.length||0;
    if(!count) return 'That answer did not work. No individual parts are confirmed yet; review the clues and try again.';
    return `${count} ${count===1?'part is':'parts are'} correctly placed and subtly highlighted. Adjust the rest, then Try answer again.`;
  }

  function showTutorialFailureFeedback(puzzle) {
    const feedback=buildTutorialSubmissionFeedback(puzzle);
    if(!feedback) return false;
    tutorialSubmissionFeedback=feedback;
    renderCampaignPuzzle();
    const message = tutorialFeedbackMessage(feedback);
    const confirmed = feedback.correctIndices?.length || 0;
    renderLocalized(puzzleStatus, isTpLanguage()
      ? (confirmed ? `pana sona li pona ala. kipisi ${confirmed} li lon ma pona; kipisi ante li awen sona ala. o ante e ona, li alasa sin.` : 'pana sona li pona ala. ilo li toki ala e kipisi pona. o lukin sin e sona, li alasa sin.')
      : message);
    return true;
  }

  const NO_PREVIEW_MECHANISM_TYPES = new Set([
    'dial-bank','route-board','path-grid','lights-out','balance-scale','context-match',
    'equivalence-grid','schedule-order','sliding-grid','nonogram','card-sort','ring-lock',
    'airflow-network','pulse-sync','spectrum-order','power-balance','deduction-order',
    'dual-mirror','truth-gates','dependency-order','coupled-switches','layer-alignment',
    'market-till','cold-chain','textile-mixer','call-triangulation','lineage-match',
    'habitat-triage','pattern-sequence','sudoku'
  ]);

  function setMechanismStatus(puzzle, text, neutralText) {
    if (isTpLanguage()) {
      const source = NO_PREVIEW_MECHANISM_TYPES.has(puzzle?.type) ? (neutralText || '') : (text || '');
      const translated = source ? exactText(source) : '';
      const tp = translated && translated !== source ? translated : (NO_PREVIEW_MECHANISM_TYPES.has(puzzle?.type)
        ? 'o pali e pana sona ale. pini la o luka e [[o alasa]]. ilo li toki e pona lon tenpo pana taso.'
        : 'o ante e ilo. sina pilin e ni: ona li pona la o luka e [[o alasa]].');
      renderLocalized(puzzleStatus, tp);
    } else if (NO_PREVIEW_MECHANISM_TYPES.has(puzzle?.type)) {
      renderLocalized(puzzleStatus, neutralText || 'Set the complete answer, then press Try answer. Correctness is checked only when you submit.', {sitelen:false});
    } else {
      renderLocalized(puzzleStatus, text || 'Adjust the mechanism, then press Try answer.', {sitelen:false});
    }
    puzzleCompleteBtn.disabled = false;
  }

  function renderDialBankPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState;
    const clues=document.createElement('div'); clues.className='mechanismClues';
    for(const clue of payload.clues||[]) { const row=document.createElement('div'); row.className='mechanismClue'; renderExact(row,clue); clues.appendChild(row); }
    const bank=document.createElement('div'); bank.className='dialBank';
    const names=isTpLanguage()?['poka loje','meso','poka laso']:['left','middle','right'];
    (st.values||[]).forEach((value,index)=>{
      const dial=document.createElement('div'); dial.className=`dialUnit${tutorialFeedbackMatches(puzzle,'dial',index)?' tutorialConfirmed':''}`;
      const label=document.createElement('div'); label.className='dialLabel'; label.textContent=names[index]||`dial ${index+1}`;
      const up=document.createElement('button'); up.type='button'; up.className='dialAdjust'; up.textContent='▲'; up.setAttribute('aria-label',`Increase ${label.textContent}`);
      const display=document.createElement('div'); display.className='dialValue'; renderBareNanpaDigits(display,value,{className:'dialBareDigit'});
      const down=document.createElement('button'); down.type='button'; down.className='dialAdjust'; down.textContent='▼'; down.setAttribute('aria-label',`Decrease ${label.textContent}`);
      up.addEventListener('click',()=>{clearTutorialSubmissionFeedback();st.values[index]=(Number(st.values[index])+1)%10;renderCampaignPuzzle();});
      down.addEventListener('click',()=>{clearTutorialSubmissionFeedback();st.values[index]=(Number(st.values[index])+9)%10;renderCampaignPuzzle();});
      dial.append(label,up,display,down); bank.appendChild(dial);
    });
    puzzleSlots.append(clues,bank);
    setMechanismStatus(puzzle, mechanismSolved(puzzle) ? 'All three clues agree. Press Try answer to confirm the clock bank.' : 'All three equations must be true at the same time.');
  }

  function renderRouteBoardPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const width=Number(payload.width)||4, height=Number(payload.height)||4;
    const tiles=payload.tiles||[]; const state=puzzleMechanismState; const connectivity=routeConnectivity(puzzle);
    const byPos=new Map(); tiles.forEach((tile,index)=>byPos.set(`${tile.x},${tile.y}`,{tile,index}));
    const wrap=document.createElement('div'); wrap.className='routeBoardWrap';
    const grid=document.createElement('div'); grid.className='routeBoard'; grid.style.setProperty('--route-cols',String(width));
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const item=byPos.get(`${x},${y}`);
      if(!item){const empty=document.createElement('div');empty.className='routeTile empty';grid.appendChild(empty);continue;}
      const rot=state.rotations[item.index]??0; const btn=document.createElement('button'); btn.type='button';
      btn.className=`routeTile${connectivity.connected.has(`${x},${y}`)?' connected':''}${tutorialFeedbackMatches(puzzle,'route',item.index)?' tutorialConfirmed':''}`; btn.textContent=routeTileSymbol(item.tile.type,rot);
      if(x===0&&y===Number(payload.sourceRow)) btn.dataset.edge='IN';
      if(x===width-1&&y===Number(payload.sinkRow)) btn.dataset.edge='OUT';
      btn.setAttribute('aria-label',`Rotate relay at column ${x+1}, row ${y+1}${btn.dataset.edge ? `, ${btn.dataset.edge}` : ''}`);
      btn.addEventListener('click',()=>{clearTutorialSubmissionFeedback();state.rotations[item.index]=(rot+1)%(item.tile.type==='straight'?2:4);renderCampaignPuzzle();});
      grid.appendChild(btn);
    }
    wrap.append(grid); puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle, connectivity.solved ? 'The signal reaches the output. Press Try answer to confirm the relay.' : 'Rotate pieces until the lit path reaches OUT.');
  }

  function renderPathGridPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const width=Number(payload.width)||5,height=Number(payload.height)||5;
    const blocks=new Set((payload.blocks||[]).map(([x,y])=>`${x},${y}`)); const cps=payload.checkpoints||[];
    const grid=document.createElement('div'); grid.className='pathGrid'; grid.style.setProperty('--path-cols',String(width));
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const cell=document.createElement('div'); cell.className='pathCell';
      if(blocks.has(`${x},${y}`)) cell.classList.add('blocked');
      const cpIndex=cps.findIndex(([cx,cy])=>cx===x&&cy===y); if(cpIndex>=0){cell.classList.add('checkpoint');cell.textContent=String.fromCharCode(65+cpIndex);if(cpIndex<st.nextCheckpoint)cell.classList.add('visited');}
      if(payload.exit?.[0]===x&&payload.exit?.[1]===y){cell.classList.add('exit');cell.textContent='◎';}
      if(st.x===x&&st.y===y){const token=document.createElement('span');token.className='pathToken';token.textContent='●';cell.appendChild(token);}
      grid.appendChild(cell);
    }
    const controls=document.createElement('div'); controls.className='pathControls';
    const moves=[['↑',0,-1,'north'],['←',-1,0,'west'],['↓',0,1,'south'],['→',1,0,'east']];
    const move=(dx,dy)=>{
      const nx=st.x+dx, ny=st.y+dy;
      if(nx<0||ny<0||nx>=width||ny>=height||blocks.has(`${nx},${ny}`)){renderExact(puzzleStatus,'That route is blocked.');blockedTone();return;}
      clearTutorialSubmissionFeedback();
      st.x=nx; st.y=ny;
      const next=cps[st.nextCheckpoint];
      if(next&&next[0]===nx&&next[1]===ny) st.nextCheckpoint++;
      if(payload.exit?.[0]===nx&&payload.exit?.[1]===ny&&st.nextCheckpoint>=cps.length) st.finished=true;
      renderCampaignPuzzle();
    };
    for(const [symbol,dx,dy,name] of moves){const b=document.createElement('button');b.type='button';b.className='pathMove';b.textContent=symbol;b.setAttribute('aria-label',`Move ${name}`);b.addEventListener('click',()=>move(dx,dy));controls.appendChild(b);}
    puzzleSlots.append(grid,controls);
    const nextLabel=st.nextCheckpoint<cps.length?String.fromCharCode(65+st.nextCheckpoint):'exit';
    setMechanismStatus(puzzle,st.finished?'All checkpoints visited in order. Press Try answer to confirm the route.':`Next target: ${nextLabel}.`);
  }

  function renderLightsOutPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const size=Number(payload.size)||3;
    const grid=document.createElement('div'); grid.className='lightsGrid'; grid.style.setProperty('--lights-cols',String(size));
    const toggle=index=>{
      clearTutorialSubmissionFeedback();
      const x=index%size,y=Math.floor(index/size);
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<size&&ny<size){const i=ny*size+nx;st.lights[i]=st.lights[i]?0:1;}}
      renderCampaignPuzzle();
    };
    st.lights.forEach((on,index)=>{const b=document.createElement('button');b.type='button';b.className=`lightCell${on?' on':''}${tutorialFeedbackMatches(puzzle,'light',index)?' tutorialConfirmed':''}`;b.setAttribute('aria-label',`Lamp ${index+1}, ${on?'on':'off'}`);b.addEventListener('click',()=>toggle(index));grid.appendChild(b);});
    puzzleSlots.appendChild(grid);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All lamps are lit. Press Try answer to confirm the observation panel.':'Make every lamp glow at the same time.');
  }

  function renderBalancePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const weights=payload.weights||[]; const sum=balanceSum(puzzle);
    const target=document.createElement('div'); target.className='balanceTarget';
    const label=document.createElement('strong');
    if(isTpLanguage()){
      label.className='tpSplitWords';
      for(const word of ['suli','wile']){const part=document.createElement('span');renderLocalized(part,word);label.appendChild(part);}
    }else renderExact(label,'target mass');
    const canvas=document.createElement('canvas'); canvas.width=220; canvas.height=68; canvas.className='balanceTargetCanvas';
    target.append(label,canvas); puzzleSlots.appendChild(target); renderNanpaSourceToCanvas(String(payload.target),canvas,36);
    const tray=document.createElement('div'); tray.className='balanceWeights';
    weights.forEach((weight,index)=>{const b=document.createElement('button');b.type='button';b.className=`balanceWeight${st.selected[index]?' selected':''}${tutorialFeedbackMatches(puzzle,'weight',index)?' tutorialConfirmed':''}`;renderMechanismNumber(b,weight);b.setAttribute('aria-pressed',String(Boolean(st.selected[index])));b.addEventListener('click',()=>{clearTutorialSubmissionFeedback();st.selected[index]=!st.selected[index];renderCampaignPuzzle();});tray.appendChild(b);});
    const readout=document.createElement('div');readout.className=`balanceReadout${sum===Number(payload.target)?' balanced':''}`;renderExact(readout,`selected mass: ${sum}`);
    puzzleSlots.append(tray,readout);
    setMechanismStatus(puzzle,sum===Number(payload.target)?'The scale is balanced. Press Try answer to confirm the machine.':sum>Number(payload.target)?'Too heavy. Remove a weight.':'Too light. Add weight.');
  }

  function renderContextMatchPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState;
    const target=document.createElement('div'); target.className='contextTarget'; target.innerHTML='<strong>TIME</strong><span>03:09</span>';
    const choices=document.createElement('div'); choices.className='contextChoices';
    (payload.choices||[]).forEach((choice,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`contextChoice${Number(st.selectedIndex)===index?' selected':''}`;b.setAttribute('aria-label',`Choice ${index+1}`);
      const tag=document.createElement('span');tag.className='contextChoiceTag';tag.textContent=String.fromCharCode(65+index);
      const c=document.createElement('canvas');c.width=320;c.height=78;c.className='contextChoiceCanvas';b.append(tag,c);b.addEventListener('click',()=>{clearTutorialSubmissionFeedback();st.selectedIndex=index;renderCampaignPuzzle();});choices.appendChild(b);
      renderNanpaSourceToCanvas(choice.source,c,38);
    });
    puzzleSlots.append(target,choices);
    setMechanismStatus(puzzle,st.selectedIndex==null?'Choose the cartouche whose context is time.':mechanismSolved(puzzle)?'That cartouche matches the time display. Press Try answer to confirm the core.':'That choice is selected. Press Try answer to test it.');
    puzzleCompleteBtn.disabled = false;
  }

  function renderJugTransferPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState;
    const caps=(payload.capacities||[3,5]).map(Number); const target=Number(payload.target)||4;
    const header=document.createElement('div'); header.className='jugTarget';
    const headerLabel=document.createElement('strong');renderLocalized(headerLabel,isTpLanguage()?'wile':'target');
    const headerValue=mechanismNumberNode(target,'jugTargetValue');
    const headerUnit=document.createElement('small');renderLocalized(headerUnit,isTpLanguage()?'suli':'units',{sitelen:isTpLanguage()});
    header.append(headerLabel,headerValue,headerUnit);
    const vessels=document.createElement('div'); vessels.className='jugVessels';
    caps.forEach((cap,index)=>{
      const amount=Number(st.amounts?.[index])||0;
      const unit=document.createElement('div'); unit.className='jugUnit';
      const vessel=document.createElement('div'); vessel.className='jugVessel';
      const fill=document.createElement('div'); fill.className='jugVesselFill'; fill.style.height=`${cap ? (amount/cap)*100 : 0}%`;
      const read=document.createElement('div'); read.className='jugReadout';
      if(isTpLanguage()){
        const readCartouche=document.createElement('span'); readCartouche.className='jugReadoutCartouche';
        renderMechanismNumber(readCartouche,`${amount}/${cap}`);
        const readLatin=document.createElement('small'); readLatin.className='jugReadoutLatin'; readLatin.textContent=`${amount}/${cap}`;
        read.append(readCartouche,readLatin);
      } else {
        read.textContent=`${amount}/${cap}`;
      }
      vessel.append(fill,read); const label=document.createElement('div'); label.className='jugLabel'; renderLocalized(label,isTpLanguage()?`poki suli ${cap}`:`${cap}-unit vessel`);
      unit.append(vessel,label); vessels.appendChild(unit);
    });
    const controls=document.createElement('div'); controls.className='jugControls';
    const action=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='jugAction';renderLocalized(b,label,{sitelen:isTpLanguage()});b.addEventListener('click',()=>{fn();renderCampaignPuzzle();});controls.appendChild(b);};
    action(isTpLanguage()?`o pini e poki ${caps[0]}`:`Fill ${caps[0]}`,()=>{st.amounts[0]=caps[0];});
    action(isTpLanguage()?`o pini e poki ${caps[1]}`:`Fill ${caps[1]}`,()=>{st.amounts[1]=caps[1];});
    action(isTpLanguage()?`o weka e telo tan poki ${caps[0]}`:`Empty ${caps[0]}`,()=>{st.amounts[0]=0;});
    action(isTpLanguage()?`o weka e telo tan poki ${caps[1]}`:`Empty ${caps[1]}`,()=>{st.amounts[1]=0;});
    action(`${caps[0]} → ${caps[1]}`,()=>{const moved=Math.min(st.amounts[0],caps[1]-st.amounts[1]);st.amounts[0]-=moved;st.amounts[1]+=moved;});
    action(`${caps[1]} → ${caps[0]}`,()=>{const moved=Math.min(st.amounts[1],caps[0]-st.amounts[0]);st.amounts[1]-=moved;st.amounts[0]+=moved;});
    puzzleSlots.append(header,vessels,controls);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?`Exactly ${target} units measured. Press Try answer to confirm the reservoir.`:`Measure exactly ${target} units in either vessel.`);
  }

  function renderHanoiPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const n=Math.max(1,Number(payload.discCount)||3);
    const board=document.createElement('div'); board.className='hanoiBoard';
    (st.rods||[[],[],[]]).forEach((rod,rodIndex)=>{
      const btn=document.createElement('button'); btn.type='button'; btn.className=`hanoiRod${Number(st.selectedRod)===rodIndex?' selected':''}`; btn.setAttribute('aria-label',`Post ${rodIndex+1}`);
      const post=document.createElement('div'); post.className='hanoiPost';
      const stack=document.createElement('div'); stack.className='hanoiStack';
      for(const size of rod){const disk=document.createElement('div');disk.className='hanoiDisk';disk.style.width=`${38+(Number(size)/n)*56}%`;renderAlwaysNanpaMechanismNumber(disk,size,{className:'hanoiNanpaNumber'});stack.appendChild(disk);}
      const base=document.createElement('div'); base.className='hanoiBase'; const label=document.createElement('small');renderExact(label,`post ${rodIndex+1}`);
      btn.append(post,stack,base,label);
      btn.addEventListener('click',()=>{
        if(st.selectedRod==null){if(!rod.length){renderExact(puzzleStatus,'That post has no disc to move.');blockedTone();return;}st.selectedRod=rodIndex;renderCampaignPuzzle();return;}
        const from=Number(st.selectedRod); if(from===rodIndex){st.selectedRod=null;renderCampaignPuzzle();return;}
        const source=st.rods[from], dest=st.rods[rodIndex], disk=source[source.length-1], top=dest[dest.length-1];
        if(disk==null){st.selectedRod=null;renderCampaignPuzzle();return;}
        if(top!=null && Number(top)<Number(disk)){renderExact(puzzleStatus,'A larger disc cannot sit on a smaller disc.');blockedTone();return;}
        source.pop(); dest.push(disk); st.moves=(Number(st.moves)||0)+1; st.selectedRod=null; renderCampaignPuzzle();
      });
      board.appendChild(btn);
    });
    const moves=document.createElement('div');moves.className='hanoiMoves';renderExact(moves,`moves: ${Number(st.moves)||0}`);
    puzzleSlots.append(board,moves);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The complete stack is on the right post. Press Try answer to confirm Stackworks.':st.selectedRod==null?'Tap a post to pick up its top disc.':'Now tap the destination post.');
  }

  function codebreakerFeedback(secret,guess) {
    let exact=0; const sCount=new Map(), gCount=new Map();
    for(let i=0;i<secret.length;i++){
      if(Number(secret[i])===Number(guess[i])) exact++;
      else {sCount.set(secret[i],(sCount.get(secret[i])||0)+1);gCount.set(guess[i],(gCount.get(guess[i])||0)+1);}
    }
    let misplaced=0; for(const [k,v] of gCount) misplaced+=Math.min(v,sCount.get(k)||0);
    return {exact,misplaced};
  }

  function renderCodebreakerPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const variant=getCodebreakerVariant(puzzle); const words=variant.words; const secret=variant.secret;
    const wrap=document.createElement('div');wrap.className='codebreakerWrap';
    const stage=document.createElement('div');stage.className='codebreakerStage';
    const legend=document.createElement('div');legend.className='codeLegend';
    const legendTitle=document.createElement('strong');renderExact(legendTitle,'available glyphs');legend.appendChild(legendTitle);
    words.forEach((word)=>{const item=document.createElement('span');item.className='codeLegendGlyph';item.title=word;item.setAttribute('aria-label',word);const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(word);item.appendChild(glyph);legend.appendChild(item);});
    const guess=document.createElement('div'); guess.className='codeGuess';guess.style.setProperty('--code-cols',String(Math.min(words.length,6)));guess.dataset.symbolCount=String(words.length);
    st.guess.forEach((value,index)=>{const word=words[Number(value)%words.length]||words[0];const b=document.createElement('button');b.type='button';b.className='codeSymbol';b.innerHTML=`<span class="sitelenGlyph">${glyphChar(word)}</span>`;b.setAttribute('aria-label',`Position ${index+1}, ${word}. Tap to change glyph.`);b.addEventListener('click',()=>{st.guess[index]=(Number(st.guess[index])+1)%words.length;renderCampaignPuzzle();});guess.appendChild(b);});
    const submit=document.createElement('button');submit.type='button';submit.className='codeSubmit';renderExact(submit,'Test code',{sitelen:false});submit.disabled=Boolean(st.solved);submit.addEventListener('click',()=>{
      const fb=codebreakerFeedback(secret,st.guess); st.history.push({guess:Array.from(st.guess),exact:fb.exact,misplaced:fb.misplaced});
      const max=Math.max(1,Number(payload.maxHistory)||5); if(st.history.length>max) st.history.splice(0,st.history.length-max);
      if(fb.exact===secret.length){st.solved=true;successTone();} else softTone(); renderCampaignPuzzle();
    });
    const feedbackPanel=document.createElement('div');feedbackPanel.className='codeFeedbackPanel';
    const history=document.createElement('div');history.className='codeHistory';
    for(const item of st.history){const row=document.createElement('div');row.className='codeHistoryRow';const code=document.createElement('span');code.className='codeHistorySymbols';for(const v of item.guess){const word=words[Number(v)%words.length]||words[0];const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(word);glyph.title=word;code.appendChild(glyph);}const fb=document.createElement('span');renderExact(fb,`exact ${item.exact} · misplaced ${item.misplaced}`);row.append(code,fb);history.appendChild(row);}    
    stage.append(legend,guess,submit);
    feedbackPanel.append(history);
    wrap.append(stage,feedbackPanel);
    puzzleSlots.append(wrap);
    setMechanismStatus(puzzle,st.solved?`The ${secret.length}-glyph code is confirmed. Press Try answer to confirm the vault.`:st.history.length?'Use exact/misplaced feedback to refine the permutation.':`Tap each of the ${secret.length} positions to choose a glyph, then test the code.`);
  }

  function renderEquivalencePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const fractions=payload.fractions||[], decimals=payload.decimals||[], percents=payload.percents||[];
    const wrap=document.createElement('div');wrap.className='equivalenceWrap';
    const grid=document.createElement('div');grid.className='equivalenceGrid';
    for(const title of ['fraction','decimal','percent']){const h=document.createElement('div');h.className='equivalenceHeader';renderLocalized(h,isTpLanguage()?({fraction:'kipisi',decimal:'nanpa lili',percent:'mute 100'}[title]):title);grid.appendChild(h);}
    const makeCard=(entry,column,row,movable)=>{
      const b=document.createElement(movable?'button':'div'); if(movable)b.type='button'; b.className=`equivalenceCard${st.selected?.column===column&&st.selected?.row===row?' selected':''}${movable?' movable':''}`;
      const c=document.createElement('canvas');c.width=220;c.height=68;c.className='equivalenceCanvas'; const small=document.createElement('small');small.textContent=entry?.source||'';b.append(c,small);renderNanpaSourceToCanvas(entry?.source||'',c,34);
      if(movable)b.addEventListener('click',()=>{
        const key=column==='decimal'?'decimalOrder':'percentOrder';
        if(!st.selected || st.selected.column!==column){st.selected={column,row};renderCampaignPuzzle();return;}
        if(st.selected.row===row){st.selected=null;renderCampaignPuzzle();return;}
        const a=st.selected.row; [st[key][a],st[key][row]]=[st[key][row],st[key][a]]; st.selected=null; renderCampaignPuzzle();
      });
      return b;
    };
    for(let row=0;row<fractions.length;row++){
      grid.appendChild(makeCard(fractions[row],'fraction',row,false));
      grid.appendChild(makeCard(decimals[st.decimalOrder[row]],'decimal',row,true));
      grid.appendChild(makeCard(percents[st.percentOrder[row]],'percent',row,true));
    }
    wrap.appendChild(grid); puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'Every row represents the same quantity. Press Try answer to confirm the gallery.':st.selected?'Select a second card in the same column to swap them.':'Align equivalent fraction, decimal and percentage values by row.');
  }

  async function renderNanpaSourceFixedFont(source,target,fontPx=26) {
    const ctxOut=target.getContext('2d',{alpha:true});
    try {
      const renderer=await ensureLevelRenderer();
      const rendered=await renderer.renderTextToNewCanvas({input:explicitNanpaSource(source),layout:{fontPx,align:'center',spacingPreset:'compact',paddingPx:6},parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true}});
      const src=rendered?.canvas;if(!src)throw new Error('no canvas');
      target.width=Math.max(1,src.width);target.height=Math.max(1,src.height);
      const c=target.getContext('2d',{alpha:true});c.clearRect(0,0,target.width,target.height);c.drawImage(src,0,0);
    } catch(err) {
      target.width=220;target.height=52;ctxOut.clearRect(0,0,target.width,target.height);ctxOut.fillStyle='#111';ctxOut.font=`${fontPx}px system-ui`;ctxOut.textAlign='center';ctxOut.textBaseline='middle';ctxOut.fillText(String(source),target.width/2,target.height/2);
    }
  }

  function renderSchedulePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const events=payload.events||[];
    const list=document.createElement('div');list.className='scheduleList';
    const move=(row,delta)=>{const to=row+delta;if(to<0||to>=st.order.length)return;[st.order[row],st.order[to]]=[st.order[to],st.order[row]];renderCampaignPuzzle();};
    st.order.forEach((eventIndex,row)=>{
      const event=events[eventIndex]; const item=document.createElement('div');item.className='scheduleItem';
      const rank=document.createElement('div');rank.className='scheduleRank';renderMechanismNumber(rank,row+1);
      const cards=document.createElement('div');cards.className='scheduleCartouches';
      const date=document.createElement('canvas');date.className='scheduleCanvas scheduleDateCanvas';date.setAttribute('aria-label','date cartouche');
      const time=document.createElement('canvas');time.className='scheduleCanvas scheduleTimeCanvas';time.setAttribute('aria-label','time cartouche');
      cards.append(date,time); renderNanpaSourceFixedFont(event?.dateSource||'',date,26); renderNanpaSourceFixedFont(event?.timeSource||'',time,26);
      const controls=document.createElement('div');controls.className='scheduleControls';
      const up=document.createElement('button');up.type='button';up.textContent='↑';up.disabled=row===0;up.setAttribute('aria-label',`Move event ${event?.id||row+1} earlier`);up.addEventListener('click',()=>move(row,-1));
      const down=document.createElement('button');down.type='button';down.textContent='↓';down.disabled=row===st.order.length-1;down.setAttribute('aria-label',`Move event ${event?.id||row+1} later`);down.addEventListener('click',()=>move(row,1));
      controls.append(up,down); item.append(rank,cards,controls); list.appendChild(item);
    });
    puzzleSlots.appendChild(list);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The schedule runs from earliest to latest. Press Try answer to confirm the archive.':'Earliest event at the top; latest event at the bottom.');
  }


  function renderRiverCrossingPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}, st=puzzleMechanismState, travellers=payload.travellers||[];
    const playerSide=Number(st.playerSide)||0;
    const boatRow=Math.max(0,Math.min(3,Number(st.boatRow)||0));
    const selected=Number.isInteger(st.selectedItem) ? Number(st.selectedItem) : null;
    const itemSides=Array.isArray(st.itemSides)?st.itemSides:Array.from(travellers,()=>0);
    const itemRows=Array.isArray(st.itemRows)?st.itemRows:Array.from(travellers,(_,i)=>i+1);
    st.playerSide=playerSide; st.boatRow=boatRow; st.itemSides=itemSides; st.itemRows=itemRows;

    const wrap=document.createElement('div');wrap.className='riverPuzzle';

    const rules=document.createElement('div');rules.className='riverRules';
    const ruleLead=document.createElement('strong');renderExact(ruleLead,'jan must stay with these pairs:');rules.appendChild(ruleLead);
    (payload.forbiddenPairs||[]).forEach((pair,index)=>{
      const a=travellers[Number(pair?.[0])], b=travellers[Number(pair?.[1])];
      if(!a||!b)return;
      const rule=document.createElement('div');rule.className='riverRule';
      const left=document.createElement('span');left.className='riverRuleGlyph';left.innerHTML=`<span class="sitelenGlyph">${glyphChar(a.glyph||'ijo')}</span><small>${a.label||''}</small>`;
      const plus=document.createElement('span');plus.className='riverRulePlus';plus.textContent='+';
      const right=document.createElement('span');right.className='riverRuleGlyph';right.innerHTML=`<span class="sitelenGlyph">${glyphChar(b.glyph||'ijo')}</span><small>${b.label||''}</small>`;
      const bad=document.createElement('span');bad.className='riverRuleBad';bad.textContent='✕';bad.setAttribute('aria-label','unsafe without jan');
      rule.append(left,plus,right,bad);rules.appendChild(rule);
    });

    const scene=document.createElement('div');scene.className='riverBoardWrap';
    const labels=document.createElement('div');labels.className='riverBoardLabels';
    labels.innerHTML=isTpLanguage()?'<span>poka loje</span><span></span><span>telo</span><span></span><span>poka laso</span>':'<span>LEFT BANK</span><span></span><span>RIVER</span><span></span><span>RIGHT BANK</span>';
    labels.classList.toggle('tpProse',isTpLanguage());
    scene.appendChild(labels);
    const board=document.createElement('div');board.className='riverBoard';

    const cargoExists=(row,side)=>travellers.findIndex((_,i)=>selected!==i && Number(itemSides[i])===side && Number(itemRows[i])===row);
    const alignedItemIndex=travellers.findIndex((_,i)=>selected!==i && Number(itemSides[i])===playerSide && Number(itemRows[i])===boatRow);
    const boatCol=playerSide===0?1:2;
    const boatCargoLabel=selected!=null && travellers[selected] ? `supa&${travellers[selected].glyph||'ijo'}` : 'supa';

    function renderBankToken(i){
      const tr=travellers[i];
      const token=document.createElement('div'); token.className='riverToken';
      if(['pan','waso','soweli'].includes(String(tr.glyph||''))) token.classList.add('riverToken--compactPassenger');
      token.innerHTML=`<span class="sitelenGlyph">${glyphChar(tr.glyph||'ijo')}</span><small>${tr.label||`passenger ${i+1}`}</small>`;
      return token;
    }

    for(let row=0; row<4; row++) {
      for(let col=0; col<4; col++) {
        const cell=document.createElement('div');
        cell.className='riverCell';
        if(col===0 || col===3) cell.classList.add('bank'); else cell.classList.add('water');
        if(col===0) cell.classList.add('leftBank');
        if(col===3) cell.classList.add('rightBank');
        if((col===1||col===2) && row===boatRow && col===boatCol) {
          cell.classList.add('boatCell');
          const boat=document.createElement('div'); boat.className='riverRaft';
          const raftGlyph=document.createElement('div'); raftGlyph.className='riverRaftGlyph riverRaftGlyphCompound sitelenGlyph'; raftGlyph.textContent=boatCargoLabel;
          const raftMeta=document.createElement('div'); raftMeta.className='riverRaftMeta'; raftMeta.textContent=selected!=null && travellers[selected] ? `jan + ${travellers[selected].label}` : 'jan';
          boat.append(raftGlyph, raftMeta); cell.appendChild(boat);
        } else if(col===0 || col===3) {
          const side=col===0?0:1;
          const idx=cargoExists(row,side);
          if(idx>=0) cell.appendChild(renderBankToken(idx));
        } else {
          const wave=document.createElement('div'); wave.className='riverWave'; wave.textContent='~'; cell.appendChild(wave);
        }
        board.appendChild(cell);
      }
    }
    scene.appendChild(board);

    const controls=document.createElement('div'); controls.className='riverControls';
    const up=document.createElement('button'); up.type='button'; up.className='riverMoveButton'; up.textContent='↑'; up.disabled=boatRow<=0; up.addEventListener('click',()=>{st.boatRow=Math.max(0,boatRow-1); renderCampaignPuzzle();});
    const down=document.createElement('button'); down.type='button'; down.className='riverMoveButton'; down.textContent='↓'; down.disabled=boatRow>=3; down.addEventListener('click',()=>{st.boatRow=Math.min(3,boatRow+1); renderCampaignPuzzle();});
    const load=document.createElement('button'); load.type='button'; load.className='riverLoadButton';
    if(selected==null) {
      renderExact(load,'Load',{sitelen:false});
      load.disabled=alignedItemIndex<0;
      load.addEventListener('click',()=>{
        if(alignedItemIndex<0){blockedTone(); return;}
        st.selectedItem=alignedItemIndex; renderCampaignPuzzle();
      });
    } else {
      renderExact(load,'Unload',{sitelen:false});
      load.addEventListener('click',()=>{
        const occupied=travellers.some((_,i)=>i!==selected && Number(itemSides[i])===playerSide && Number(itemRows[i])===boatRow);
        if(occupied){renderExact(puzzleStatus,'That bank position is already occupied.'); blockedTone(); return;}
        st.itemSides[selected]=playerSide; st.itemRows[selected]=boatRow; st.selectedItem=null; renderCampaignPuzzle();
      });
    }
    const cross=document.createElement('button'); cross.type='button'; cross.className='riverCrossButton'; renderLocalized(cross,playerSide===0?(isTpLanguage()?'o tawa →':'Cross →'):(isTpLanguage()?'← o tawa':'← Cross'),{sitelen:isTpLanguage()});
    cross.addEventListener('click',()=>{
      const to=playerSide?0:1;
      const next={ playerSide:to, boatRow, itemSides:Array.from(itemSides), itemRows:Array.from(itemRows), selectedItem:selected, moves:(Number(st.moves)||0)+1 };
      if(selected!=null) { next.itemSides[selected]=to; next.itemRows[selected]=boatRow; }
      const unsafe=riverCrossingUnsafeDetail(puzzle,next);
      if(unsafe){renderExact(puzzleStatus,`No: ${unsafe.label} would be left together without jan.`); blockedTone(); return;}
      puzzleMechanismState=next; renderCampaignPuzzle();
    });
    controls.append(up,down,load,cross);

    const footer=document.createElement('div'); footer.className='riverFooter';
    const moves=document.createElement('span'); renderExact(moves,`crossings: ${Number(st.moves)||0}`);
    const hint=document.createElement('span');
    renderLocalized(hint, selected==null ? (alignedItemIndex>=0 ? (isTpLanguage()?'tomo telo li lon poka ijo. o pana e ijo lon tomo, anu o tawa taso.':'Aligned with a bank object. Load it, or cross alone.') : (isTpLanguage()?'o tawa e tomo telo sewi anu anpa tawa poka ijo. ni la o pana e ijo lon tomo anu o tawa.':'Move the raft up or down to align with an object, then load or cross.')) : (isTpLanguage()?`ijo lon tomo: [[${travellers[selected]?.label||''}]]. o tawa, anu o pana e ijo tawa poka telo.`:`Cargo aboard: ${travellers[selected]?.label||''}. Cross, or unload at the aligned bank position.`));
    footer.append(moves,hint);

    wrap.append(rules,scene,controls,footer);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'jan, pan, waso and soweli are all safely across. Press Try answer to confirm the dock.':'Move jan, pan, waso and soweli to the far bank without leaving an unsafe pair alone.');
  }

  function renderSokobanPuzzle(puzzle) {
    const model=sokobanModel(puzzle),st=puzzleMechanismState,crateSet=new Set((st.crates||[]).map(([x,y])=>`${x},${y}`));
    const wrap=document.createElement('div');wrap.className='sokobanWrap';
    const grid=document.createElement('div');grid.className='sokobanGrid';grid.style.setProperty('--soko-cols',String(model.width));
    for(let y=0;y<model.height;y++)for(let x=0;x<model.width;x++){
      const k=`${x},${y}`;const cell=document.createElement('div');cell.className='sokobanCell';
      if(model.walls.has(k))cell.classList.add('wall');if(model.goals.has(k))cell.classList.add('goal');if(crateSet.has(k)){cell.classList.add('crate');cell.textContent='■';}if(st.player?.[0]===x&&st.player?.[1]===y){cell.classList.add('player');cell.textContent='●';}grid.appendChild(cell);
    }
    const controls=document.createElement('div');controls.className='sokobanControls';
    const move=(dx,dy)=>{const [px,py]=st.player||[0,0],nx=px+dx,ny=py+dy,nk=`${nx},${ny}`;if(model.walls.has(nk))return blockedTone();const ci=(st.crates||[]).findIndex(([x,y])=>x===nx&&y===ny);if(ci>=0){const bx=nx+dx,by=ny+dy,bk=`${bx},${by}`;if(model.walls.has(bk)||(st.crates||[]).some(([x,y])=>x===bx&&y===by))return blockedTone();st.crates[ci]=[bx,by];}st.player=[nx,ny];renderCampaignPuzzle();};
    for(const [sym,dx,dy,name] of [['↑',0,-1,'up'],['←',-1,0,'left'],['↓',0,1,'down'],['→',1,0,'right']]){const b=document.createElement('button');b.type='button';b.textContent=sym;b.setAttribute('aria-label',`Move ${name}`);b.addEventListener('click',()=>move(dx,dy));controls.appendChild(b);}wrap.append(grid,controls);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'Both crates are on marked bays. Press Try answer to confirm the freight panel.':'Push both crates onto the marked bays.');
  }

  function renderSlidingGridPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,size=Number(payload.size)||3;const grid=document.createElement('div');grid.className='slidingGrid';grid.style.setProperty('--slide-cols',String(size));
    (st.tiles||[]).forEach((value,index)=>{const b=document.createElement('button');b.type='button';b.className=`slidingTile${Number(value)===0?' blank':''}`;if(Number(value)!==0)renderBareNanpaDigits(b,value,{className:'slidingBareDigit'});b.disabled=Number(value)===0;b.addEventListener('click',()=>{const z=st.tiles.indexOf(0),x=index%size,y=Math.floor(index/size),zx=z%size,zy=Math.floor(z/size);if(Math.abs(x-zx)+Math.abs(y-zy)!==1){blockedTone();return;}[st.tiles[index],st.tiles[z]]=[st.tiles[z],st.tiles[index]];renderCampaignPuzzle();});grid.appendChild(b);});
    puzzleSlots.appendChild(grid);setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The panel is in numerical order. Press Try answer to confirm the gallery.':'Slide tiles into ascending order, with the empty space last.');
  }

  function renderPegSolitairePuzzle(puzzle) {
    const st=puzzleMechanismState;const row=document.createElement('div');row.className='pegLine';
    (st.pegs||[]).forEach((on,index)=>{const b=document.createElement('button');b.type='button';b.className=`pegHole${on?' occupied':''}${st.selected===index?' selected':''}`;b.textContent=on?'●':'○';b.setAttribute('aria-label',`Hole ${index+1}, ${on?'occupied':'empty'}`);b.addEventListener('click',()=>{if(on){st.selected=st.selected===index?null:index;renderCampaignPuzzle();return;}if(st.selected==null)return;const move=pegMoves(st.pegs).find(m=>m.from===st.selected&&m.to===index);if(!move){renderExact(puzzleStatus,'That peg cannot jump into this hole.');blockedTone();return;}st.pegs[move.from]=0;st.pegs[move.mid]=0;st.pegs[move.to]=1;st.selected=null;st.moves=(Number(st.moves)||0)+1;renderCampaignPuzzle();});row.appendChild(b);});
    puzzleSlots.appendChild(row);setMechanismStatus(puzzle,mechanismSolved(puzzle)?'One peg remains. Press Try answer to confirm the strategy panel.':st.selected==null?'Select a peg to move.':'Select an empty hole two spaces away across one peg.');
  }

  function nonogramRuns(values) {
    const out=[]; let run=0;
    for(const value of values || []) {
      if(Number(value)) run += 1;
      else if(run) { out.push(run); run=0; }
    }
    if(run) out.push(run);
    return out.length ? out : [0];
  }

  function nonogramClueElement(runs, vertical=false) {
    const values=Array.from(runs || []);
    const clue=document.createElement('div'); clue.className=`nonogramClue${vertical?' vertical':''}`;
    clue.setAttribute('aria-label',`clue ${values.join(' plus ')}`);
    values.forEach((value,index)=>{
      if(index) {
        const sep=document.createElement('span'); sep.className='nonogramClueSeparator'; sep.textContent='+'; sep.setAttribute('aria-hidden','true');
        clue.appendChild(sep);
      }
      const item=document.createElement('span'); item.className='nonogramClueNumber';
      renderMechanismNumber(item,value); item.title=String(value); clue.appendChild(item);
    });
    return clue;
  }

  function renderNonogramPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    const rows=Array.from(payload.target || []); const height=rows.length, width=rows[0]?.length || 0;
    const target=rows.map(row=>Array.from(String(row), ch=>ch==='1'?1:0));
    const wrap=document.createElement('div'); wrap.className='nonogramWrap';
    wrap.style.setProperty('--nonogram-cols',String(width)); wrap.style.setProperty('--nonogram-rows',String(height));
    const corner=document.createElement('div'); corner.className='nonogramCorner';
    const top=document.createElement('div'); top.className='nonogramTopClues';
    for(let x=0;x<width;x++) top.appendChild(nonogramClueElement(nonogramRuns(target.map(row=>row[x])),true));
    const left=document.createElement('div'); left.className='nonogramRowClues';
    for(let y=0;y<height;y++) left.appendChild(nonogramClueElement(nonogramRuns(target[y]),false));
    const grid=document.createElement('div'); grid.className='nonogramGrid';
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const index=y*width+x, value=Number(st.cells?.[index])||0;
      const b=document.createElement('button'); b.type='button'; b.className=`nonogramCell${value===1?' filled':value===2?' marked':''}`;
      b.setAttribute('aria-label',`row ${y+1}, column ${x+1}, ${value===1?'filled':value===2?'marked empty':'unknown'}`);
      b.addEventListener('click',()=>{st.cells[index]=(value+1)%3;renderCampaignPuzzle();}); grid.appendChild(b);
    }
    wrap.append(corner,top,left,grid); puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The inventory pattern is complete. Press Try answer to confirm the pantry terminal.':'Use the row and column run clues. Tap each cell to cycle blank → filled → ×.');
  }

  function makePatternPanel(size,lit,className='patternPanel') {
    const panel=document.createElement('div');panel.className=className;panel.style.setProperty('--pattern-cols',String(size));const set=new Set((lit||[]).map(Number));for(let i=0;i<size*size;i++){const c=document.createElement('span');c.className=`patternCell${set.has(i)?' on':''}`;panel.appendChild(c);}return panel;
  }

  function renderPatternSequencePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,size=Number(payload.size)||3;const seq=document.createElement('div');seq.className='patternSequence';for(const frame of payload.frames||[])seq.appendChild(makePatternPanel(size,frame));const q=document.createElement('div');q.className='patternQuestion';q.textContent='?';seq.appendChild(q);const choices=document.createElement('div');choices.className='patternChoices';(payload.options||[]).forEach((opt,i)=>{const b=document.createElement('button');b.type='button';b.className=`patternChoice${Number(st.selectedIndex)===i?' selected':''}`;b.appendChild(makePatternPanel(size,opt,'patternPanel'));b.setAttribute('aria-label',`Pattern option ${i+1}`);b.addEventListener('click',()=>{st.selectedIndex=i;renderCampaignPuzzle();});choices.appendChild(b);});puzzleSlots.append(seq,choices);setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The rotation continues correctly. Press Try answer to confirm the observatory.':'Choose the next quarter-turn of the lit shape.');
  }


  /*
   * Level 6 Card Archive card rendering.
   *
   * This deliberately mirrors solitaire-toki(5).html:
   * - 82×116 face, radius 10
   * - suits: ilo / pilin / kiwen / kasi
   * - ranks: lawa, tu, seli, awen, luka, utala, mun, pipi, jo,
   *          sike, lanpan, meli, mije
   * - centre/small-suit glyphs 4× supersampled
   * - small rank glyphs 8× supersampled
   * - the same enclosed-region fill algorithm before downsampling
   */
  const L6_CARD_W=82;
  const L6_CARD_H=116;
  const L6_CARD_RADIUS=10;
  const L6_CARD_SUITS=['♠','♥','♦','♣'];
  const L6_CARD_SUIT_COLORS=Object.freeze({'♠':'black','♣':'black','♥':'red','♦':'red'});
  const L6_CARD_SUIT_WORD=Object.freeze({'♠':'ilo','♥':'pilin','♦':'kiwen','♣':'kasi'});
  const L6_CARD_RANK_WORD=Object.freeze({
    1:'lawa',2:'tu',3:'seli',4:'awen',5:'luka',6:'utala',7:'mun',
    8:'pipi',9:'jo',10:'sike',11:'lanpan',12:'meli',13:'mije'
  });

  const L6_CARD_GLYPH_SS=4;
  const L6_CARD_RANK_SS=8;
  const L6_CARD_CENTER_FONT=42;
  const L6_CARD_CENTER_CACHE_SIZE=72;
  const L6_CARD_CENTER_RENDER_PX=L6_CARD_CENTER_FONT*L6_CARD_GLYPH_SS;
  const L6_CARD_CENTER_RENDER_SIZE=L6_CARD_CENTER_CACHE_SIZE*L6_CARD_GLYPH_SS;

  const L6_CARD_SMALL_SUIT_FONT=18;
  const L6_CARD_SMALL_SUIT_CACHE_SIZE=28;
  const L6_CARD_SMALL_SUIT_RENDER_PX=L6_CARD_SMALL_SUIT_FONT*L6_CARD_GLYPH_SS;
  const L6_CARD_SMALL_SUIT_RENDER_SIZE=L6_CARD_SMALL_SUIT_CACHE_SIZE*L6_CARD_GLYPH_SS;
  const L6_CARD_SMALL_SUIT_PADDING=2;
  const L6_CARD_SMALL_SUIT_RENDER_PADDING=L6_CARD_SMALL_SUIT_PADDING*L6_CARD_GLYPH_SS;

  const L6_CARD_SMALL_RANK_FONT=22;
  const L6_CARD_SMALL_RANK_CACHE_SIZE=30;
  const L6_CARD_SMALL_RANK_RENDER_SIZE=L6_CARD_SMALL_RANK_CACHE_SIZE*L6_CARD_RANK_SS;
  const L6_CARD_SMALL_RANK_RENDER_FONT=L6_CARD_SMALL_RANK_FONT*L6_CARD_RANK_SS;

  const L6_CARD_FILLED_WORDS=new Set(['ilo','pilin','kiwen','kasi','lawa','meli','mije','lanpan','sike']);
  const L6_CARD_FILL_MASK_CACHE=new Map();
  const L6_CARD_FILL_TINT_CACHE=new Map();
  const L6_CARD_CENTER_CACHE=new Map();
  const L6_CARD_SMALL_SUIT_CACHE=new Map();
  const L6_CARD_SMALL_RANK_CACHE=new Map();
  const L6_CARD_FRONT_CACHE=new Map();
  const L6_CARD_FILL_CACHE_MAX=256;
  const L6_CARD_PROBE_CANVAS=document.createElement('canvas');
  const L6_CARD_PROBE_CTX=L6_CARD_PROBE_CANVAS.getContext('2d',{willReadFrequently:true});

  function l6CardInk(colorName){return colorName==='red'?'#b32020':'#111';}
  function l6CardSuitInk(suit){return suit==='♥'||suit==='♦'?'#b32020':'#111';}
  function l6CardCreateCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function l6CardDownscale(source,w,h){
    const out=l6CardCreateCanvas(w,h),ctx=out.getContext('2d',{alpha:true});
    if(!ctx)return out;
    ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
    ctx.drawImage(source,0,0,source.width,source.height,0,0,w,h);
    return out;
  }
  function l6CardWordText(word){return glyphChar(word);}
  function l6CardShouldFill(word){return L6_CARD_FILLED_WORDS.has(String(word||''));}
  function l6CardTouchCache(map,key,value){
    if(map.has(key))map.delete(key);map.set(key,value);
    if(map.size>L6_CARD_FILL_CACHE_MAX)map.delete(map.keys().next().value);
    return value;
  }

  function l6CardMaskKey(word,fontPx,align,baseline,scaleX){return [word,fontPx,align,baseline,scaleX].join('|');}
  function l6CardTintKey(word,fontPx,align,baseline,scaleX,fillStyle){return [word,fontPx,align,baseline,scaleX,fillStyle].join('|');}

  function l6CardMakeFilledMask(word,fontPx,align='left',baseline='alphabetic',scaleX=1){
    const text=l6CardWordText(word),isSike=word==='sike',key=l6CardMaskKey(word,fontPx,align,baseline,scaleX);
    const cached=L6_CARD_FILL_MASK_CACHE.get(key);if(cached)return l6CardTouchCache(L6_CARD_FILL_MASK_CACHE,key,cached);
    const SS=4,absScaleX=Math.abs(scaleX||1),pad=Math.max(6,Math.ceil(fontPx*.4)),probe=L6_CARD_PROBE_CTX;
    probe.font=`${fontPx}px "${NASIN_NANPA_FONT}", sans-serif`;probe.textAlign=align;probe.textBaseline=baseline;
    const m=probe.measureText(text);
    const leftReach=Math.max(1,Math.ceil((m.actualBoundingBoxLeft||0)*absScaleX));
    const rightReach=Math.max(1,Math.ceil((m.actualBoundingBoxRight||m.width||fontPx)*absScaleX));
    const topReach=Math.max(1,Math.ceil(m.actualBoundingBoxAscent||fontPx*.8));
    const bottomReach=Math.max(1,Math.ceil(m.actualBoundingBoxDescent||fontPx*.25));
    const logicalW=leftReach+rightReach+pad*2,logicalH=topReach+bottomReach+pad*2;
    const anchorX=leftReach+pad,anchorY=topReach+pad,hiW=logicalW*SS,hiH=logicalH*SS,hiAnchorX=anchorX*SS,hiAnchorY=anchorY*SS;
    const glyphCanvas=l6CardCreateCanvas(hiW,hiH),gctx=glyphCanvas.getContext('2d',{willReadFrequently:true});
    gctx.clearRect(0,0,hiW,hiH);gctx.fillStyle='#fff';gctx.font=`${fontPx*SS}px "${NASIN_NANPA_FONT}", sans-serif`;gctx.textAlign=align;gctx.textBaseline=baseline;
    gctx.save();gctx.translate(hiAnchorX,hiAnchorY);if(scaleX!==1)gctx.scale(scaleX,1);gctx.fillText(text,0,0);gctx.restore();

    const img=gctx.getImageData(0,0,hiW,hiH),data=img.data,visited=new Uint8Array(hiW*hiH),stack=[];
    const alphaAt=i=>data[i*4+3];
    const push=(x,y)=>{
      if(x<0||y<0||x>=hiW||y>=hiH)return;
      const i=y*hiW+x;if(visited[i]||alphaAt(i)>24)return;
      visited[i]=1;stack.push(i);
    };
    for(let x=0;x<hiW;x++){push(x,0);push(x,hiH-1);}
    for(let y=1;y<hiH-1;y++){push(0,y);push(hiW-1,y);}
    while(stack.length){
      const i=stack.pop(),x=i%hiW,y=(i/hiW)|0;
      push(x-1,y);push(x+1,y);push(x,y-1);push(x,y+1);
    }
    const holes=new Uint8Array(hiW*hiH);
    for(let i=0;i<visited.length;i++)if(!visited[i]&&alphaAt(i)<=24)holes[i]=1;

    let selected=holes;
    if(isSike){
      const seen=new Uint8Array(hiW*hiH),components=[];
      for(let start=0;start<holes.length;start++){
        if(!holes[start]||seen[start])continue;
        const q=[start];seen[start]=1;const pixels=[];let area=0,sumX=0,sumY=0;
        while(q.length){
          const i=q.pop(),x=i%hiW,y=(i/hiW)|0;pixels.push(i);area++;sumX+=x;sumY+=y;
          if(x>0){const n=i-1;if(holes[n]&&!seen[n]){seen[n]=1;q.push(n);}}
          if(x+1<hiW){const n=i+1;if(holes[n]&&!seen[n]){seen[n]=1;q.push(n);}}
          if(y>0){const n=i-hiW;if(holes[n]&&!seen[n]){seen[n]=1;q.push(n);}}
          if(y+1<hiH){const n=i+hiW;if(holes[n]&&!seen[n]){seen[n]=1;q.push(n);}}
        }
        const cx=sumX/Math.max(1,area),cy=sumY/Math.max(1,area),dx=cx-hiAnchorX,dy=cy-hiAnchorY;
        components.push({pixels,area,d2:dx*dx+dy*dy});
      }
      if(components.length){
        const radius2=Math.max((fontPx*SS*.42)**2,36),central=components.filter(x=>x.d2<=radius2),pool=central.length?central:components;
        pool.sort((a,b)=>a.area!==b.area?a.area-b.area:a.d2-b.d2);
        selected=new Uint8Array(hiW*hiH);for(const i of pool[0].pixels)selected[i]=1;
      }
    }

    const dilated=selected.slice();
    for(let y=1;y<hiH-1;y++)for(let x=1;x<hiW-1;x++){
      const i=y*hiW+x;if(selected[i])continue;
      if(selected[i-1]||selected[i+1]||selected[i-hiW]||selected[i+hiW]||
         selected[i-hiW-1]||selected[i-hiW+1]||selected[i+hiW-1]||selected[i+hiW+1])dilated[i]=1;
    }
    const maskCanvas=l6CardCreateCanvas(hiW,hiH),mctx=maskCanvas.getContext('2d',{willReadFrequently:true}),maskImg=mctx.createImageData(hiW,hiH),maskData=maskImg.data;
    for(let i=0;i<dilated.length;i++)if(dilated[i]){const o=i*4;maskData[o]=255;maskData[o+1]=255;maskData[o+2]=255;maskData[o+3]=255;}
    mctx.putImageData(maskImg,0,0);
    return l6CardTouchCache(L6_CARD_FILL_MASK_CACHE,key,{canvas:maskCanvas,anchorX,anchorY,width:logicalW,height:logicalH});
  }

  function l6CardTintedFill(word,fontPx,align='left',baseline='alphabetic',scaleX=1,fillStyle='#111'){
    const key=l6CardTintKey(word,fontPx,align,baseline,scaleX,fillStyle),cached=L6_CARD_FILL_TINT_CACHE.get(key);
    if(cached)return l6CardTouchCache(L6_CARD_FILL_TINT_CACHE,key,cached);
    const mask=l6CardMakeFilledMask(word,fontPx,align,baseline,scaleX),canvas=l6CardCreateCanvas(mask.canvas.width,mask.canvas.height),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=fillStyle;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask.canvas,0,0);
    return l6CardTouchCache(L6_CARD_FILL_TINT_CACHE,key,{canvas,mask});
  }

  function l6CardDrawSitelen(ctx,word,x,y,fontPx,align='left',baseline='alphabetic',scaleX=1){
    const text=l6CardWordText(word),fillStyle=String(ctx.fillStyle);
    let filled=null;if(l6CardShouldFill(word))filled=l6CardTintedFill(word,fontPx,align,baseline,scaleX,fillStyle);
    ctx.save();ctx.translate(x,y);ctx.font=`${fontPx}px "${NASIN_NANPA_FONT}", sans-serif`;ctx.textAlign=align;ctx.textBaseline=baseline;
    if(scaleX!==1)ctx.scale(scaleX,1);ctx.fillText(text,0,0);
    if(filled){
      const {canvas,mask}=filled;
      ctx.drawImage(canvas,0,0,canvas.width,canvas.height,-mask.anchorX,-mask.anchorY,mask.width,mask.height);
    }
    ctx.restore();
  }

  function l6CardCenterSuit(suit){
    if(L6_CARD_CENTER_CACHE.has(suit))return L6_CARD_CENTER_CACHE.get(suit);
    const word=L6_CARD_SUIT_WORD[suit];if(!word)return null;
    const canvas=l6CardCreateCanvas(L6_CARD_CENTER_RENDER_SIZE,L6_CARD_CENTER_RENDER_SIZE),ctx=canvas.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle=l6CardSuitInk(suit);
    l6CardDrawSitelen(ctx,word,canvas.width/2,canvas.height/2,L6_CARD_CENTER_RENDER_PX,'center','middle');
    L6_CARD_CENTER_CACHE.set(suit,canvas);return canvas;
  }

  function l6CardSmallSuit(suit,orientation='upright'){
    const key=`${suit}|${orientation}`;if(L6_CARD_SMALL_SUIT_CACHE.has(key))return L6_CARD_SMALL_SUIT_CACHE.get(key);
    const word=L6_CARD_SUIT_WORD[suit];if(!word)return null;
    const hi=l6CardCreateCanvas(L6_CARD_SMALL_SUIT_RENDER_SIZE,L6_CARD_SMALL_SUIT_RENDER_SIZE),ctx=hi.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,hi.width,hi.height);ctx.fillStyle=l6CardSuitInk(suit);
    if(orientation==='inverted'){
      ctx.save();ctx.translate(hi.width-L6_CARD_SMALL_SUIT_RENDER_PADDING,hi.height-L6_CARD_SMALL_SUIT_RENDER_PADDING);ctx.rotate(Math.PI);
      l6CardDrawSitelen(ctx,word,L6_CARD_SMALL_SUIT_RENDER_PADDING,L6_CARD_SMALL_SUIT_RENDER_PADDING,L6_CARD_SMALL_SUIT_RENDER_PX,'left','top');ctx.restore();
    }else{
      l6CardDrawSitelen(ctx,word,L6_CARD_SMALL_SUIT_RENDER_PADDING,L6_CARD_SMALL_SUIT_RENDER_PADDING,L6_CARD_SMALL_SUIT_RENDER_PX,'left','top');
    }
    const out=l6CardDownscale(hi,L6_CARD_SMALL_SUIT_CACHE_SIZE,L6_CARD_SMALL_SUIT_CACHE_SIZE);L6_CARD_SMALL_SUIT_CACHE.set(key,out);return out;
  }

  function l6CardSmallRank(rank,colorName,orientation='upright'){
    const key=`${rank}|${colorName}|${orientation}`;if(L6_CARD_SMALL_RANK_CACHE.has(key))return L6_CARD_SMALL_RANK_CACHE.get(key);
    const word=L6_CARD_RANK_WORD[Number(rank)];if(!word)return null;
    const hi=l6CardCreateCanvas(L6_CARD_SMALL_RANK_RENDER_SIZE,L6_CARD_SMALL_RANK_RENDER_SIZE),ctx=hi.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,hi.width,hi.height);ctx.fillStyle=l6CardInk(colorName);
    if(orientation==='inverted'){
      ctx.save();ctx.translate(hi.width/2,hi.height/2);ctx.rotate(Math.PI);l6CardDrawSitelen(ctx,word,0,0,L6_CARD_SMALL_RANK_RENDER_FONT,'center','middle',1);ctx.restore();
    }else{
      l6CardDrawSitelen(ctx,word,hi.width/2,hi.height/2,L6_CARD_SMALL_RANK_RENDER_FONT,'center','middle',1);
    }
    const out=l6CardDownscale(hi,L6_CARD_SMALL_RANK_CACHE_SIZE,L6_CARD_SMALL_RANK_CACHE_SIZE);L6_CARD_SMALL_RANK_CACHE.set(key,out);return out;
  }

  function l6CardBuildFront(card){
    const suit=L6_CARD_SUITS.includes(card?.suit)?card.suit:'♠',rank=Number(card?.rank)||1,key=`${rank}|${suit}`;
    if(L6_CARD_FRONT_CACHE.has(key))return L6_CARD_FRONT_CACHE.get(key);
    const face=l6CardCreateCanvas(L6_CARD_W,L6_CARD_H),ctx=face.getContext('2d',{alpha:true}),colorName=L6_CARD_SUIT_COLORS[suit]||'black';
    ctx.save();ctx.beginPath();ctx.roundRect(0,0,L6_CARD_W,L6_CARD_H,L6_CARD_RADIUS);ctx.fillStyle='#fffdf8';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='rgba(0,0,0,.25)';ctx.stroke();

    const rankUp=l6CardSmallRank(rank,colorName,'upright'),suitUp=l6CardSmallSuit(suit,'upright'),rankDown=l6CardSmallRank(rank,colorName,'inverted'),suitDown=l6CardSmallSuit(suit,'inverted'),center=l6CardCenterSuit(suit);
    if(rankUp)ctx.drawImage(rankUp,4,3);
    if(suitUp)ctx.drawImage(suitUp,9,28);
    if(rankDown)ctx.drawImage(rankDown,L6_CARD_W-6-L6_CARD_SMALL_RANK_CACHE_SIZE,L6_CARD_H-4-L6_CARD_SMALL_RANK_CACHE_SIZE);
    if(suitDown)ctx.drawImage(suitDown,L6_CARD_W-9-L6_CARD_SMALL_SUIT_CACHE_SIZE,L6_CARD_H-7-22-L6_CARD_SMALL_SUIT_CACHE_SIZE);
    if(center){
      const x=Math.round(L6_CARD_W/2-L6_CARD_CENTER_CACHE_SIZE/2),y=Math.round(L6_CARD_H/2+2-L6_CARD_CENTER_CACHE_SIZE/2);
      ctx.imageSmoothingEnabled=true;if('imageSmoothingQuality' in ctx)ctx.imageSmoothingQuality='high';
      ctx.drawImage(center,0,0,center.width,center.height,x,y,L6_CARD_CENTER_CACHE_SIZE,L6_CARD_CENTER_CACHE_SIZE);
    }
    ctx.restore();L6_CARD_FRONT_CACHE.set(key,face);return face;
  }

  function renderL6PlayingCard(canvas,card){
    const face=l6CardBuildFront(card);
    canvas.width=L6_CARD_W;canvas.height=L6_CARD_H;
    const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,L6_CARD_W,L6_CARD_H);
    if(face)ctx.drawImage(face,0,0);
  }

  function renderCardSortPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,cards=payload.cards||[];
    const wrap=document.createElement('div'); wrap.className='cardSortWrap';
    const row=document.createElement('div'); row.className='cardSortRow';
    (st.order||[]).forEach((cardIndex,slotIndex)=>{
      const card=cards[Number(cardIndex)];
      const b=document.createElement('button'); b.type='button'; b.className=`cardSortButton${Number(st.selected)===slotIndex?' selected':''}`;
      const canvas=document.createElement('canvas'); canvas.className='cardSortCanvas'; renderL6PlayingCard(canvas,card||{rank:1,suit:'♠'});
      b.appendChild(canvas);
      b.setAttribute('aria-label',`Card rank ${card?.rank??'unknown'}, position ${slotIndex+1}`);
      b.addEventListener('click',()=>{
        if(st.selected==null){st.selected=slotIndex;renderCampaignPuzzle();return;}
        if(Number(st.selected)===slotIndex){st.selected=null;renderCampaignPuzzle();return;}
        const a=Number(st.selected); [st.order[a],st.order[slotIndex]]=[st.order[slotIndex],st.order[a]];
        st.selected=null; st.swaps=(Number(st.swaps)||0)+1; renderCampaignPuzzle();
      });
      row.appendChild(b);
    });
    const note=document.createElement('div'); note.className='cardSortNote'; renderExact(note,`swaps: ${Number(st.swaps)||0}`);
    wrap.append(row,note); puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The cards are in ascending rank. Press Try answer to confirm the archive.':st.selected==null?'Select a card, then another card, to swap them.':'Now select the card to swap with it.');
  }

  function calculatorBenchEvaluateExpression(raw) {
    const input=String(raw||'').replace(/−/g,'-').trim();
    const number='(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const match=new RegExp(`^([+-]?${number})((?:[+-]${number})*)$`).exec(input);
    if(!match)return null;
    let value=Number(match[1]);
    const tail=match[2]||'';
    const re=new RegExp(`([+-])(${number})`,'g');
    let m;
    while((m=re.exec(tail))){
      const n=Number(m[2]);
      value=m[1]==='-'?value-n:value+n;
    }
    return Number.isFinite(value)?value:null;
  }

  function calculatorBenchDisplayParts(raw) {
    const input=String(raw||'').replace(/−/g,'-');
    if(!input)return [];
    const parts=[];
    let start=0;
    for(let i=1;i<input.length;i++){
      const ch=input[i];
      if(ch==='+'||ch==='-'){
        const number=input.slice(start,i);
        if(number)parts.push({type:'number',value:number});
        parts.push({type:'operator',value:ch});
        start=i+1;
      }
    }
    const tail=input.slice(start);
    if(start===0 && input==='-')parts.push({type:'sign',value:'-'});
    else if(tail)parts.push({type:'number',value:tail});
    return parts;
  }

  function calculatorBenchAppendOperator(current,op) {
    let input=String(current||'').replace(/−/g,'-');
    if(!input)return op==='-'?'-':'';
    const last=input.at(-1);
    if(last==='+'||last==='-')return input.slice(0,-1)+op;
    if(last==='.')return input;
    return input+op;
  }

  function calculatorBenchAppendDot(current) {
    const input=String(current||'').replace(/−/g,'-');
    let boundary=-1;
    for(let i=1;i<input.length;i++)if(input[i]==='+'||input[i]==='-')boundary=i;
    const segment=input.slice(boundary+1);
    if(segment.includes('.'))return input;
    if(!segment||segment==='-'||segment==='+')return input+'0.';
    return input+'.';
  }

  function renderCalculatorBenchInput(container,input) {
    container.replaceChildren();
    const parts=calculatorBenchDisplayParts(input);
    if(!parts.length){
      const q=document.createElement('span');q.className='calculatorBenchPlaceholder';q.textContent='?';container.appendChild(q);return;
    }
    for(const part of parts){
      if(part.type==='operator'||part.type==='sign'){
        const glyph=document.createElement('span');
        glyph.className='calculatorBenchWorkOperator sitelenGlyph';
        const word=part.type==='sign'?'ona':part.value==='-'?'lape':'en';
        glyph.textContent=glyphChar(word);
        glyph.title=part.type==='sign'?'negative':part.value==='-'?'subtract':'add';
        container.appendChild(glyph);
        continue;
      }
      const canvas=document.createElement('canvas');
      canvas.width=220;canvas.height=68;canvas.className='calculatorBenchWorkCartouche';
      container.appendChild(canvas);
      renderNanpaSourceToCanvas(part.value,canvas,34);
    }
  }

  function renderCalculatorSequencePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,problems=payload.problems||[];
    const stage=Math.min(Number(st.stage)||0,Math.max(0,problems.length-1)),problem=problems[stage];
    const wrap=document.createElement('div'); wrap.className='calculatorPuzzle';
    const progress=document.createElement('div'); progress.className='calculatorProgress'; renderExact(progress,`problem ${Math.min(stage+1,problems.length)} / ${problems.length}`);

    const expression=document.createElement('div'); expression.className='calculatorExpression';
    const a=document.createElement('canvas'); a.width=230;a.height=78;a.className='calculatorCartouche';
    const op=document.createElement('div'); op.className='calculatorOperator';
    const opWord=problem?.op==='−'?'lape':problem?.op==='+'?'en':null;
    if(opWord){op.classList.add('sitelenGlyph');op.textContent=glyphChar(opWord);op.title=problem.op;}
    else op.textContent=problem?.op||'?';
    const b=document.createElement('canvas'); b.width=230;b.height=78;b.className='calculatorCartouche';
    expression.append(a,op,b);
    renderNanpaSourceToCanvas(problem?.a||'0',a,40); renderNanpaSourceToCanvas(problem?.b||'0',b,40);

    const answerBox=document.createElement('div'); answerBox.className='calculatorAnswer calculatorAnswer--working';
    const answerLabel=document.createElement('strong'); renderExact(answerLabel,'calculator');
    const answerDisplay=document.createElement('div'); answerDisplay.className='calculatorBenchWork';
    answerBox.append(answerLabel,answerDisplay);
    renderCalculatorBenchInput(answerDisplay,st.input||'');

    const keypad=document.createElement('div'); keypad.className='calculatorKeypad calculatorKeypad--expression';
    const keys=['7','8','9','−','4','5','6','+','1','2','3','⌫','0','.','Clear','Enter'];
    const press=(key)=>{
      let input=String(st.input||'').replace(/−/g,'-');
      st.message='';
      if(key==='Clear') input='';
      else if(key==='⌫') input=input.slice(0,-1);
      else if(key==='−'||key==='+') input=calculatorBenchAppendOperator(input,key==='−'?'-':'+');
      else if(key==='.') input=calculatorBenchAppendDot(input);
      else if(key==='Enter'){
        const result=calculatorBenchEvaluateExpression(input);
        if(result==null){
          st.message='Enter a complete calculation before pressing Enter.';
          blockedTone();renderCampaignPuzzle();return;
        }
        const expected=Number(problem?.answer);
        if(Number.isFinite(expected) && Math.abs(result-expected)<1e-12){
          if(stage>=problems.length-1){st.solved=true;st.message='All three calculations are correct.';}
          else {st.stage=stage+1;st.input='';st.message='Correct. Next calculation.';}
          successTone();
        }else{
          st.message=`That calculation gives ${result}; it is not the required result.`;
          blockedTone();
        }
        renderCampaignPuzzle();return;
      }else{
        const boundary=Math.max(input.lastIndexOf('+'),input.lastIndexOf('-',1));
        const next=input+key;
        if(next.length<=24)input=next;
      }
      st.input=input;
      renderCampaignPuzzle();
    };
    keys.forEach(key=>{
      const btn=document.createElement('button');btn.type='button';
      btn.className=`calculatorKey calculatorKey--${key==='Enter'?'enter':key==='Clear'?'clear':'normal'}`;
      btn.textContent=key;btn.addEventListener('click',()=>press(key));keypad.appendChild(btn);
    });
    wrap.append(progress,expression,answerBox,keypad); puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All calculations are correct. Press Try answer to confirm the bench.':(st.message||'Enter the calculation with the keypad, then press Enter to evaluate it.'));
  }

  function baseMatchRoundsForAttempt(payload,attempt=0) {
    const kinds=Array.from(payload?.kinds||['binary','hex','binary']);
    let seed=((Number(payload?.seed)||60421)+(Number(attempt)||0)*7919)>>>0;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const shuffle=values=>{const a=Array.from(values);for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
    const sourceFor=(kind,value)=>kind==='hex'?`#${Number(value).toString(16).toUpperCase()}`:`0b${Number(value).toString(2)}`;
    return kinds.map((kind,qIndex)=>{
      const min=kind==='hex'?17:6,max=kind==='hex'?239:63;
      const span=max-min+1;
      const target=min+Math.floor(rand()*span);
      const values=new Set([target]);
      while(values.size<4){
        let candidate=target+(Math.floor(rand()*19)-9);
        if(candidate<min)candidate=min+Math.floor(rand()*Math.min(12,span));
        if(candidate>max)candidate=max-Math.floor(rand()*Math.min(12,span));
        if(candidate!==target)values.add(candidate);
      }
      const ordered=shuffle([...values]),correctIndex=ordered.indexOf(target);
      return {kind,target:String(target),options:ordered.map(v=>sourceFor(kind,v)),correctIndex};
    });
  }

  function baseMatchParserOverrides(source) {
    const text=String(source||'');
    if(text.startsWith('0b')) return {enableBinaryParsing:true,enableBinaryRendering:true};
    if(text.startsWith('#')) return {enableHexParsing:true};
    return {};
  }

  function renderBaseMatchPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    if(!Array.isArray(st.rounds)||st.rounds.length!==3)st.rounds=baseMatchRoundsForAttempt(payload,Number(st.attempt)||0);
    const rounds=st.rounds,stage=Math.min(Number(st.stage)||0,rounds.length-1),round=rounds[stage];
    const wrap=document.createElement('div');wrap.className='baseMatchWrap';
    const progress=document.createElement('div');progress.className='baseMatchProgress';renderExact(progress,`choice ${stage+1} / ${rounds.length}`);
    const target=document.createElement('canvas');target.width=360;target.height=84;target.className='baseMatchTarget';renderNanpaSourceToCanvas(round?.target||'0',target,42);
    const choices=document.createElement('div');choices.className='baseMatchChoices';
    (round?.options||[]).forEach((source,index)=>{
      const b=document.createElement('button');b.type='button';b.className='baseMatchChoice';
      const canvas=document.createElement('canvas');canvas.width=300;canvas.height=74;canvas.className='baseMatchCanvas';b.appendChild(canvas);
      renderNanpaSourceToCanvas(source,canvas,38,baseMatchParserOverrides(source));
      b.setAttribute('aria-label',`Number-system option ${index+1}`);
      b.addEventListener('click',()=>{
        if(st.solved)return;
        st.answers=Array.from(st.answers||[]);
        st.answers[stage]=index;
        if(stage<rounds.length-1){
          st.stage=stage+1;
          st.message='Answer accepted. No correctness feedback until all three choices are complete.';
        }else{
          const allCorrect=rounds.every((item,i)=>Number(st.answers[i])===Number(item.correctIndex));
          if(allCorrect){
            st.solved=true;st.message='All three conversions are correct.';successTone();
          }else{
            st.attempt=(Number(st.attempt)||0)+1;
            st.stage=0;st.answers=[];st.rounds=baseMatchRoundsForAttempt(payload,st.attempt);
            st.message='One or more choices were wrong. A new set of numbers has been loaded.';
            blockedTone();
          }
        }
        renderCampaignPuzzle();
      });
      choices.appendChild(b);
    });
    wrap.append(progress,target,choices);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All three conversions are correct. Press Try answer to confirm the lab.':(st.message||'Choose once for each target. Results are revealed only after the third choice.'));
  }

  function renderRingLockPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,markers=payload.markers||[];
    const wrap=document.createElement('div');wrap.className='ringLockWrap';
    const clues=document.createElement('div');clues.className='ringLockClues';
    (payload.clues||[]).forEach((text,index)=>{const item=document.createElement('div');item.className='ringLockClue';renderLocalized(item,`${index+1}. ${exactText(text)}`);clues.appendChild(item);});
    const rings=document.createElement('div');rings.className='ringLockGrid';
    markers.forEach((word,index)=>{
      const unit=document.createElement('div');unit.className='ringLockUnit';
      const dial=document.createElement('div');dial.className='ringDial';
      for(let pos=0;pos<8;pos++){
        const dot=document.createElement('span');dot.className=`ringDot ringDot${pos}${Number(st.positions?.[index])===pos?' active':''}`;dial.appendChild(dot);
      }
      const glyph=document.createElement('div');glyph.className='ringCenterGlyph sitelenGlyph';glyph.textContent=glyphChar(word);glyph.title=word;dial.appendChild(glyph);
      const label=document.createElement('div');label.className='ringLabel';label.textContent=word;
      const controls=document.createElement('div');controls.className='ringControls';
      const ccw=document.createElement('button');ccw.type='button';ccw.textContent='↶';ccw.setAttribute('aria-label',`Rotate ${word} counter-clockwise`);ccw.addEventListener('click',()=>{st.positions[index]=(Number(st.positions[index])+7)%8;renderCampaignPuzzle();});
      const cw=document.createElement('button');cw.type='button';cw.textContent='↷';cw.setAttribute('aria-label',`Rotate ${word} clockwise`);cw.addEventListener('click',()=>{st.positions[index]=(Number(st.positions[index])+1)%8;renderCampaignPuzzle();});
      controls.append(ccw,cw);unit.append(dial,label,controls);rings.appendChild(unit);
    });
    wrap.append(clues,rings);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All four markers satisfy the position clues. Press Try answer to confirm the vault.':'Use the clues to align all four ring markers.');
  }


  let l7ToneAudioContext=null;
  let l7TonePlaybackSerial=0;

  function l7ToneContext(){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!l7ToneAudioContext)l7ToneAudioContext=new Ctx();
    return l7ToneAudioContext;
  }

  function l7PlayTone(frequency,duration=0.24){
    const ctx=l7ToneContext();if(!ctx)return;
    try{
      ctx.resume?.();
      const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
      osc.type='sine';osc.frequency.value=Number(frequency)||440;
      gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.15,now+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+duration+0.03);
    }catch(_){}
  }

  function renderToneSequencePuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,sequence=payload.sequence||[],freqs=payload.frequencies||[];
    const wrap=document.createElement('div');wrap.className='toneSequenceWrap';
    const replay=document.createElement('button');replay.type='button';replay.className='toneReplay';renderExact(replay,'Play pattern',{sitelen:false});
    const progress=document.createElement('div');progress.className='toneProgress';
    progress.textContent=(st.input||[]).map(()=> '●').join(' ') + ((st.input||[]).length<sequence.length?' ○'.repeat(Math.max(0,sequence.length-(st.input||[]).length)):'');
    const pads=document.createElement('div');pads.className='tonePads';

    const flash=(index)=>{
      const btn=pads.querySelector(`[data-tone-index="${index}"]`);if(!btn)return;
      btn.classList.add('active');window.setTimeout(()=>btn.classList.remove('active'),220);
    };
    const playOne=index=>{l7PlayTone(freqs[index]||440);flash(index);};

    replay.addEventListener('click',()=>{
      if(st.playing)return;
      st.playing=true;replay.disabled=true;const serial=++l7TonePlaybackSerial;
      sequence.forEach((index,i)=>window.setTimeout(()=>{
        if(serial!==l7TonePlaybackSerial)return;
        playOne(Number(index));
        if(i===sequence.length-1)window.setTimeout(()=>{if(serial===l7TonePlaybackSerial){st.playing=false;replay.disabled=false;}},300);
      },i*420));
    });

    for(let index=0;index<freqs.length;index++){
      const btn=document.createElement('button');btn.type='button';btn.className='tonePad';btn.dataset.toneIndex=String(index);
      // Resonance pads are physical nanpa-linja-n artefacts: always show the bare
      // digit glyph itself, independent of UI language. Do not wrap these pad
      // identifiers in numeric cartouches or duplicate them as decimal numerals.
      const glyph=document.createElement('span');
      renderBareNanpaDigits(glyph,index+1,{className:'tonePadNumber'});
      const label=document.createElement('small');renderLocalized(label,isTpLanguage()?'kalama':'tone');
      btn.setAttribute('aria-label',`${isTpLanguage()?'kalama':'tone'} ${index+1}`);
      btn.append(glyph,label);
      btn.addEventListener('click',()=>{
        if(st.playing||st.solved)return;
        playOne(index);st.input=Array.from(st.input||[]);st.input.push(index);
        const at=st.input.length-1;
        if(Number(sequence[at])!==index){
          st.input=[];st.message='That was not the pattern. Replay it and try again.';blockedTone();
        }else if(st.input.length===sequence.length){
          st.solved=true;st.message='The full pattern matches.';successTone();
        }else st.message=`${st.input.length} of ${sequence.length} tones matched.`;
        renderCampaignPuzzle();
      });
      pads.appendChild(btn);
    }
    wrap.append(replay,progress,pads);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The resonance pattern is correct. Press Try answer to confirm the hall.':(st.message||'Play the pattern, then repeat all five tones.'));
  }

  function renderAirflowNetworkPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,width=Number(payload.width)||4,height=Number(payload.height)||4;
    const tiles=payload.tiles||[],connection=airflowConnectivity(puzzle,st),byPos=new Map();
    tiles.forEach((tile,index)=>byPos.set(`${tile.x},${tile.y}`,{tile,index}));
    const wrap=document.createElement('div');wrap.className='airflowWrap';
    const grid=document.createElement('div');grid.className='airflowGrid';grid.style.setProperty('--air-cols',String(width));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const item=byPos.get(`${x},${y}`);
      if(!item){const empty=document.createElement('div');empty.className='airflowTile empty';grid.appendChild(empty);continue;}
      const rot=Number(st.rotations?.[item.index])||0,btn=document.createElement('button');btn.type='button';
      btn.className=`airflowTile${connection.connected.has(`${x},${y}`)?' connected':''}`;
      btn.textContent=airflowTileSymbol(item.tile.type,rot);
      if(x===Number(payload.source?.x)&&y===Number(payload.source?.y))btn.dataset.edge='IN';
      const sinkIndex=(payload.sinks||[]).findIndex(sink=>Number(sink.x)===x&&Number(sink.y)===y);
      if(sinkIndex>=0)btn.dataset.edge=`OUT ${sinkIndex+1}`;
      btn.setAttribute('aria-label',`Rotate duct at column ${x+1}, row ${y+1}${btn.dataset.edge?`, ${btn.dataset.edge}`:''}`);
      btn.addEventListener('click',()=>{
        const mod=item.tile.type==='straight'?2:4;st.rotations[item.index]=(rot+1)%mod;renderCampaignPuzzle();
      });
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'Both outlet vents have airflow. Press Try answer to confirm the gallery.':'Rotate the branch network until both OUT vents are connected to IN.');
  }

  function renderPulseSyncPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,periods=payload.periods||[],columns=Math.max(6,Number(payload.columns)||12),target=Number(payload.targetColumn)||0;
    const wrap=document.createElement('div');wrap.className='pulseSyncWrap';
    const board=document.createElement('div');board.className='pulseBoard';
    periods.forEach((period,laneIndex)=>{
      const lane=document.createElement('div');lane.className='pulseLane';
      const controls=document.createElement('div');controls.className='pulseControls';
      const left=document.createElement('button');left.type='button';left.textContent='←';left.setAttribute('aria-label',`Shift lane ${laneIndex+1} left and lane ${(laneIndex+1)%periods.length+1} right`);
      const label=mechanismNumberNode(laneIndex+1,'pulseLaneLabel');
      const right=document.createElement('button');right.type='button';right.textContent='→';right.setAttribute('aria-label',`Shift lane ${laneIndex+1} right and lane ${(laneIndex+1)%periods.length+1} left`);
      const shift=dir=>{
        const next=(laneIndex+1)%periods.length;
        st.phases[laneIndex]=((Number(st.phases[laneIndex])+dir)%Number(period)+Number(period))%Number(period);
        st.phases[next]=((Number(st.phases[next])-dir)%Number(periods[next])+Number(periods[next]))%Number(periods[next]);
        st.moves=(Number(st.moves)||0)+1;renderCampaignPuzzle();
      };
      left.addEventListener('click',()=>shift(-1));right.addEventListener('click',()=>shift(1));
      controls.append(left,label,right);

      const cells=document.createElement('div');cells.className='pulseCells';cells.style.setProperty('--pulse-cols',String(columns));
      for(let col=0;col<columns;col++){
        const cell=document.createElement('span');cell.className=`pulseCell${col===target?' gate':''}${pulseLaneHasGate(period,st.phases[laneIndex],col)?' on':''}`;
        cell.setAttribute('aria-hidden','true');cells.appendChild(cell);
      }
      lane.append(controls,cells);board.appendChild(lane);
    });
    const note=document.createElement('div');note.className='pulseNote';renderExact(note,`moves: ${Number(st.moves)||0} · each arrow shifts this lane and the next lane in opposite directions`);
    wrap.append(board,note);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All three pulse lanes meet at the gate. Press Try answer to confirm the chamber.':'Line up a pulse from every lane in the vertical gate.');
  }

  function renderSpectrumOrderPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,filters=payload.filters||[];
    const info=new Map(filters.map(x=>[x.id,x]));
    const wrap=document.createElement('div');wrap.className='spectrumWrap';
    const clues=document.createElement('div');clues.className='spectrumClues';
    (payload.clues||[]).forEach((text,index)=>{const row=document.createElement('div');row.className='spectrumClue';renderLocalized(row,`${index+1}. ${exactText(text)}`);clues.appendChild(row);});
    const row=document.createElement('div');row.className='spectrumFilters';
    (st.order||[]).forEach((id,index)=>{
      const spec=info.get(id)||{id,label:id},btn=document.createElement('button');btn.type='button';
      btn.className=`spectrumFilter spectrumFilter--${id}${Number(st.selected)===index?' selected':''}`;
      const swatch=document.createElement('span');swatch.className='spectrumSwatch';swatch.setAttribute('aria-hidden','true');
      const label=document.createElement('span');renderLocalized(label,isTpLanguage()?`[[${termLabelText(spec.label||id)}]]`:(spec.label||id));btn.append(swatch,label);
      btn.addEventListener('click',()=>{
        if(st.selected==null){st.selected=index;renderCampaignPuzzle();return;}
        if(Number(st.selected)===index){st.selected=null;renderCampaignPuzzle();return;}
        const a=Number(st.selected);[st.order[a],st.order[index]]=[st.order[index],st.order[a]];
        st.selected=null;st.swaps=(Number(st.swaps)||0)+1;renderCampaignPuzzle();
      });
      row.appendChild(btn);
    });
    wrap.append(clues,row);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'Every spectrum clue is satisfied. Press Try answer to confirm the laboratory.':st.selected==null?'Use the clues; select two filters to swap them.':'Select the second filter to swap.');
  }

  function renderPowerBalancePuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,loads=payload.loads||[],target=Number(payload.target)||0,current=powerBalanceSum(puzzle,st);
    const wrap=document.createElement('div');wrap.className='powerBalanceWrap';
    const meters=document.createElement('div');meters.className='powerMeters';
    const makeMeter=(label,value)=>{
      const box=document.createElement('div');box.className='powerMeter';
      const lab=document.createElement('strong');lab.textContent=label;
      const canvas=document.createElement('canvas');canvas.width=250;canvas.height=70;canvas.className='powerMeterCanvas';
      box.append(lab,canvas);renderNanpaSourceToCanvas(String(value),canvas,36);return box;
    };
    meters.append(makeMeter('target',target),makeMeter('active',current));
    const breakers=document.createElement('div');breakers.className='powerBreakers';
    loads.forEach((load,index)=>{
      const btn=document.createElement('button');btn.type='button';btn.className=`powerBreaker${st.selected?.[index]?' on':''}`;
      const lamp=document.createElement('span');lamp.className='powerBreakerLamp';lamp.setAttribute('aria-hidden','true');
      const canvas=document.createElement('canvas');canvas.width=180;canvas.height=62;canvas.className='powerBreakerCanvas';
      btn.append(lamp,canvas);renderNanpaSourceToCanvas(String(load),canvas,31);
      btn.setAttribute('aria-label',`${st.selected?.[index]?'Disable':'Enable'} breaker load ${load}`);
      btn.addEventListener('click',()=>{st.selected[index]=!st.selected[index];renderCampaignPuzzle();});
      breakers.appendChild(btn);
    });
    wrap.append(meters,breakers);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The active load exactly matches the target. Press Try answer to confirm the substation.':current>target?'The active load is above the target.':'Choose breakers whose loads add exactly to the target.');
  }


  function renderOrderConstraintPuzzle(puzzle,{tokensKey='tokens',clueClass='deductionClues',rowClass='deductionTokens'}={}){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,tokens=payload[tokensKey]||[];
    const wrap=document.createElement('div');wrap.className='deductionWrap';
    const clues=document.createElement('div');clues.className=clueClass;
    (payload.clues||[]).forEach((text,index)=>{
      const row=document.createElement('div');row.className='deductionClue';renderLocalized(row,`${index+1}. ${exactText(text)}`);clues.appendChild(row);
    });
    const order=document.createElement('div');order.className=rowClass;
    (st.order||tokens).forEach((word,index)=>{
      const btn=document.createElement('button');btn.type='button';btn.className=`deductionToken${Number(st.selected)===index?' selected':''}`;
      const slot=document.createElement('span');slot.className='deductionSlot';renderMechanismNumber(slot,index+1);
      const glyph=document.createElement('span');glyph.className='deductionGlyph sitelenGlyph';glyph.textContent=glyphChar(word);
      const label=document.createElement('span');label.className='deductionLabel';label.textContent=word;
      btn.append(slot,glyph,label);
      btn.addEventListener('click',()=>{
        if(st.selected==null){st.selected=index;renderCampaignPuzzle();return;}
        if(Number(st.selected)===index){st.selected=null;renderCampaignPuzzle();return;}
        const a=Number(st.selected);[st.order[a],st.order[index]]=[st.order[index],st.order[a]];
        st.selected=null;st.swaps=(Number(st.swaps)||0)+1;renderCampaignPuzzle();
      });
      order.appendChild(btn);
    });
    wrap.append(clues,order);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'Every constraint is satisfied. Press Try answer to confirm the station.':st.selected==null?'Use all clues together; select two tokens to swap them.':'Select the second token to swap.');
  }

  function renderDeductionOrderPuzzle(puzzle){renderOrderConstraintPuzzle(puzzle,{tokensKey:'tokens',clueClass:'deductionClues',rowClass:'deductionTokens'});}

  function renderDualMirrorPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,width=Number(payload.width)||5,height=Number(payload.height)||5,mirrors=payload.mirrors||[];
    const wrap=document.createElement('div');wrap.className='dualMirrorWrap';
    const legend=document.createElement('div');legend.className='dualMirrorLegend';
    const beamLabels=(payload.sources||[]).map((source,index)=>source.label||String.fromCharCode(65+index));
    renderLocalized(legend,isTpLanguage()?`linja ${beamLabels.join(', ')} ale li jo e open wan e pini sama wan. o sike e ilo lukin / ↔ \\.`:`${beamLabels.join(', ')} each have one inlet and one matching outlet. Rotate mirrors / ↔ \\.`);
    const board=document.createElement('div');board.className='dualMirrorBoard';board.style.setProperty('--mirror-cols',String(width));board.style.setProperty('--mirror-rows',String(height));

    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','dualMirrorBeams');svg.setAttribute('viewBox',`-50 -50 ${width*100+100} ${height*100+100}`);svg.setAttribute('aria-hidden','true');
    (payload.sources||[]).forEach((source,index)=>{
      const trace=dualMirrorTrace(puzzle,st,index),poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
      poly.setAttribute('class',`dualMirrorBeam beam${index+1}`);
      poly.setAttribute('points',trace.points.map(p=>`${p.x*100},${p.y*100}`).join(' '));
      svg.appendChild(poly);
    });
    const edgePoint=(edge,index)=>{
      if(edge==='W')return {x:-20,y:(index+.5)*100};
      if(edge==='E')return {x:width*100+20,y:(index+.5)*100};
      if(edge==='N')return {x:(index+.5)*100,y:-20};
      return {x:(index+.5)*100,y:height*100+20};
    };
    for(const group of [['sources','IN'],['targets','OUT']]){
      (payload[group[0]]||[]).forEach((item,index)=>{
        const p=edgePoint(item.edge,Number(item.index)||0),text=document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('class',`dualMirrorEdgeLabel ${group[1].toLowerCase()}`);text.setAttribute('x',String(p.x));text.setAttribute('y',String(p.y));text.textContent=`${item.label||String.fromCharCode(65+index)} ${group[1]}`;svg.appendChild(text);
      });
    }
    board.appendChild(svg);

    const mirrorMap=new Map(mirrors.map((m,i)=>[`${m.x},${m.y}`,i]));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const cell=document.createElement('div');cell.className='dualMirrorCell';
      const mi=mirrorMap.get(`${x},${y}`);
      if(mi!=null){
        const btn=document.createElement('button');btn.type='button';btn.className='dualMirrorMirror';
        btn.textContent=Number(st.orientations?.[mi])===0?'/':'\\';
        btn.setAttribute('aria-label',`Rotate mirror ${mi+1} at column ${x+1}, row ${y+1}`);
        btn.addEventListener('click',()=>{st.orientations[mi]=Number(st.orientations[mi])===0?1:0;renderCampaignPuzzle();});
        cell.appendChild(btn);
      }
      board.appendChild(cell);
    }
    wrap.append(legend,board);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All beams reach their matching exits. Press Try answer to confirm the array.':`${(payload.sources||[]).length} beams must reach their matching OUT markers simultaneously.`);
  }

  function renderTruthGatesPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,options=payload.gateOptions||['AND','OR','XOR'],rows=payload.rows||[];
    const gates=st.gates||[];
    const currentOutputs=rows.map(row=>truthGateOutput(gates,row));
    const rowMatches=rows.map((row,index)=>currentOutputs[index]===Number(row.y));
    const matchCount=rowMatches.filter(Boolean).length;
    const solved=rows.length>0&&matchCount===rows.length;
    const wrap=document.createElement('div');wrap.className=`truthGateWrap${solved?' solved':''}`;
    const diagram=document.createElement('div');diagram.className='truthGateDiagram';
    const labels=['G1: A,B','G2: B,C','G3: G1,G2'];
    for(let i=0;i<3;i++){
      const gate=document.createElement('button');gate.type='button';gate.className=`truthGateSelect gate-${String(gates[i]||options[0]).toLowerCase()}`;
      const label=document.createElement('small');label.textContent=labels[i];
      const value=document.createElement('strong');value.textContent=gates[i]||options[0];
      gate.append(label,value);
      gate.setAttribute('aria-label',`${labels[i]} is ${value.textContent}. Tap to change gate.`);
      gate.addEventListener('click',()=>{
        clearTutorialSubmissionFeedback();
        const current=options.indexOf(st.gates[i]);st.gates[i]=options[(current+1+options.length)%options.length];renderCampaignPuzzle();
      });
      diagram.appendChild(gate);
    }
    const table=document.createElement('div');table.className='truthTable';
    const heads=['A','B','C',isTpLanguage()?'Y wile':'Y target',isTpLanguage()?'Y ni':'Y now'];
    for(const head of heads){const h=document.createElement('strong');h.textContent=head;table.appendChild(h);}
    rows.forEach((row,rowIndex)=>{
      const match=rowMatches[rowIndex];
      const values=[row.a,row.b,row.c,row.y,currentOutputs[rowIndex]];
      values.forEach((value,colIndex)=>{
        const classes=['truthBit'];
        if(colIndex===3)classes.push('truthTargetBit');
        if(colIndex===4)classes.push('truthCurrentBit',match?'match':'mismatch');
        const cell=mechanismNumberNode(Number(value),classes.join(' '));
        if(colIndex===4) cell.setAttribute('aria-label',`Row ${rowIndex+1}: current output ${Number(value)}, target ${Number(row.y)}, ${match?'match':'mismatch'}`);
        table.appendChild(cell);
      });
    });
    const progress=document.createElement('div');progress.className=`truthGateProgress${solved?' solved':''}`;
    if(isTpLanguage()) renderLocalized(progress,`linja pona: ${matchCount} / ${rows.length}${solved?' · ale li pona; o luka e [[o alasa]].':''}`);
    else progress.textContent=`${matchCount} / ${rows.length} rows match${solved?' — grid solved; press Try answer to confirm.':''}`;
    const key=document.createElement('div');key.className='truthGateKey';renderExact(key,'AND: both · OR: either · XOR: different');
    wrap.append(diagram,table,progress,key);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,'','Choose gates and watch the Y now column. Make every row match Y target, then press Try answer.');
  }

  function renderDependencyOrderPuzzle(puzzle){renderOrderConstraintPuzzle(puzzle,{tokensKey:'tasks',clueClass:'dependencyClues',rowClass:'dependencyTokens'});}

  function renderExactPathPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,width=Number(payload.width)||4,height=Number(payload.height)||4,values=payload.values||[],path=st.path||[];
    const wrap=document.createElement('div');wrap.className='exactPathWrap';
    const meters=document.createElement('div');meters.className='exactPathMeters';
    const makeMeter=(label,value)=>{
      const box=document.createElement('div');box.className='exactPathMeter';
      const lab=document.createElement('strong');lab.textContent=label;
      const canvas=document.createElement('canvas');canvas.width=220;canvas.height=60;canvas.className='exactPathMeterCanvas';
      box.append(lab,canvas);renderNanpaSourceToCanvas(String(value),canvas,31);return box;
    };
    const currentSum=exactPathSum(puzzle,st);
    meters.append(makeMeter('target sum',payload.targetSum),makeMeter('path sum',currentSum));

    const grid=document.createElement('div');grid.className='exactPathGrid';grid.style.setProperty('--path-cols',String(width));
    const pathIndex=new Map(path.map((pos,i)=>[`${pos[0]},${pos[1]}`,i]));
    const last=path[path.length-1]||payload.start||[0,0],end=payload.end||[width-1,height-1];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const key=`${x},${y}`,idx=pathIndex.get(key),btn=document.createElement('button');btn.type='button';
      btn.className=`exactPathCell${idx!=null?' visited':''}${idx===path.length-1?' current':''}${x===Number(end[0])&&y===Number(end[1])?' exit':''}`;
      const step=document.createElement('span');step.className='exactPathStep';if(idx!=null)renderBareNanpaDigits(step,idx+1,{className:'exactPathBareStep'});
      const glyph=document.createElement('span'); glyph.className='exactPathValue'; renderBareNanpaDigits(glyph,Number(values?.[y]?.[x])||0,{className:'exactPathBareValue'});
      btn.append(step,glyph);
      const dist=Math.abs(x-Number(last[0]))+Math.abs(y-Number(last[1])),canMove=dist===1&&idx==null&&path.length<Number(payload.moves)+1;
      btn.disabled=!canMove;
      btn.setAttribute('aria-label',`Cell column ${x+1}, row ${y+1}, value ${values?.[y]?.[x]}`);
      if(canMove)btn.addEventListener('click',()=>{st.path.push([x,y]);st.message='';renderCampaignPuzzle();});
      grid.appendChild(btn);
    }
    const controls=document.createElement('div');controls.className='exactPathControls';
    const undo=document.createElement('button');undo.type='button';renderExact(undo,'Undo last move',{sitelen:false});undo.disabled=path.length<=1;undo.addEventListener('click',()=>{if(st.path.length>1)st.path.pop();st.message='';renderCampaignPuzzle();});
    const reset=document.createElement('button');reset.type='button';renderExact(reset,'Restart route',{sitelen:false});reset.addEventListener('click',()=>{st.path=[Array.from(payload.start||[0,0])];st.message='';renderCampaignPuzzle();});
    controls.append(undo,reset);
    wrap.append(meters,grid,controls);puzzleSlots.appendChild(wrap);
    const movesUsed=Math.max(0,path.length-1),atEnd=Number(last[0])===Number(end[0])&&Number(last[1])===Number(end[1]);
    let status=`${movesUsed} of ${payload.moves} moves used.`;
    if(mechanismSolved(puzzle))status='Exact route and total achieved. Press Try answer to confirm the vault.';
    else if(path.length===Number(payload.moves)+1)status=`Route complete, but ${atEnd?'the total is wrong':'you did not finish at the exit'}. Undo or restart.`;
    else if(atEnd)status='You reached the exit too early. Undo and find an eight-move route.';
    setMechanismStatus(puzzle,status);
  }


  function renderSphinxRiddlesPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,riddles=payload.riddles||[];
    const order=Array.isArray(st.riddleOrder)&&st.riddleOrder.length?st.riddleOrder:Array.from({length:Math.min(Number(payload.selectCount)||riddles.length,riddles.length)},(_,i)=>i);
    const stage=Math.min(Number(st.stage)||0,Math.max(0,order.length-1)),riddleIndex=Number(order[stage])||0,riddle=riddles[riddleIndex];
    const choices=Array.isArray(st.choiceOrders?.[stage])&&st.choiceOrders[stage].length?st.choiceOrders[stage]:(riddle?.choices||[]);
    const wrap=document.createElement('div');wrap.className='sphinxWrap';
    const crest=document.createElement('div');crest.className='sphinxCrest sitelenGlyph';crest.textContent=glyphChar('seme');
    const progress=document.createElement('div');progress.className='sphinxProgress';renderExact(progress,`memory ${Math.min(stage+1,order.length)} / ${order.length} · mistakes ${Number(st.mistakes)||0}`);
    const text=document.createElement('div');text.className='sphinxRiddle';renderExact(text,riddle?.text||'');
    const choicesEl=document.createElement('div');choicesEl.className='sphinxChoices';
    choices.forEach(word=>{
      const btn=document.createElement('button');btn.type='button';btn.className='sphinxChoice';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(word);
      btn.appendChild(glyph);btn.title=word;btn.setAttribute('aria-label',`answer ${word}`);
      btn.addEventListener('click',()=>{
        if(st.solved)return;
        if(word===riddle.answer){
          if(stage>=order.length-1){st.solved=true;st.message='All three memories are answered.';successTone();}
          else {st.stage=stage+1;st.message='Correct. The Sphinx recalls another chamber.';softTone();}
        }else{
          st.stage=0;st.mistakes=(Number(st.mistakes)||0)+1;st.message='Wrong. The Sphinx returns you to the first memory.';blockedTone();
        }
        renderCampaignPuzzle();
      });
      choicesEl.appendChild(btn);
    });
    wrap.append(crest,progress,text,choicesEl);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The Sphinx yields. Press Try answer to confirm the court mechanism.':(st.message||'Recall what you did earlier and choose the matching glyph.'));
  }

  function renderCoupledSwitchesPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,target=payload.target||[],masks=payload.masks||[];
    const wrap=document.createElement('div');wrap.className='coupledSwitchWrap';
    const rows=document.createElement('div');rows.className='coupledLampRows';
    const makeRow=(label,values,current=false)=>{
      const row=document.createElement('div');row.className='coupledLampRow';row.style.setProperty('--coupled-cols',String(Math.max(1,values.length)));
      const lab=document.createElement('strong');lab.textContent=label;row.appendChild(lab);
      values.forEach((value,index)=>{
        const lamp=document.createElement('span');lamp.className=`coupledLamp${Number(value)?' on':''}`;
        renderMechanismNumber(lamp,index+1);row.appendChild(lamp);
      });
      return row;
    };
    rows.append(makeRow(isTpLanguage()?'pona':'safe',target,false),makeRow(isTpLanguage()?'nasin':'route',st.lamps||[],true));
    const levers=document.createElement('div');levers.className='coupledLevers';
    masks.forEach((mask,index)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='coupledLever';
      const glyph=mechanismNumberNode(index+1,'coupledLeverNumber');
      const info=document.createElement('small');renderExact(info,`flips ${(mask||[]).map(i=>Number(i)+1).join(' · ')}`);
      btn.append(glyph,info);
      btn.addEventListener('click',()=>{
        st.lamps=Array.from(st.lamps||[]);for(const lampIndex of mask||[])st.lamps[lampIndex]=st.lamps[lampIndex]?0:1;
        st.moves=(Number(st.moves)||0)+1;renderCampaignPuzzle();
      });
      levers.appendChild(btn);
    });
    const note=document.createElement('div');note.className='coupledSwitchNote';renderExact(note,`moves: ${Number(st.moves)||0}`);
    wrap.append(rows,levers,note);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The route pattern is safe. Press Try answer to confirm the shaft control.':'Match every route lamp to the safe pattern.');
  }

  function renderLayerAlignmentPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,size=Math.max(2,Number(payload.size)||5),layers=payload.layers||[],target=payload.targetMarkers||{};
    const wrap=document.createElement('div');wrap.className='layerAlignWrap';
    const targetBox=document.createElement('div');targetBox.className='layerTargetSummary';
    renderExact(targetBox,'Targets: '+Object.entries(target).map(([label,pos])=>`${label}→(${Number(pos[0])+1},${Number(pos[1])+1})`).join(' · '));
    const stack=document.createElement('div');stack.className='layerAlignStack';

    layers.forEach((layer,index)=>{
      const unit=document.createElement('div');unit.className='layerAlignUnit';
      const head=document.createElement('div');head.className='layerAlignHead';
      const left=document.createElement('button');left.type='button';left.textContent='↶';left.setAttribute('aria-label',`Rotate ${layer.label||layer.id} floor counter-clockwise`);
      const label=document.createElement('strong');renderExact(label,layer.label||layer.id||`floor ${index+1}`);
      const right=document.createElement('button');right.type='button';right.textContent='↷';right.setAttribute('aria-label',`Rotate ${layer.label||layer.id} floor clockwise`);
      left.addEventListener('click',()=>{st.rotations[index]=(Number(st.rotations[index])+3)%4;renderCampaignPuzzle();});
      right.addEventListener('click',()=>{st.rotations[index]=(Number(st.rotations[index])+1)%4;renderCampaignPuzzle();});
      head.append(left,label,right);

      const grid=document.createElement('div');grid.className='layerAlignGrid';grid.style.setProperty('--layer-size',String(size));
      const currentMarkers={};
      for(const [marker,pos] of Object.entries(layer.markers||{}))currentMarkers[marker]=rotateLayerPoint(pos,st.rotations[index],size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const cell=document.createElement('span');cell.className='layerAlignCell';
        const targetMarker=Object.entries(target).find(([,pos])=>Number(pos[0])===x&&Number(pos[1])===y)?.[0];
        if(targetMarker)cell.classList.add('target');
        const actualMarker=Object.entries(currentMarkers).find(([,pos])=>Number(pos[0])===x&&Number(pos[1])===y)?.[0];
        if(actualMarker){
          const mark=document.createElement('b');mark.className=`layerMarker layerMarker--${actualMarker.toLowerCase()}`;mark.textContent=actualMarker;
          if(targetMarker===actualMarker)mark.classList.add('aligned');
          cell.appendChild(mark);
        }
        grid.appendChild(cell);
      }
      const rot=document.createElement('small');rot.className='layerRotation';renderExact(rot,`quarter-turns: ${Number(st.rotations[index])||0}`);
      unit.append(head,grid,rot);stack.appendChild(unit);
    });
    wrap.append(targetBox,stack);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All three floors align on shafts A, B and C. Press Try answer to confirm the vault.':'Rotate each floor until every A, B and C marker occupies its matching target.');
  }


  function centsText(value){
    return (Number(value||0)/100).toFixed(2);
  }

  function renderMarketTillPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,sum=marketTillSum(puzzle,st),target=Number(payload.targetCents)||0;
    const wrap=document.createElement('div');wrap.className='marketTillWrap';
    const cards=document.createElement('div');cards.className='marketTillCards';
    (payload.items||[]).forEach(item=>{
      const card=document.createElement('div');card.className='marketTillCard';
      const headRow=document.createElement('div');headRow.className='marketTillHead';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(item.word);
      const copy=document.createElement('div');copy.className='marketTillCopy';
      const head=document.createElement('strong');head.textContent=item.word;
      const detail=document.createElement('div');renderLocalized(detail,item.discount?`${item.price} {{−}} ${item.discount} {{=}} ${item.final}`:`${item.price}`,{sitelen:isTpLanguage()});
      copy.append(head,detail);headRow.append(glyph,copy);
      const frame=document.createElement('div');frame.className='marketTillCartoucheFrame';
      const c=document.createElement('canvas');c.width=320;c.height=82;c.className='marketTillCanvas';frame.appendChild(c);
      card.append(headRow,frame);cards.appendChild(card);
      renderNanpaSourceToCanvas(item.final||item.price,c,38);
    });
    const targetBox=document.createElement('div');targetBox.className='marketTillTarget';
    const targetLabel=document.createElement('strong');renderExact(targetLabel,'exact total');
    const targetFrame=document.createElement('div');targetFrame.className='marketTillCartoucheFrame marketTillCartoucheFrame--target';
    const tc=document.createElement('canvas');tc.width=420;tc.height=92;tc.className='marketTillCanvas';targetFrame.appendChild(tc);targetBox.append(targetLabel,targetFrame);renderNanpaSourceToCanvas(centsText(target),tc,42);
    const tokens=document.createElement('div');tokens.className='marketTillTokens';
    (payload.tokens||[]).forEach((cents,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`marketToken${st.selected[index]?' selected':''}`;
      renderMechanismNumber(b,centsText(cents));b.setAttribute('aria-pressed',String(Boolean(st.selected[index])));
      b.addEventListener('click',()=>{st.selected[index]=!st.selected[index];renderCampaignPuzzle();});tokens.appendChild(b);
    });
    const read=document.createElement('div');read.className=`marketTillReadout${sum===target?' exact':''}`;renderExact(read,`payment ${centsText(sum)} / ${centsText(target)}`);
    wrap.append(cards,targetBox,tokens,read);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,sum===target?'Exact payment. Press Try answer to confirm the till to power the freight spine.':sum>target?'Payment is too high. Remove a mani token.':'Payment is too low. Add mani tokens.');
  }

  function signedOneDecimal(value){
    const n=Number(value)||0;return `${n>=0?'+':''}${n.toFixed(1)}`;
  }

  function renderColdChainPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,readings=l10ColdReadings(st),want=payload.targetReadings||{};
    const wrap=document.createElement('div');wrap.className='coldChainWrap';
    const controls=document.createElement('div');controls.className='coldControls';
    ['compressor A','valve B','gel pump C'].forEach((label,index)=>{
      const b=document.createElement('button');b.type='button';b.className='coldControl';
      const controlName=document.createElement('strong');controlName.textContent=label;
      const setting=document.createElement('span');renderExact(setting,`setting ${Number(st.controls[index])||0}`);
      b.append(controlName,setting);
      b.addEventListener('click',()=>{st.controls[index]=((Number(st.controls[index])||0)+1)%3;renderCampaignPuzzle();});controls.appendChild(b);
    });
    const gauges=document.createElement('div');gauges.className='coldGauges';
    [['freezer','freezer'],['chilled store','chill'],['gel loop','gel']].forEach(([label,key])=>{
      const ok=Math.abs(Number(readings[key])-Number(want[key]))<1e-9;
      const box=document.createElement('div');box.className=`coldGauge${ok?' matched':''}`;
      const h=document.createElement('strong');h.textContent=label;
      const c=document.createElement('canvas');c.width=230;c.height=62;c.className='coldGaugeCanvas';
      const small=document.createElement('small');renderExact(small,`target ${signedOneDecimal(want[key])}`);
      box.append(h,c,small);gauges.appendChild(box);renderNanpaSourceToCanvas(signedOneDecimal(readings[key]),c,34);
    });
    wrap.append(controls,gauges);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,l10ColdSolved(puzzle,st)?'All three readings are stable. Press Try answer to confirm the cold-chain controller.':'Adjust the coupled controls until all three readings match their targets simultaneously.');
  }

  function renderTextileMixerPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    const wrap=document.createElement('div');wrap.className='textileMixerWrap';
    const formula=document.createElement('div');formula.className='textileFormula';
    const laso=document.createElement('span');laso.className='sitelenGlyph';laso.textContent=glyphChar('laso');
    const dye=document.createElement('strong');renderMechanismNumber(dye,'50%');
    const plus1=document.createElement('span');renderLocalized(plus1,'{{+}}',{sitelen:isTpLanguage()});
    const water=document.createElement('strong');renderLocalized(water,isTpLanguage()?'25% telo':'25% water',{sitelen:isTpLanguage()});
    const plus2=document.createElement('span');renderLocalized(plus2,'{{+}}',{sitelen:isTpLanguage()});
    const binder=document.createElement('strong');renderLocalized(binder,isTpLanguage()?'25% ko':'25% binder',{sitelen:isTpLanguage()});
    formula.append(laso,dye,plus1,water,plus2,binder);
    const options=document.createElement('div');options.className='textileRatioOptions';
    (payload.options||[]).forEach((values,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`textileRatio${Number(st.selectedIndex)===index?' selected':''}`;
      if(isTpLanguage()){
        values.forEach((value,partIndex)=>{if(partIndex){const sep=document.createElement('span');renderLocalized(sep,'{{:}}',{sitelen:true});b.appendChild(sep);}b.appendChild(mechanismNumberNode(value,'textileRatioNumber'));});
      } else b.textContent=values.join(' : ');
      b.addEventListener('click',()=>{st.selectedIndex=index;renderCampaignPuzzle();});options.appendChild(b);
    });
    wrap.append(formula,options);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,st.selectedIndex==null?'Choose the ratio matching 50% : 25% : 25%.':mechanismSolved(puzzle)?'The dye bath is 2:1:1. Press Try answer to confirm the mixer.':'That ratio does not match the batch card.');
    puzzleCompleteBtn.disabled=false;
  }


  function renderCallTriangulationPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,width=Number(payload.width)||5,height=Number(payload.height)||5,sensors=payload.sensors||[];
    const wrap=document.createElement('div');wrap.className='callTriangWrap';
    const legend=document.createElement('div');legend.className='callTriangLegend';
    sensors.forEach(sensor=>{
      const card=document.createElement('div');card.className='callTriangSensor';
      const id=document.createElement('strong');id.textContent=sensor.id;id.title=`pylon ${sensor.id}`;
      const reading=document.createElement('div');reading.className='callTriangReading';
      const dist=mechanismNumberNode(sensor.distance,'callTriangDistanceGlyph');
      const lab=document.createElement('small');renderExact(lab,'grid steps');
      reading.append(dist,lab);card.append(id,reading);legend.appendChild(card);
    });
    const grid=document.createElement('div');grid.className='callTriangGrid';grid.style.setProperty('--tri-cols',String(width));
    const sensorAt=new Map(sensors.map(sensor=>[`${sensor.x},${sensor.y}`,sensor]));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const sensor=sensorAt.get(`${x},${y}`),selected=Array.isArray(st.selected)&&Number(st.selected[0])===x&&Number(st.selected[1])===y;
      const btn=document.createElement('button');btn.type='button';btn.className=`callTriangCell${sensor?' sensor':''}${selected?' selected':''}`;
      const coord=document.createElement('small');coord.className='callTriangCoord';coord.textContent=`${String.fromCharCode(65+x)}${String.fromCharCode(65+y)}`;
      const main=document.createElement('span');main.className=sensor?'callTriangPylon':'callTriangDot';main.textContent=sensor?sensor.id:'·';
      btn.append(coord,main);btn.setAttribute('aria-label',`map cell ${String.fromCharCode(65+x)} ${y+1}${sensor?`, pylon ${sensor.id}`:''}`);
      btn.addEventListener('click',()=>{st.selected=[x,y];renderCampaignPuzzle();});grid.appendChild(btn);
    }
    wrap.append(legend,grid);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,st.selected==null?'Select the one cell matching all three pylon distances.':mechanismSolved(puzzle)?'All three recorded distances intersect here. Press Try answer to confirm the canopy route.':'That cell does not satisfy all three distances.');
    puzzleCompleteBtn.disabled=false;
  }

  function renderLineageMatchPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,pairs=payload.pairs||[],hatchlings=payload.hatchlings||[],constraints=payload.constraints||[];
    const wrap=document.createElement('div');wrap.className='lineageWrap';
    const pairGrid=document.createElement('div');pairGrid.className='lineagePairs';
    pairs.forEach(pair=>{
      const card=document.createElement('div');card.className='lineagePair';
      const head=document.createElement('strong');renderExact(head,`pair ${pair.id}`);card.appendChild(head);
      const traits=document.createElement('div');traits.className='lineageTraits';
      (pair.traits||[]).forEach(word=>{const g=document.createElement('span');g.className='sitelenGlyph';g.textContent=glyphChar(word);g.title=word;traits.appendChild(g);});
      card.appendChild(traits);pairGrid.appendChild(card);
    });
    const evidence=document.createElement('div');evidence.className='lineageEvidence';
    const evidenceHead=document.createElement('strong');renderExact(evidenceHead,'cross-record observations');evidence.appendChild(evidenceHead);
    const evidenceList=document.createElement('ul');
    constraints.forEach(c=>{const li=document.createElement('li');renderExact(li,c.text||'');evidenceList.appendChild(li);});
    const once=document.createElement('li');renderExact(once,'Every parent pair A–D is used exactly once.');evidenceList.appendChild(once);evidence.appendChild(evidenceList);
    const rows=document.createElement('div');rows.className='lineageRows';
    hatchlings.forEach((h,index)=>{
      const row=document.createElement('div');row.className='lineageRow';
      const info=document.createElement('div');info.className='lineageHatchling';
      const label=document.createElement('strong');renderExact(label,`hatchling ${h.id}`);
      const traits=document.createElement('div');traits.className='lineageTraits';
      (h.traits||[]).forEach(word=>{const g=document.createElement('span');g.className=word?'sitelenGlyph lineageTrait':'lineageTrait unknown';g.textContent=word?glyphChar(word):'?';g.title=word||'unrecorded trait';traits.appendChild(g);});
      info.append(label,traits);
      const choices=document.createElement('div');choices.className='lineageChoices';
      pairs.forEach(pair=>{
        const btn=document.createElement('button');btn.type='button';btn.className=`lineageChoice${st.assignments?.[index]===pair.id?' selected':''}`;btn.textContent=pair.id;
        btn.setAttribute('aria-label',`Assign hatchling ${h.id} to pair ${pair.id}`);btn.addEventListener('click',()=>{st.assignments[index]=pair.id;renderCampaignPuzzle();});choices.appendChild(btn);
      });
      row.append(info,choices);rows.appendChild(row);
    });
    wrap.append(pairGrid,evidence,rows);puzzleSlots.appendChild(wrap);
    const assigned=(st.assignments||[]).filter(Boolean).length;
    setMechanismStatus(puzzle,'',`${assigned}/${hatchlings.length} hatchlings assigned. Use the partial traits and both cross-record observations, then press Try answer.`);
  }

  function renderRecordClassificationPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    const records=payload.records||[],destinations=payload.destinations||[];
    st.assignments=st.assignments&&typeof st.assignments==='object'?st.assignments:{};
    const wrap=document.createElement('div');wrap.className='recordClassifyWrap';
    const lead=document.createElement('div');lead.className='recordClassifyLead';
    renderLocalized(lead,isTpLanguage()
      ? 'lipu tu ni li toki e pana [[pan]] e pana [[suwi]] pi tenpo pini. sina tawa e moku sin ala. o anu taso e lipu ale tawa ma pini pona.'
      : 'These are records for the pan and suwi shipments you already delivered. You are not moving the goods again; classify the two records only.');
    const grid=document.createElement('div');grid.className='recordClassifyGrid';
    records.forEach(record=>{
      const card=document.createElement('section');card.className='recordClassifyCard';
      const head=document.createElement('div');head.className='recordClassifyHead';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph recordClassifyGlyph';glyph.textContent=glyphChar(record.word||'ijo');
      const title=document.createElement('strong');renderExact(title,record.label||`${record.word||'shipment'} record`);head.append(glyph,title);
      const facts=document.createElement('div');facts.className='recordClassifyFacts';
      (record.evidence||[]).forEach(text=>{const row=document.createElement('div');row.className='recordClassifyFact';renderExact(row,text);facts.appendChild(row);});
      const decision=document.createElement('div');decision.className='recordClassifyDecision';
      const decisionLabel=document.createElement('strong');renderLocalized(decisionLabel,isTpLanguage()?'o anu e nasin pini:':'Classify this record:');decision.appendChild(decisionLabel);
      const buttons=document.createElement('div');buttons.className='recordClassifyChoices';
      destinations.forEach(dest=>{
        const btn=document.createElement('button');btn.type='button';btn.className=`recordClassifyChoice${st.assignments[record.id]===dest.id?' selected':''}`;
        renderLocalized(btn,isTpLanguage()?(dest.tpLabel||dest.label):(dest.label||dest.id));
        btn.addEventListener('click',()=>{st.assignments[record.id]=dest.id;renderCampaignPuzzle();});
        buttons.appendChild(btn);
      });
      decision.appendChild(buttons);card.append(head,facts,decision);grid.appendChild(card);
    });
    wrap.append(lead,grid);puzzleSlots.appendChild(wrap);
    const chosen=records.filter(record=>Boolean(st.assignments[record.id])).length;
    setMechanismStatus(puzzle,'',isTpLanguage()
      ? `lipu ${chosen}/${records.length} li jo e nasin pini. o lukin e sona lete, o anu e lipu tu, ni la o luka e [[o alasa]].`
      : `${chosen}/${records.length} records classified. Use the delivery and cold-history evidence, then press Try answer.`);
  }

  function renderHabitatTriagePuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,stations=payload.stations||[],roles=payload.roles||[];
    const validStationIds=new Set(stations.map(station=>station.id));
    // v0.40 changed the old semantic station ids (warm/recovery) to neutral A-D.
    // Clear obsolete in-progress choices so an upgraded save never displays phantom selections.
    if(st.akesi!=null&&!validStationIds.has(st.akesi))st.akesi=null;
    if(st.moli!=null&&!validStationIds.has(st.moli))st.moli=null;
    const wrap=document.createElement('div');wrap.className='habitatTriageWrap';
    const brief=document.createElement('div');brief.className='habitatRoleBrief';
    roles.forEach(role=>{
      const card=document.createElement('div');card.className='habitatRoleRule';
      const head=document.createElement('div');head.className='habitatRoleRuleHead';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(role.id);
      const label=document.createElement('strong');renderExact(label,role.label);head.append(glyph,label);
      const rule=document.createElement('span');renderExact(rule,role.rule);card.append(head,rule);brief.appendChild(card);
    });
    const records=document.createElement('div');records.className='habitatRecords';
    stations.forEach(station=>{
      const card=document.createElement('div');card.className='habitatRecord';
      const title=document.createElement('strong');renderExact(title,station.label);
      const facts=document.createElement('ul');(station.facts||[]).forEach(f=>{const li=document.createElement('li');renderExact(li,f);facts.appendChild(li);});
      card.append(title,facts);records.appendChild(card);
    });
    const selectors=document.createElement('div');selectors.className='habitatSelectors';
    const makeSelector=(key,title)=>{
      const box=document.createElement('div');box.className='habitatSelector';
      const head=document.createElement('div');head.className='habitatSelectorHead';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(key);
      const lab=document.createElement('strong');renderExact(lab,title);head.append(glyph,lab);box.appendChild(head);
      const buttons=document.createElement('div');buttons.className='habitatChoiceGrid';
      stations.forEach(station=>{const btn=document.createElement('button');btn.type='button';btn.className=`habitatChoice${st[key]===station.id?' selected':''}`;renderExact(btn,station.label,{sitelen:false});btn.addEventListener('click',()=>{st[key]=station.id;renderCampaignPuzzle();});buttons.appendChild(btn);});
      box.appendChild(buttons);return box;
    };
    selectors.append(makeSelector('akesi','choose the reptile habitat'),makeSelector('moli','choose the failed sensor'));
    wrap.append(brief,records,selectors);puzzleSlots.appendChild(wrap);
    const chosen=Number(Boolean(st.akesi))+Number(Boolean(st.moli));
    setMechanismStatus(puzzle,'',`${chosen}/2 roles assigned. Match each role definition to the station evidence, then press Try answer.`);
  }

  function renderSudokuPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    const givens=Array.from(payload.puzzle||[]).slice(0,81).map(v=>Number(v)||0);
    const cells=Array.from(st.cells||givens).slice(0,81).map(v=>Number(v)||0);
    while(cells.length<81)cells.push(0);
    st.cells=cells;
    if(!Array.isArray(st.notes)||st.notes.length!==81)st.notes=Array.from({length:81},()=>[]);
    st.notes=st.notes.map(list=>Array.isArray(list)?Array.from(new Set(list.map(Number).filter(v=>v>=1&&v<=9))).sort((a,b)=>a-b):[]);
    const selected=st.selected==null?null:(Number.isInteger(Number(st.selected))?Number(st.selected):null);

    const wrap=document.createElement('div');wrap.className='sudokuWrap';
    const lead=document.createElement('div');lead.className='sudokuLead';
    renderExact(lead,'Final puzzle · every row, column and 3×3 box must contain 1–9 exactly once. Small Latin numerals are accessibility fallbacks; the large symbols are nanpa-linja-n digits.');
    const grid=document.createElement('div');grid.className='sudokuGrid';
    for(let i=0;i<81;i++){
      const r=Math.floor(i/9),c=i%9,given=Boolean(givens[i]),value=Number(cells[i])||0;
      const btn=document.createElement('button');btn.type='button';
      btn.className=`sudokuCell${given?' given':''}${selected===i?' selected':''}${c%3===2&&c<8?' boxRight':''}${r%3===2&&r<8?' boxBottom':''}`;
      btn.setAttribute('aria-label',given?`Row ${r+1}, column ${c+1}, given ${value}`:`Row ${r+1}, column ${c+1}${value?`, value ${value}`:', empty'}`);
      if(value){
        const glyph=document.createElement('span');glyph.className='sudokuGlyph sitelenGlyph';glyph.textContent=sudokuDigitGlyph(value);
        const latin=document.createElement('small');latin.className='sudokuLatin';latin.textContent=String(value);
        btn.append(glyph,latin);
      }else{
        const notes=document.createElement('span');notes.className='sudokuNotes';
        const set=new Set(st.notes[i]||[]);
        for(let n=1;n<=9;n++){const s=document.createElement('small');s.textContent=set.has(n)?String(n):'';notes.appendChild(s);}
        btn.appendChild(notes);
      }
      if(!given)btn.addEventListener('click',()=>{st.selected=i;renderCampaignPuzzle();});
      else btn.disabled=true;
      grid.appendChild(btn);
    }

    const controls=document.createElement('div');controls.className='sudokuControls';
    const focus=document.createElement('div');focus.className='sudokuFocus';
    const focusLabel=document.createElement('div');focusLabel.className='sudokuFocusLabel';
    if(selected==null){
      renderLocalized(focusLabel,isTpLanguage()?'o luka e leko pi nanpa ala.':'Tap an empty square');
      const placeholder=document.createElement('div');placeholder.className='sudokuFocusCell sudokuFocusCell--empty';placeholder.textContent='·';focus.append(focusLabel,placeholder);
    }else{
      const r=Math.floor(selected/9),c=selected%9,value=Number(cells[selected])||0;
      renderLocalized(focusLabel,isTpLanguage()?`leko: linja ${r+1} · poka ${c+1}`:`Row ${r+1} · column ${c+1}`);
      const focusCell=document.createElement('div');focusCell.className='sudokuFocusCell';
      if(value){
        const glyph=document.createElement('span');glyph.className='sudokuFocusGlyph sitelenGlyph';glyph.textContent=sudokuDigitGlyph(value);
        const latin=document.createElement('small');latin.className='sudokuFocusLatin';latin.textContent=String(value);focusCell.append(glyph,latin);
      }else{
        const notes=document.createElement('span');notes.className='sudokuFocusNotes';const set=new Set(st.notes[selected]||[]);
        for(let n=1;n<=9;n++){const note=document.createElement('small');note.textContent=set.has(n)?String(n):'';notes.appendChild(note);}focusCell.appendChild(notes);
      }
      focus.append(focusLabel,focusCell);
    }
    controls.appendChild(focus);
    const mode=document.createElement('button');mode.type='button';mode.className=`sudokuMode${st.noteMode?' active':''}`;renderExact(mode,`Notes: ${st.noteMode?'ON':'OFF'}`,{sitelen:false});mode.addEventListener('click',()=>{st.noteMode=!st.noteMode;renderCampaignPuzzle();});
    const clear=document.createElement('button');clear.type='button';renderExact(clear,'Clear cell',{sitelen:false});clear.disabled=selected==null||Boolean(givens[selected]);clear.addEventListener('click',()=>{if(selected==null||givens[selected])return;st.cells[selected]=0;st.notes[selected]=[];renderCampaignPuzzle();});
    controls.append(mode,clear);
    const keypad=document.createElement('div');keypad.className='sudokuKeypad';
    for(let n=1;n<=9;n++){
      const b=document.createElement('button');b.type='button';b.className='sudokuKey';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=sudokuDigitGlyph(n);
      const latin=document.createElement('small');latin.textContent=String(n);b.append(glyph,latin);
      b.disabled=selected==null||Boolean(givens[selected]);
      b.addEventListener('click',()=>{
        const i=Number(st.selected);if(!Number.isInteger(i)||givens[i])return;
        if(st.noteMode){
          st.cells[i]=0;const notes=new Set(st.notes[i]||[]);if(notes.has(n))notes.delete(n);else notes.add(n);st.notes[i]=[...notes].sort((a,b)=>a-b);
        }else{
          st.cells[i]=n;st.notes[i]=[];
        }
        renderCampaignPuzzle();
      });
      keypad.appendChild(b);
    }
    controls.appendChild(keypad);
    const filled=cells.filter(Boolean).length;
    wrap.append(lead,grid,controls);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,'',`Filled ${filled}/81 cells. No correctness feedback is shown before Try answer.`);
  }

  function renderMechanismPuzzle(puzzle) {
    puzzleTrayWrap.hidden=true; puzzleResetBtn.hidden=false; puzzleCompleteBtn.hidden=false; renderLocalized(puzzleCompleteBtn,uiText('tryAnswer'));
    if(!puzzleMechanismState) resetMechanismState(puzzle);
    switch(puzzle.type){
      case 'dial-bank': renderDialBankPuzzle(puzzle); break;
      case 'route-board': renderRouteBoardPuzzle(puzzle); break;
      case 'path-grid': renderPathGridPuzzle(puzzle); break;
      case 'lights-out': renderLightsOutPuzzle(puzzle); break;
      case 'balance-scale': renderBalancePuzzle(puzzle); break;
      case 'context-match': renderContextMatchPuzzle(puzzle); break;
      case 'jug-transfer': renderJugTransferPuzzle(puzzle); break;
      case 'hanoi-stack': renderHanoiPuzzle(puzzle); break;
      case 'codebreaker': renderCodebreakerPuzzle(puzzle); break;
      case 'equivalence-grid': renderEquivalencePuzzle(puzzle); break;
      case 'schedule-order': renderSchedulePuzzle(puzzle); break;
      case 'river-crossing': renderRiverCrossingPuzzle(puzzle); break;
      case 'sokoban': renderSokobanPuzzle(puzzle); break;
      case 'sliding-grid': renderSlidingGridPuzzle(puzzle); break;
      case 'peg-solitaire': renderPegSolitairePuzzle(puzzle); break;
      case 'nonogram': renderNonogramPuzzle(puzzle); break;
      case 'card-sort': renderCardSortPuzzle(puzzle); break;
      case 'calculator-sequence': renderCalculatorSequencePuzzle(puzzle); break;
      case 'base-match': renderBaseMatchPuzzle(puzzle); break;
      case 'ring-lock': renderRingLockPuzzle(puzzle); break;
      case 'tone-sequence': renderToneSequencePuzzle(puzzle); break;
      case 'airflow-network': renderAirflowNetworkPuzzle(puzzle); break;
      case 'pulse-sync': renderPulseSyncPuzzle(puzzle); break;
      case 'spectrum-order': renderSpectrumOrderPuzzle(puzzle); break;
      case 'power-balance': renderPowerBalancePuzzle(puzzle); break;
      case 'deduction-order': renderDeductionOrderPuzzle(puzzle); break;
      case 'dual-mirror': renderDualMirrorPuzzle(puzzle); break;
      case 'truth-gates': renderTruthGatesPuzzle(puzzle); break;
      case 'dependency-order': renderDependencyOrderPuzzle(puzzle); break;
      case 'exact-path': renderExactPathPuzzle(puzzle); break;
      case 'sphinx-riddles': renderSphinxRiddlesPuzzle(puzzle); break;
      case 'coupled-switches': renderCoupledSwitchesPuzzle(puzzle); break;
      case 'layer-alignment': renderLayerAlignmentPuzzle(puzzle); break;
      case 'market-till': renderMarketTillPuzzle(puzzle); break;
      case 'cold-chain': renderColdChainPuzzle(puzzle); break;
      case 'textile-mixer': renderTextileMixerPuzzle(puzzle); break;
      case 'record-classification': renderRecordClassificationPuzzle(puzzle); break;
      case 'call-triangulation': renderCallTriangulationPuzzle(puzzle); break;
      case 'lineage-match': renderLineageMatchPuzzle(puzzle); break;
      case 'habitat-triage': renderHabitatTriagePuzzle(puzzle); break;
      case 'sudoku': renderSudokuPuzzle(puzzle); break;
      case 'pattern-sequence': renderPatternSequencePuzzle(puzzle); break;
    }
    // Submission is deliberately always available for mechanism puzzles. The UI must
    // never reveal a correct configuration merely by enabling or highlighting the button.
    puzzleCompleteBtn.disabled=false;
    renderLocalized(puzzleCompleteBtn,uiText('tryAnswer'));
    if(String(puzzle.id||'').startsWith('l10-')&&puzzleMechanismState){
      state.l10MechanismStates=state.l10MechanismStates||{};
      state.l10MechanismStates[puzzle.id]=JSON.parse(JSON.stringify(puzzleMechanismState));
      saveState();
    }
    if(String(puzzle.id||'').startsWith('l11-')&&puzzleMechanismState){
      state.l11MechanismStates=state.l11MechanismStates||{};
      state.l11MechanismStates[puzzle.id]=JSON.parse(JSON.stringify(puzzleMechanismState));
      saveState();
    }
    if(String(puzzle.id||'').startsWith('l12-')&&puzzleMechanismState){
      state.l12MechanismStates=state.l12MechanismStates||{};
      state.l12MechanismStates[puzzle.id]=JSON.parse(JSON.stringify(puzzleMechanismState));
      saveState();
    }
  }

  function renderCoordinateMapPuzzle(puzzle) {
    puzzleTrayWrap.hidden = true;
    puzzleResetBtn.hidden = true;
    puzzleCompleteBtn.hidden = true;
    const payload = puzzle.ui?.payload || {};
    const clue = document.createElement('div'); clue.className='coordinatePuzzleClue';
    const label = document.createElement('div'); label.className='coordinatePuzzleLabel'; renderLocalized(label,isTpLanguage()?'sona lon ma':'coordinate clue');
    const clueCanvas = document.createElement('canvas'); clueCanvas.width=360; clueCanvas.height=82; clueCanvas.className='coordinatePuzzleCanvas';
    clue.append(label, clueCanvas); puzzleSlots.appendChild(clue);
    renderNanpaSourceToCanvas(payload.source || 'ma:(3,9)', clueCanvas, 38);

    const grid = document.createElement('div'); grid.className='coordinateMapGrid';
    const gw = Math.max(1, Number(payload.gridWidth)||10), gh=Math.max(1,Number(payload.gridHeight)||10);
    const axisDigitWords = ['ijo','wan','tu','seli','awen','luka','utala','mun','pipi','jo'];
    const axisGlyph = value => axisDigitWords[value] ? glyphChar(axisDigitWords[value]) : String(value);
    grid.style.setProperty('--map-cols', String(gw));
    for (let y=0;y<gh;y++) for (let x=0;x<gw;x++) {
      const cell=document.createElement('button'); cell.type='button'; cell.className='coordinateMapCell';
      cell.dataset.x=String(x); cell.dataset.y=String(y); cell.title=`${x}, ${y}`; cell.setAttribute('aria-label',`map coordinate ${x}, ${y}`);
      if ((x+y)%5===0) cell.classList.add('landmark');
      if (y===0) { const axis=document.createElement('span'); axis.className='coordinateAxis coordinateAxisX'; axis.textContent=axisGlyph(x); cell.appendChild(axis); }
      if (x===0) { const axis=document.createElement('span'); axis.className='coordinateAxis coordinateAxisY'; axis.textContent=axisGlyph(y); cell.appendChild(axis); }
      cell.addEventListener('click',()=>{
        const tx=Number(payload.targetX), ty=Number(payload.targetY);
        if (x===tx && y===ty) {
          renderLocalized(puzzleStatus,isTpLanguage()?'pona. poki len li kama lon tomo lipu anpa.':'Correct. A cache has been revealed in the Lower Archive.');
          successTone();
          const id=puzzle.id, title=puzzleText(puzzle,'title')||puzzle.ui.title||id;
          closeModal(puzzleOverlay); puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism'); if (puzzleCard) delete puzzleCard.dataset.puzzleType; activeCampaignPuzzle=null; selectedPuzzleSlotIndex=null;
          const result=completeCampaignPuzzle(id,`Solved ${title}.`);
          if (result.ok) showMessagePair('A hidden cache has appeared in the Lower Archive. It is marked on the minimap.','poki len li kama lon tomo lipu anpa. sitelen ona li lon sitelen ma.');
        } else {
          renderLocalized(puzzleStatus,isTpLanguage()?`ni li ${x}, ${y}. sona ma li toki e ma ante.`:`That is ${x}, ${y}. The coordinate clue points somewhere else.`);
          blockedTone();
        }
      });
      grid.appendChild(cell);
    }
    puzzleSlots.appendChild(grid);
    renderLocalized(puzzleStatus,isTpLanguage()?'o luka e poki ma lon lon sama sona sewi.':'Tap the cell at the coordinate shown above.');
  }

  function protectCountryProperNames(text) {
    return String(text || '').replace(/\b(Amelika|Apika|Asija|Osejanija)\b/g, '[[$1]]');
  }

  function renderCountryPuzzle(puzzle) {
    const answer = String(puzzle.ui?.payload?.answer || '').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
    const clueBox=document.createElement('div'); clueBox.className='countryClueBox';
    const clue=document.createElement('div'); clue.className=isTpLanguage()?'countryClueTp':'countryClueEn';
    renderLocalized(clue, isTpLanguage() ? protectCountryProperNames(puzzle.ui?.payload?.clueTp || '') : (puzzle.ui?.payload?.clueEn || ''), {sitelen:isTpLanguage()});
    clueBox.append(clue); puzzleSlots.appendChild(clueBox);
    if (!Array.isArray(puzzleSlotValues) || puzzleSlotValues.length!==answer.length) puzzleSlotValues=Array(answer.length).fill(null);
    if (selectedPuzzleSlotIndex == null && answer.length && puzzleSlotValues.some(v=>!v)) selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(-1);
    [...answer].forEach((_,index)=>{
      const slot=document.createElement('button'); slot.type='button'; slot.className=`puzzleSlot fillable ${puzzleSlotValues[index]?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}${tutorialFeedbackMatches(puzzle,'slot',index)?' tutorialConfirmed':''}`; slot.dataset.slotIndex=String(index);
      const glyph=document.createElement('div'); glyph.className=puzzleSlotValues[index]?'puzzleSlotGlyph sitelenGlyph':'puzzleSlotGlyph'; glyph.textContent=puzzleSlotValues[index]?displayPuzzleToken(puzzleSlotValues[index]):'＋';
      slot.append(glyph);
      slot.addEventListener('click',()=>activatePuzzleSlot(index));
      puzzleSlots.appendChild(slot);
    });
    renderGlyphFamilyPicker();
    puzzleCompleteBtn.hidden=false; puzzleResetBtn.hidden=false; puzzleTrayWrap.hidden=false;
    puzzleCompleteBtn.disabled=false;
    renderLocalized(puzzleCompleteBtn, uiText('tryAnswer'));
    renderLocalized(puzzleStatus, isTpLanguage() ? 'o luka e ma sitelen, o anu e kalama lipu, o luka anu tawa e sitelen. sina pini la o luka e [[o alasa]]. ilo li toki e pona taso lon tenpo pana.' : 'Tap a slot, choose a letter, then tap or drag a glyph. Press Try answer when ready; correctness is checked only after submission.');
  }


  function countryCrosswordModel(puzzle) {
    const payload=puzzle?.ui?.payload||{},width=Math.max(1,Number(payload.width)||1),height=Math.max(1,Number(payload.height)||1);
    const cellMap=new Map(),starts=new Map(),entries=[];
    for(const raw of payload.entries||[]) {
      const direction=raw.direction==='down'?'down':'across',row=Number(raw.row)||0,col=Number(raw.col)||0;
      const acceptedAnswers=Array.from(raw.acceptedAnswers||[]).map(v=>String(v||'').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'')).filter(Boolean);
      const length=Math.max(0,Number(raw.length)||acceptedAnswers[0]?.length||0);
      const entry={...raw,acceptedAnswers,length,direction,row,col}; entries.push(entry);
      const startKey=`${row},${col}`; if(!starts.has(startKey)) starts.set(startKey,[]); starts.get(startKey).push(Number(raw.number)||0);
      for(let offset=0;offset<length;offset++){
        const y=row+(direction==='down'?offset:0),x=col+(direction==='across'?offset:0);
        if(x<0||x>=width||y<0||y>=height) continue;
        const key=`${y},${x}`;
        if(!cellMap.has(key)) cellMap.set(key,{row:y,col:x,entries:[]});
        cellMap.get(key).entries.push({number:Number(raw.number)||0,offset});
      }
    }
    const cells=[...cellMap.values()].sort((a,b)=>a.row-b.row||a.col-b.col);
    cells.forEach((cell,index)=>cell.slotIndex=index);
    const byKey=new Map(cells.map(c=>[`${c.row},${c.col}`,c]));
    return {width,height,entries,cells,byKey,starts};
  }

  function crosswordEnteredLetters(model) {
    const byKey=new Map();
    for(const cell of model.cells){
      const word=String(puzzleSlotValues[cell.slotIndex]||'');
      byKey.set(`${cell.row},${cell.col}`,WORD_TO_CP[word]!=null ? (word[0]?.toUpperCase()||'') : '');
    }
    return byKey;
  }

  function crosswordEntryValue(entry,letters) {
    let value='';
    for(let offset=0;offset<entry.length;offset++){
      const y=entry.row+(entry.direction==='down'?offset:0),x=entry.col+(entry.direction==='across'?offset:0);
      value += letters.get(`${y},${x}`)||'';
    }
    return value;
  }

  async function renderCountryCrosswordIndexCartouche(host, rawNumber, fontPx) {
    if(!host) return;
    const raw=String(rawNumber??'').trim().padStart(2,'0');
    if(!/^\d{2}$/.test(raw)) return;
    try{
      const renderer=await ensureLevelRenderer();
      const rendered=await renderer.renderTextToNewCanvas({
        input:raw,
        layout:{fontPx,align:'center',spacingPreset:'compact',paddingPx:Math.max(6,Math.ceil(fontPx*.24))},
        parser:{
          mode:'sitelen-pona-ascii-extended',
          numericMode:'uniform',
          mixedStyle:'short',
          abbreviateNumericCartouches:true,
          cartoucheVulgarFractions:true,
          preserveNumericCartoucheBreaksInAbbreviation:true,
          nanpaColonParsing:true,
          nanpaColonRendering:true,
          relaxedNanpaLinjanParsing:true,
          relaxedNanpaLinjanRendering:true,
          autoCartoucheStandaloneProperNames:true
        }
      });
      const canvas=rendered?.canvas;if(!canvas)throw new Error('no canvas');
      canvas.className='countryCrosswordIndexCanvas';canvas.setAttribute('aria-hidden','true');
      host.replaceChildren(canvas);
    }catch(err){
      host.textContent=raw;
      console.warn('[game] crossword numeric index renderer unavailable',err);
    }
  }

  function scheduleCountryCrosswordIndexRendering(root) {
    if(!root)return;
    requestAnimationFrame(()=>{
      for(const host of root.querySelectorAll('.countryCrosswordNumberHost[data-number]')){
        renderCountryCrosswordIndexCartouche(host,host.dataset.number,host.classList.contains('countryCrosswordNumberHost--cell')?14:16);
      }
    });
  }

  function renderCountryCrosswordPuzzle(puzzle) {
    const model=countryCrosswordModel(puzzle);
    if(!Array.isArray(puzzleSlotValues)||puzzleSlotValues.length!==model.cells.length) puzzleSlotValues=Array(model.cells.length).fill(null);
    if(selectedPuzzleSlotIndex==null && puzzleSlotValues.some(v=>!v)) selectedPuzzleSlotIndex=nextEmptyPuzzleSlotIndex(-1);

    const wrap=document.createElement('div');wrap.className='countryCrosswordWrap';
    const clues=document.createElement('div');clues.className='countryCrosswordClues';
    model.entries.forEach(entry=>{
      const clue=document.createElement('div');clue.className='countryCrosswordClue';
      const head=document.createElement('strong');
      const num=document.createElement('span');num.className='countryCrosswordNumberHost countryCrosswordNumberHost--clue';num.dataset.number=String(entry.number);
      const dir=document.createElement('span');dir.className='countryCrosswordClueDirection';dir.textContent=entry.direction==='down'?'↓':'→';
      head.append(num,dir);
      const clueText=document.createElement(isTpLanguage()?'span':'small');
      clueText.className=isTpLanguage()?'countryClueTp':'countryClueEn';
      renderLocalized(clueText,isTpLanguage()?protectCountryProperNames(entry.clueTp||''):(entry.clueEn||''),{sitelen:isTpLanguage()});
      clue.append(head,clueText);clues.appendChild(clue);
    });

    const grid=document.createElement('div');grid.className='countryCrosswordGrid';grid.style.setProperty('--cross-cols',String(model.width));grid.style.setProperty('--cross-rows',String(model.height));
    for(let y=0;y<model.height;y++)for(let x=0;x<model.width;x++){
      const key=`${y},${x}`,cell=model.byKey.get(key);
      if(!cell){const block=document.createElement('div');block.className='countryCrosswordCell block';grid.appendChild(block);continue;}
      const index=cell.slotIndex,value=puzzleSlotValues[index];
      const b=document.createElement('button');b.type='button';b.className=`countryCrosswordCell puzzleSlot fillable ${value?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}${tutorialFeedbackMatches(puzzle,'slot',index)?' tutorialConfirmed':''}`;b.dataset.slotIndex=String(index);
      const nums=model.starts.get(key)||[];if(nums.length){const num=document.createElement('span');num.className='countryCrosswordNumberHost countryCrosswordNumberHost--cell';num.dataset.number=String(nums[0]);b.appendChild(num);}
      const glyph=document.createElement('span');glyph.className=value?'countryCrosswordGlyph sitelenGlyph':'countryCrosswordGlyph';glyph.textContent=value?displayPuzzleToken(value):'＋';b.appendChild(glyph);
      b.setAttribute('aria-label',`Crossword cell row ${y+1}, column ${x+1}${nums.length?`, clue ${nums.join(' and ')}`:''}`);
      b.addEventListener('click',()=>activatePuzzleSlot(index));grid.appendChild(b);
    }
    wrap.append(clues,grid);puzzleSlots.appendChild(wrap);
    scheduleCountryCrosswordIndexRendering(wrap);
    renderGlyphFamilyPicker();
    puzzleTrayWrap.hidden=false;puzzleResetBtn.hidden=false;puzzleCompleteBtn.hidden=false;
    puzzleCompleteBtn.disabled=false;
    renderLocalized(puzzleCompleteBtn, uiText('tryAnswer'));
    renderLocalized(puzzleStatus, isTpLanguage()
      ? 'nimi ma li pona la ona o sama tawa sona, suli lipu, en poki kama sama. sina pini la o luka e [[o alasa]]. ilo li toki e pona taso lon tenpo pana.'
      : 'Any country name that matches its clue, length and crossings is valid. Press Try answer when ready; correctness is checked only after submission.');
  }

  const NANPA_PROPER_DIGIT_SYLLABLES = Object.freeze({
    ijo:'ni', wan:'wa', tu:'tu', seli:'se', awen:'na',
    luka:'lu', utala:'nu', mun:'mu', pipi:'pi', jo:'jo'
  });

  function nanpaFormatProperNameFromGlyphSequence(tokens) {
    const source=Array.isArray(tokens)?tokens.map(v=>String(v||'').trim()).filter(Boolean):[];
    if(source.length<3 || source[0]!=='nanpa' || source[source.length-1]!=='nanpa') return '';
    const core=source.slice(1,-1);
    if(core[0]===':') core.shift();
    if(!core.length) return '';
    const words=['Nanpa'];
    let digits='',pendingPrefix='';
    const cap=value=>value?value.charAt(0).toUpperCase()+value.slice(1):'';
    const flushDigits=()=>{
      if(!digits) return;
      words.push(cap(`${pendingPrefix}${digits}n`));
      digits=''; pendingPrefix='';
    };
    for(let i=0;i<core.length;i++){
      const token=core[i];
      const digit=NANPA_PROPER_DIGIT_SYLLABLES[token];
      if(digit){digits+=digit;continue;}
      flushDigits();
      if(token==='ona'){pendingPrefix='no';continue;}
      if(token==='en'){words.push('Ene');continue;}
      if(token==='kulupu'){words.push('Eke');continue;}
      if(token==='kala'){words.push('Eko');continue;}
      if(token==='kin'){words.push('Oko');continue;}
      if(token==='kipisi'){words.push('Oken');continue;}
      if(token==='o' && core[i+1]==='o'){words.push('Ono');i++;continue;}
      if(token==='o'){words.push('One');continue;}
      return '';
    }
    flushDigits();
    return words.length>1?words.join(' '):'';
  }

  function numericProperNameFeedback(tokens, expectedTokens) {
    if(!Array.isArray(tokens)||!Array.isArray(expectedTokens)||tokens.length!==expectedTokens.length) return {properName:'',correct:false};
    const properName=nanpaFormatProperNameFromGlyphSequence(tokens);
    if(!properName) return {properName:'',correct:false};
    return {properName,correct:expectedTokens.every((expected,index)=>tokens[index]===expected)};
  }

  function makeNumericProperNameLine(tokens, expectedTokens, className='puzzleNumericProperName') {
    const expectedProperName=nanpaFormatProperNameFromGlyphSequence(expectedTokens);
    if(!expectedProperName) return null;
    const feedback=numericProperNameFeedback(tokens,expectedTokens);
    const line=document.createElement('div');
    line.className=`${className}${feedback.correct?' isVisible':''}`;
    line.textContent=feedback.correct?feedback.properName:' ';
    line.setAttribute('aria-hidden',feedback.correct?'false':'true');
    return line;
  }

  function sequenceAnswerGroups(puzzle, seq) {
    const raw = Array.isArray(puzzle?.ui?.payload?.answerGroups) ? puzzle.ui.payload.answerGroups : [];
    if (!raw.length) return [];
    let cursor = 0;
    const groups = [];
    for (const entry of raw) {
      const length = Math.max(0, Number(entry?.length) || 0);
      if (!length || cursor + length > seq.length) return [];
      groups.push({
        label:String(entry?.label || `Answer ${groups.length + 1}`),
        clue:String(entry?.clue || ''),
        start:cursor,
        length
      });
      cursor += length;
    }
    return cursor === seq.length ? groups : [];
  }

  function makeSequencePuzzleSlot(puzzle, index, localLabel=null) {
    const slot=document.createElement('button');
    slot.type='button';
    slot.className=`puzzleSlot fillable ${puzzleSlotValues[index]?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}${tutorialFeedbackMatches(puzzle,'slot',index)?' tutorialConfirmed':''}`;
    slot.dataset.slotIndex=String(index);
    slot.setAttribute('aria-label',`Glyph slot ${index+1}`);
    const glyph=document.createElement('div');
    glyph.className=puzzleSlotValues[index]?'puzzleSlotGlyph sitelenGlyph':'puzzleSlotGlyph';
    glyph.textContent=puzzleSlotValues[index]?displayPuzzleToken(puzzleSlotValues[index]):'＋';
    const label=document.createElement('div');
    label.className='puzzleSlotLabel';
    label.textContent=localLabel == null ? String(index+1) : String(localLabel);
    slot.append(glyph,label);
    slot.addEventListener('click',()=>activatePuzzleSlot(index));
    return slot;
  }

  function renderGroupedSequenceAnswers(puzzle, seq, groups) {
    const wrap=document.createElement('div');
    wrap.className='puzzleAnswerGroups';
    for (const group of groups) {
      const row=document.createElement('section');
      row.className='puzzleAnswerGroup';
      const text=document.createElement('div');
      text.className='puzzleAnswerGroupText';
      const title=document.createElement('strong');
      title.className='puzzleAnswerGroupTitle';
      renderExact(title,group.label);
      const clue=document.createElement('small');
      clue.className='puzzleAnswerGroupClue';
      renderExact(clue,group.clue);
      text.append(title,clue);
      const entry=document.createElement('div');
      entry.className='puzzleAnswerGroupEntry';
      const slots=document.createElement('div');
      slots.className='puzzleAnswerGroupSlots';
      slots.style.setProperty('--answer-cols',String(group.length));
      for(let local=0;local<group.length;local++){
        const index=group.start+local;
        slots.appendChild(makeSequencePuzzleSlot(puzzle,index,local+1));
      }
      const current=puzzleSlotValues.slice(group.start,group.start+group.length);
      const expected=seq.slice(group.start,group.start+group.length);
      const properName=makeNumericProperNameLine(current,expected,'puzzleAnswerGroupProperName');
      entry.appendChild(slots);
      if(properName) entry.appendChild(properName);
      row.append(text,entry);
      wrap.appendChild(row);
    }
    puzzleSlots.appendChild(wrap);
  }

  async function renderNanpaSourceToCanvas(source, target, fontPx=48, parserOverrides={}) {
    const ctxOut=target.getContext('2d',{alpha:true}); ctxOut.clearRect(0,0,target.width,target.height);
    try {
      const renderer=await ensureLevelRenderer();
      const rendered=await renderer.renderTextToNewCanvas({input:explicitNanpaSource(source),layout:{fontPx,align:'center',spacingPreset:'compact',paddingPx:8},parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true,...parserOverrides}});
      const src=rendered?.canvas; if(!src) throw new Error('no canvas');
      const scale=Math.min((target.width-10)/src.width,(target.height-10)/src.height,1.5); const dw=src.width*scale,dh=src.height*scale;
      ctxOut.drawImage(src,(target.width-dw)/2,(target.height-dh)/2,dw,dh);
    } catch(err) {
      ctxOut.fillStyle='#111';ctxOut.font='16px system-ui';ctxOut.textAlign='center';ctxOut.textBaseline='middle';ctxOut.fillText(String(source),target.width/2,target.height/2);
    }
  }

  let mobileLandscapePuzzleFitRaf = 0;

  function shortMobileLandscapePuzzleMode() {
    try {
      return Boolean(window.matchMedia?.('(orientation: landscape) and (max-height: 520px) and (max-width: 950px)').matches);
    } catch (_) {
      return false;
    }
  }


  function laptopPuzzleFitMode() {
    try {
      return Boolean(!shortMobileLandscapePuzzleMode() && window.matchMedia?.('(pointer: fine) and (min-width: 601px)').matches);
    } catch (_) {
      return false;
    }
  }

  function centerMobileLandscapeGameArea() {
    if (!shortMobileLandscapePuzzleMode()) return false;
    const scroller = document.scrollingElement || document.documentElement || document.body;
    if (scroller) { scroller.scrollTop = 0; scroller.scrollLeft = 0; }
    try { window.scrollTo(0, 0); } catch (_) {}
    return true;
  }

  function scheduleMobileLandscapeGameCenter() {
    centerMobileLandscapeGameArea();
    requestAnimationFrame(() => centerMobileLandscapeGameArea());
    window.setTimeout(centerMobileLandscapeGameArea, 90);
    window.setTimeout(centerMobileLandscapeGameArea, 280);
  }

  function clearMobileLandscapePuzzleFit() {
    if (!puzzleSlots) return;
    puzzleSlots.classList.remove('mobileLandscapeAutoFit');
    puzzleSlots.style.removeProperty('--mobile-puzzle-fit-scale');
    puzzleSlots.style.removeProperty('--mobile-puzzle-fit-shift-x');
    puzzleSlots.style.removeProperty('--mobile-puzzle-fit-shift-y');
    puzzleSlots.removeAttribute('data-mobile-fit-scale');
    puzzleSlots.removeAttribute('data-mobile-fit-shift-x');
    puzzleSlots.removeAttribute('data-mobile-fit-shift-y');
  }


  function clearLaptopPuzzleFit() {
    if (!puzzleSlots) return;
    puzzleSlots.classList.remove('laptopPuzzleAutoFit');
    puzzleSlots.style.removeProperty('--laptop-puzzle-fit-scale');
    puzzleSlots.style.removeProperty('--laptop-puzzle-fit-shift-x');
    puzzleSlots.style.removeProperty('--laptop-puzzle-fit-shift-y');
    puzzleSlots.removeAttribute('data-laptop-fit-scale');
    puzzleSlots.removeAttribute('data-laptop-fit-shift-x');
    puzzleSlots.removeAttribute('data-laptop-fit-shift-y');
  }

  function visibleReservedPuzzleBoundaryTop() {
    if (!puzzleSlots) return null;
    const candidates = [puzzleLiveCartoucheWrap, puzzleTrayWrap, puzzleCompleteBtn?.closest?.('.overlayButtonRow')];
    let top = Infinity;
    for (const el of candidates) {
      if (!el || el.hidden) continue;
      const style = window.getComputedStyle?.(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;
      const rect = el.getBoundingClientRect?.();
      if (rect && Number.isFinite(rect.top)) top = Math.min(top, rect.top);
    }
    return Number.isFinite(top) ? top : null;
  }

  function visiblePuzzleSurfaceRequiredSize(slotRect) {
    let minLeft = Infinity, maxRight = -Infinity;
    let minTop = Infinity, maxBottom = -Infinity;
    for (const el of puzzleSlots?.querySelectorAll?.('*') || []) {
      const style = window.getComputedStyle?.(el);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;
      const rect = el.getBoundingClientRect?.();
      if (!rect || (!rect.width && !rect.height)) continue;
      if (![rect.left,rect.right,rect.top,rect.bottom].every(Number.isFinite)) continue;
      minLeft = Math.min(minLeft, rect.left); maxRight = Math.max(maxRight, rect.right);
      minTop = Math.min(minTop, rect.top); maxBottom = Math.max(maxBottom, rect.bottom);
    }
    if (!Number.isFinite(minLeft)) { minLeft=slotRect.left; maxRight=slotRect.right; minTop=slotRect.top; maxBottom=slotRect.bottom; }
    return {
      minLeft,maxRight,minTop,maxBottom,
      width:Math.max(puzzleSlots.scrollWidth || 0, maxRight - minLeft),
      height:Math.max(puzzleSlots.scrollHeight || 0, maxBottom - minTop)
    };
  }

  function mobileLandscapePuzzleSafeTop(slotRect) {
    const rect = puzzleInstructions?.getBoundingClientRect?.();
    const style = puzzleInstructions ? window.getComputedStyle?.(puzzleInstructions) : null;
    if (!rect || (style && (style.display === 'none' || style.visibility === 'hidden'))) return slotRect.top;
    // The localized description owns its real rendered height. Toki Pona can wrap
    // onto more lines than English, so never use a fixed text-height allowance.
    return Math.max(slotRect.top, rect.bottom + 4);
  }

  function applyMobileLandscapePuzzleFit() {
    mobileLandscapePuzzleFitRaf = 0;
    if (!puzzleSlots || !puzzleOverlay || puzzleOverlay.hidden || !shortMobileLandscapePuzzleMode()) {
      clearMobileLandscapePuzzleFit();
      return 1;
    }

    // Only the actual puzzle surface may use the flexible display area. The live
    // cartouche, A-W/. glyph picker and Reset/Try/Leave controls are reserved docks
    // and must never be treated as space available to the puzzle itself.
    clearMobileLandscapePuzzleFit();
    const slotRect = puzzleSlots.getBoundingClientRect();
    const boundaryTop = visibleReservedPuzzleBoundaryTop();
    const safeTop = mobileLandscapePuzzleSafeTop(slotRect);
    const safeBottom = boundaryTop == null
      ? slotRect.bottom
      : Math.min(slotRect.bottom, boundaryTop - 4);
    const safeTopRelative = Math.max(0, safeTop - slotRect.top);
    const safeBottomRelative = Math.max(safeTopRelative + 1, safeBottom - slotRect.top);
    const slotWidth = Math.max(1, puzzleSlots.clientWidth);
    const availableWidth = slotWidth;
    const availableHeight = Math.max(1, safeBottomRelative - safeTopRelative);
    const visibleRequired = visiblePuzzleSurfaceRequiredSize(slotRect);
    const rawMinX = visibleRequired.minLeft - slotRect.left;
    const rawMaxX = visibleRequired.maxRight - slotRect.left;
    // scrollWidth is measured from the slot's own left edge while descendant
    // rects can protrude on either side. Merge both coordinate systems so an
    // asymmetric overflow (the old jug-button failure) cannot survive scaling.
    const minX = Math.min(0, rawMinX);
    const maxX = Math.max(rawMaxX, puzzleSlots.scrollWidth || 0);
    const visibleSpanWidth = Math.max(1, maxX - minX);
    const minY = visibleRequired.minTop - slotRect.top;
    const maxY = visibleRequired.maxBottom - slotRect.top;
    const visibleSpanHeight = Math.max(1, maxY - minY);
    const requiredWidth = Math.max(visibleSpanWidth, visibleRequired.width);
    const requiredHeight = Math.max(visibleSpanHeight, visibleRequired.height);
    let scale = Math.min(1, availableWidth / requiredWidth, availableHeight / requiredHeight);
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (scale < 0.997) scale = Math.max(0.20, scale * 0.97);

    // Align vertically below the real localized description and horizontally
    // inside the real puzzle slot. transform-origin is top-left so the shift is
    // deterministic even when content overflows only one side of the slot.
    const scaledWidth = requiredWidth * scale;
    const shiftX = Math.max(0, (availableWidth - scaledWidth) / 2) - (minX * scale);
    const shiftY = safeTopRelative - (minY * scale);
    const scaleValue = scale.toFixed(4);
    const shiftXValue = `${shiftX.toFixed(2)}px`;
    const shiftYValue = `${shiftY.toFixed(2)}px`;
    if (scale < 0.997 || Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
      puzzleSlots.style.setProperty('--mobile-puzzle-fit-scale', scaleValue);
      puzzleSlots.style.setProperty('--mobile-puzzle-fit-shift-x', shiftXValue);
      puzzleSlots.style.setProperty('--mobile-puzzle-fit-shift-y', shiftYValue);
      puzzleSlots.classList.add('mobileLandscapeAutoFit');
      puzzleSlots.dataset.mobileFitScale = scaleValue;
      puzzleSlots.dataset.mobileFitShiftX = shiftXValue;
      puzzleSlots.dataset.mobileFitShiftY = shiftYValue;
    } else {
      puzzleSlots.dataset.mobileFitScale = '1';
      puzzleSlots.dataset.mobileFitShiftX = '0px';
      puzzleSlots.dataset.mobileFitShiftY = '0px';
    }
    return scale;
  }

  function applyLaptopPuzzleFit() {
    if (!puzzleSlots || !puzzleOverlay || puzzleOverlay.hidden || !laptopPuzzleFitMode()) {
      clearLaptopPuzzleFit();
      return 1;
    }

    clearLaptopPuzzleFit();
    const slotRect = puzzleSlots.getBoundingClientRect();
    if (!slotRect.width || !slotRect.height) return 1;
    const boundaryTop = visibleReservedPuzzleBoundaryTop();
    const safeBottom = boundaryTop == null ? slotRect.bottom : Math.min(slotRect.bottom, boundaryTop - 6);
    const availableWidth = Math.max(1, puzzleSlots.clientWidth);
    const availableHeight = Math.max(1, safeBottom - slotRect.top);
    const visibleRequired = visiblePuzzleSurfaceRequiredSize(slotRect);
    const rawMinX = visibleRequired.minLeft - slotRect.left;
    const rawMaxX = visibleRequired.maxRight - slotRect.left;
    const minX = Math.min(0, rawMinX);
    const maxX = Math.max(rawMaxX, puzzleSlots.scrollWidth || 0);
    const minY = Math.min(0, visibleRequired.minTop - slotRect.top);
    const maxY = Math.max(visibleRequired.maxBottom - slotRect.top, puzzleSlots.scrollHeight || 0);
    const requiredWidth = Math.max(1, maxX - minX);
    const requiredHeight = Math.max(1, maxY - minY);
    let scale = Math.min(1, availableWidth / requiredWidth, availableHeight / requiredHeight);
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    if (scale < 0.997) scale = Math.max(0.35, scale * 0.985);

    const scaledWidth = requiredWidth * scale;
    const shiftX = Math.max(0, (availableWidth - scaledWidth) / 2) - (minX * scale);
    const shiftY = -(minY * scale);
    const scaleValue = scale.toFixed(4);
    const shiftXValue = `${shiftX.toFixed(2)}px`;
    const shiftYValue = `${shiftY.toFixed(2)}px`;
    if (scale < 0.997 || Math.abs(shiftX) > 0.5 || Math.abs(shiftY) > 0.5) {
      puzzleSlots.style.setProperty('--laptop-puzzle-fit-scale', scaleValue);
      puzzleSlots.style.setProperty('--laptop-puzzle-fit-shift-x', shiftXValue);
      puzzleSlots.style.setProperty('--laptop-puzzle-fit-shift-y', shiftYValue);
      puzzleSlots.classList.add('laptopPuzzleAutoFit');
      puzzleSlots.dataset.laptopFitScale = scaleValue;
      puzzleSlots.dataset.laptopFitShiftX = shiftXValue;
      puzzleSlots.dataset.laptopFitShiftY = shiftYValue;
    } else {
      puzzleSlots.dataset.laptopFitScale = '1';
      puzzleSlots.dataset.laptopFitShiftX = '0px';
      puzzleSlots.dataset.laptopFitShiftY = '0px';
    }
    return scale;
  }

  function scheduleMobileLandscapePuzzleFit() {
    if (mobileLandscapePuzzleFitRaf) cancelAnimationFrame(mobileLandscapePuzzleFitRaf);
    mobileLandscapePuzzleFitRaf = requestAnimationFrame(() => {
      mobileLandscapePuzzleFitRaf = requestAnimationFrame(() => {
        applyMobileLandscapePuzzleFit();
        applyLaptopPuzzleFit();
      });
    });
  }

  function renderCampaignPuzzle() {
    const puzzle = activeCampaignPuzzle;
    if (!puzzle) return;
    const seq = puzzleSequence(puzzle);
    const usesGlyphKeys = puzzle.type === 'country-cartouche' || puzzle.type === 'country-crossword' || seq.length > 0;
    const mechanismPuzzle = isMechanismPuzzle(puzzle);
    puzzleCard?.classList.toggle('puzzleCard--keys', usesGlyphKeys && puzzle.type !== 'coordinate-map' && !mechanismPuzzle);
    puzzleCard?.classList.toggle('puzzleCard--map', puzzle.type === 'coordinate-map');
    puzzleCard?.classList.toggle('puzzleCard--mechanism', mechanismPuzzle);
    if (puzzleCard) puzzleCard.dataset.puzzleType = String(puzzle.type || '');
    const eyebrow = puzzle.type === 'country-cartouche'
      ? (isTpLanguage()?'poki nimi ma':'country cartouche')
      : puzzle.type === 'country-crossword' ? (isTpLanguage()?'nimi ma lon linja':'country crossword')
      : puzzle.type === 'coordinate-map' ? (isTpLanguage()?'musi sitelen ma':'map puzzle')
      : mechanismPuzzle ? (isTpLanguage()?'musi ilo':'mechanism puzzle')
      : puzzle.type === 'terminal' ? (isTpLanguage()?'ilo sona musi':'campaign terminal')
      : (isTpLanguage()?'musi sitelen':'glyph-key puzzle');
    renderLocalized(puzzleEyebrow, eyebrow);
    renderLocalized(puzzleTitle, puzzleText(puzzle,'title') || puzzle.id);
    const instructionText = String(puzzleText(puzzle,'instructions') || '');
    renderLocalized(puzzleInstructions, instructionText);
    const helpLink = puzzle.ui?.helpLink;
    if (helpLink?.href) {
      if (instructionText) puzzleInstructions.appendChild(document.createTextNode(' '));
      const link = document.createElement('a');
      link.href = String(helpLink.href);
      renderLocalized(link, isTpLanguage() ? 'lipu sona [[nanpa-linja-n]]' : `[[nanpa-linja-n]] ${String(helpLink.label || 'Help').replace(/^nanpa-linja-n\s*/i,'')}`);
      if (helpLink.target) link.target = String(helpLink.target);
      if (link.target === '_blank') link.rel = 'noopener noreferrer';
      if (helpLink.downloadTrackType) link.dataset.downloadTrackType = String(helpLink.downloadTrackType);
      if (helpLink.downloadTrackName) link.dataset.downloadTrackName = String(helpLink.downloadTrackName);
      puzzleInstructions.appendChild(link);
    }
    puzzleSlots.textContent = '';
    puzzleTray.textContent = '';
    puzzleStatus.textContent = '';
    puzzleResetBtn.hidden = false;
    renderLocalized(puzzleResetBtn, mechanismPuzzle ? (isTpLanguage()?'o open sin':'Reset') : uiText('clear'));
    puzzleTrayWrap.hidden = false;
    puzzleCompleteBtn.hidden = false;
    renderLocalized(puzzleCompleteBtn, puzzle.type === 'terminal' ? (isTpLanguage()?'o lon e ni':'Confirm') : uiText('tryAnswer'));
    puzzleCloseBtn.hidden = puzzle.ui.canExit === false;
    hidePuzzleLiveCartouchePreview();

    if (puzzle.type === 'coordinate-map') { renderCoordinateMapPuzzle(puzzle); return; }
    if (puzzle.type === 'country-cartouche') { renderCountryPuzzle(puzzle); return; }
    if (puzzle.type === 'country-crossword') { renderCountryCrosswordPuzzle(puzzle); return; }
    if (mechanismPuzzle) { renderMechanismPuzzle(puzzle); return; }

    if (!seq.length) {
      puzzleResetBtn.hidden = true; puzzleTrayWrap.hidden = true;
      const box = document.createElement('div'); box.className = 'puzzleTerminalMessage';
      renderLocalized(box, puzzle.type === 'terminal' ? (isTpLanguage()?'ilo sona li ken. pona la o lon e ni.':'The terminal is ready. Confirm when you are satisfied.') : (isTpLanguage()?'ilo li ken pali.':'This mechanism is ready.')); 
      puzzleSlots.appendChild(box); puzzleCompleteBtn.disabled = false; return;
    }

    if (!Array.isArray(puzzleSlotValues) || puzzleSlotValues.length !== seq.length) puzzleSlotValues = Array(seq.length).fill(null);
    const displayedSequence = Array.isArray(puzzle.ui?.payload?.displaySequence) ? puzzle.ui.payload.displaySequence : [];
    if (displayedSequence.length) {
      const source = document.createElement('div'); source.className = 'puzzleSourceSequence';
      const sourceLabel = document.createElement('div'); sourceLabel.className = 'puzzleSourceSequenceLabel'; renderLocalized(sourceLabel, isTpLanguage()?'sitelen lon poki':'cache inscription');
      const sourceGlyphs = document.createElement('div'); sourceGlyphs.className = 'puzzleSourceSequenceGlyphs';
      for (const word of displayedSequence) {
        const glyph = document.createElement('div'); glyph.className = 'puzzleSourceGlyph sitelenGlyph'; glyph.textContent = displayPuzzleToken(word); glyph.title = word; glyph.setAttribute('aria-label', word);
        sourceGlyphs.appendChild(glyph);
      }
      source.append(sourceLabel, sourceGlyphs);
      puzzleSlots.appendChild(source);
    }
    if (selectedPuzzleSlotIndex == null && seq.length && puzzleSlotValues.some(v=>!v)) selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(-1);
    const answerGroups=sequenceAnswerGroups(puzzle,seq);
    if(answerGroups.length) renderGroupedSequenceAnswers(puzzle,seq,answerGroups);
    else {
      for(let index=0;index<seq.length;index++) puzzleSlots.appendChild(makeSequencePuzzleSlot(puzzle,index));
      const properName=makeNumericProperNameLine(puzzleSlotValues,seq);
      if(properName) puzzleSlots.appendChild(properName);
    }
    renderPuzzleLiveCartouchePreview(puzzle);
    renderGlyphFamilyPicker();
    puzzleCompleteBtn.disabled = false;
    renderLocalized(puzzleCompleteBtn, uiText('tryAnswer'));
    renderLocalized(puzzleStatus, answerGroups.length
      ? (isTpLanguage()
          ? `o pini e poki nanpa ${answerGroups.length} ale tan sona. ni la o luka e [[o alasa]]. ilo li toki e pona taso lon tenpo pana.`
          : `Complete all ${answerGroups.length} derived cartouches, then press Try answer. Correctness is checked only after submission.`)
      : (isTpLanguage()
          ? `o luka e ma sitelen, o anu e kalama lipu, o luka anu tawa e sitelen. o pini e ma ${seq.length} ale, li luka e [[o alasa]]. ilo li toki e pona taso lon tenpo pana.`
          : `Tap a slot, choose a letter, then tap or drag a glyph. Fill all ${seq.length} positions and press Try answer. Correctness is checked only after submission.`));
  }

  function openCampaignPuzzleHost(puzzle) {
    activeCampaignPuzzle = puzzle;
    clearTutorialSubmissionFeedback();
    puzzleSlotValues = Array(puzzleSequence(puzzle).length).fill(null);
    selectedPuzzleGlyph = null;
    selectedPuzzleFamily = null;
    selectedPuzzleSlotIndex = puzzleSequence(puzzle).length ? 0 : null;
    if(isMechanismPuzzle(puzzle)){
      const savedMechanism=String(puzzle.id||'').startsWith('l10-')?state.l10MechanismStates?.[puzzle.id]:String(puzzle.id||'').startsWith('l11-')?state.l11MechanismStates?.[puzzle.id]:String(puzzle.id||'').startsWith('l12-')?state.l12MechanismStates?.[puzzle.id]:null;
      puzzleMechanismState=savedMechanism?JSON.parse(JSON.stringify(savedMechanism)):freshMechanismState(puzzle);
    }else puzzleMechanismState=null;
    renderCampaignPuzzle();
    openModal(puzzleOverlay);
    scheduleMobileLandscapePuzzleFit();
    const firstControl = puzzleSlots.querySelector('.puzzleSlot.fillable') || puzzleTray.querySelector('.puzzleFamilyKey');
    (firstControl || puzzleCompleteBtn || puzzleCloseBtn).focus?.({ preventScroll:true });
  }

  function clearCampaignPuzzleSlots() {
    if (!activeCampaignPuzzle) return;
    clearTutorialSubmissionFeedback();
    if (isMechanismPuzzle(activeCampaignPuzzle)) { resetMechanismState(activeCampaignPuzzle); renderCampaignPuzzle(); return; }
    puzzleSlotValues = Array(puzzleSequence(activeCampaignPuzzle).length).fill(null);
    selectedPuzzleGlyph = null;
    selectedPuzzleSlotIndex = puzzleSlotValues.length ? 0 : null;
    renderCampaignPuzzle();
  }

  function validateCampaignPuzzleSlots() {
    const puzzle = activeCampaignPuzzle;
    if (!puzzle) return false;
    // Submission-only evaluation: never mark individual slots as correct/wrong.
    // Partial correctness would make sequence/crossword puzzles brute-forceable.
    if (puzzle.type === 'country-cartouche') {
      const answer = String(puzzle.ui?.payload?.answer || '').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
      if (answer.length !== puzzleSlotValues.length) return false;
      return [...answer].every((letter,i)=>{
        const word=String(puzzleSlotValues[i]||'');
        return WORD_TO_CP[word]!=null && word[0]?.toUpperCase()===letter;
      });
    }
    if (puzzle.type === 'country-crossword') {
      const model=countryCrosswordModel(puzzle),letters=crosswordEnteredLetters(model);
      if (model.cells.length!==puzzleSlotValues.length || !model.cells.every(cell=>Boolean(letters.get(`${cell.row},${cell.col}`)))) return false;
      return model.entries.every(entry=>entry.acceptedAnswers.includes(crosswordEntryValue(entry,letters)));
    }
    const seq = puzzleSequence(puzzle);
    return seq.length === puzzleSlotValues.length && seq.every((expected,i)=>puzzleSlotValues[i]===expected);
  }

  function completeActiveCampaignPuzzle() {
    const puzzle = activeCampaignPuzzle;
    if (!puzzle) return;
    const needsSlots = puzzleSequence(puzzle).length || puzzle.type === 'country-cartouche' || puzzle.type === 'country-crossword';
    if (needsSlots && puzzleSlotValues.some(v=>!v)) {
      renderExact(puzzleStatus,'Answer incomplete. Fill every required position, then press Try answer.');
      blockedTone();
      return;
    }
    if (isMechanismPuzzle(puzzle) && !mechanismSolved(puzzle)) {
      if(!showTutorialFailureFeedback(puzzle)) renderExact(puzzleStatus,'That answer did not work. Review the clues, adjust the mechanism, and try again.');
      blockedTone();
      return;
    }
    if (needsSlots && !validateCampaignPuzzleSlots()) {
      if(!showTutorialFailureFeedback(puzzle)) renderExact(puzzleStatus,'That answer did not work. Review the clues and try again.');
      blockedTone();
      return;
    }
    clearTutorialSubmissionFeedback();
    const id = puzzle.id;
    const title = puzzle.ui.title || id;
    closeModal(puzzleOverlay);
    puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism');
    if (puzzleCard) delete puzzleCard.dataset.puzzleType;
    activeCampaignPuzzle = null;
    puzzleMechanismState = null;
    selectedPuzzleSlotIndex = null;
    const result = completeCampaignPuzzle(id, `Earned by completing ${title}.`);
    if (result.ok && !result.awarded?.length) showMessage(`${title} complete.`);
  }

  function closeCampaignPuzzleHost() {
    if (activeCampaignPuzzle?.ui?.canExit === false) return;
    clearTutorialSubmissionFeedback();
    activeCampaignPuzzle = null;
    puzzleSlotValues = [];
    selectedPuzzleGlyph = null;
    selectedPuzzleFamily = null;
    selectedPuzzleSlotIndex = null;
    puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism');
    if (puzzleCard) delete puzzleCard.dataset.puzzleType;
    puzzleMechanismState = null;
    endPuzzleGlyphDrag();
    closeModal(puzzleOverlay);
  }

  function findGenerousPuzzleDropSlot(clientX, clientY) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of puzzleSlots.querySelectorAll('.puzzleSlot.fillable')) {
      const r = slot.getBoundingClientRect();
      const pad = Math.max(28, Math.min(48, Math.max(r.width, r.height) * 0.42));
      if (clientX < r.left - pad || clientX > r.right + pad || clientY < r.top - pad || clientY > r.bottom + pad) continue;
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < bestDist) { bestDist = d; best = slot; }
    }
    return best;
  }

  function beginPuzzleGlyphDrag(e) {
    if (isCoarsePointer()) return;
    if (e.button != null && e.button !== 0) return;
    const key = e.currentTarget;
    const word = key.dataset.word;
    if (!word) return;
    puzzleDrag = {
      pointerId: e.pointerId,
      word,
      source: key,
      startX: e.clientX,
      startY: e.clientY,
      dragStarted: false,
      ghost: null
    };
    key.setPointerCapture?.(e.pointerId);
    key.addEventListener('pointermove', movePuzzleGlyphDrag, { passive:false });
    key.addEventListener('pointerup', endPuzzleGlyphDragFromEvent, { passive:false, once:true });
    key.addEventListener('pointercancel', endPuzzleGlyphDragFromEvent, { passive:false, once:true });
  }

  function ensurePuzzleDragGhost() {
    if (!puzzleDrag || puzzleDrag.ghost) return;
    const ghost = document.createElement('div');
    ghost.className = 'puzzleDragGhost';
    ghost.textContent = displayPuzzleToken(puzzleDrag.word);
    document.body.appendChild(ghost);
    puzzleDrag.ghost = ghost;
  }

  function movePuzzleGlyphDrag(e) {
    if (!puzzleDrag || puzzleDrag.pointerId !== e.pointerId) return;
    const dx = e.clientX - puzzleDrag.startX;
    const dy = e.clientY - puzzleDrag.startY;
    if (!puzzleDrag.dragStarted) {
      if (Math.hypot(dx, dy) < PUZZLE_DRAG_THRESHOLD) return;
      e.preventDefault();
      selectedPuzzleGlyph = puzzleDrag.word;
      puzzleDrag.dragStarted = true;
      ensurePuzzleDragGhost();
    } else {
      e.preventDefault();
    }
    if (!puzzleDrag.dragStarted || !puzzleDrag.ghost) return;
    puzzleDrag.ghost.style.left = `${e.clientX}px`;
    puzzleDrag.ghost.style.top = `${e.clientY}px`;
    for (const slot of puzzleSlots.querySelectorAll('.puzzleSlot')) slot.classList.remove('selectedTarget');
    const target = findGenerousPuzzleDropSlot(e.clientX, e.clientY);
    if (target) target.classList.add('selectedTarget');
  }

  function endPuzzleGlyphDragFromEvent(e) {
    if (!puzzleDrag || puzzleDrag.pointerId !== e.pointerId) return;
    if (puzzleDrag.dragStarted) {
      e.preventDefault();
      const target = findGenerousPuzzleDropSlot(e.clientX, e.clientY);
      const word = puzzleDrag.word;
      if (target) {
        const index = Number(target.dataset.slotIndex);
        if (Number.isFinite(index)) {
          clearTutorialSubmissionFeedback();
          puzzleSlotValues[index] = word;
          selectedPuzzleGlyph = null;
          selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(index);
        }
      }
      endPuzzleGlyphDrag();
      renderCampaignPuzzle();
      return;
    }
    endPuzzleGlyphDrag();
  }

  function endPuzzleGlyphDrag() {
    if (!puzzleDrag) return;
    try { puzzleDrag.ghost?.remove(); } catch (_) {}
    puzzleDrag = null;
    for (const slot of puzzleSlots.querySelectorAll('.puzzleSlot')) slot.classList.remove('selectedTarget');
  }

  function renderCollection() {
    const progress = currentLevelProgress();
    const count = progress.totalOwned;
    renderLocalized(collectionCountEl, `${count} / 120`);
    renderLocalized(collectionBtnCountEl, `${count} / 120`);
    if (collectionLevelProgressEl) renderLocalized(collectionLevelProgressEl, progressSummaryText(progress));
    glyphGrid.textContent = '';
    for (const word of STANDARD_120) {
      const cell = document.createElement('div');
      const has = collected(word);
      cell.className = `glyphCell${has ? '' : ' missing'}`;
      cell.title = has ? word : (isTpLanguage() ? 'sitelen ni li kama ala' : 'Not yet recovered');
      const glyph = document.createElement('div');
      glyph.className = has ? 'glyphCellGlyph sitelenGlyph' : 'glyphCellGlyph';
      glyph.textContent = has ? glyphChar(word) : '•';
      const label = document.createElement('div'); label.className = 'glyphCellWord'; label.textContent = word;
      cell.append(glyph, label); glyphGrid.appendChild(cell);
    }
  }

  function openCollection() {
    renderCollection(); openModal(collectionOverlay); collectionClose.focus({ preventScroll: true });
  }

  let levelIntroShownAt = 0;

  async function ensureLevelRenderer() {
    if (!levelRendererPromise) {
      levelRendererPromise = import(new URL('./js/renderer-fontuploads-renderer-preview-bottom-detect-final-fixed-yearless-datetime.js?v=285', document.baseURI).href)
        .then(mod => mod.default || mod)
        .then(async SitelenRenderer => SitelenRenderer.create({
          layout:{fontPx:64,align:'center',spacingPreset:'compact',paddingPx:10},
          paint:{fillStyle:'#111111',halo:{enabled:false,color:'#FFFFFF',widthPx:0}},
          parser:{
            mode:'sitelen-seli-kiwen', literalStyle:'double-quote', extensionStyle:'ssk', cartoucheStyle:'ssk',
            numericMode:'compat', mixedStyle:'short', showUnknownText:false,
            abbreviateNumericCartouches:true, nanpaColonParsing:true, nanpaColonRendering:true,
            relaxedNanpaLinjanParsing:true, relaxedNanpaLinjanRendering:true,
            cartoucheCommaTallyMarks:false, cartoucheTallyMode:'ucsur', cartoucheVulgarFractions:true
          },
          fonts:{roles:{word:NASIN_NANPA_FONT,text:NASIN_NANPA_FONT,cartouche:NASIN_NANPA_FONT,number:NASIN_NANPA_FONT,date:NASIN_NANPA_FONT,time:NASIN_NANPA_FONT,literal:'system-ui',unknown:'system-ui'}}
        }));
    }
    return levelRendererPromise;
  }

  async function renderLevelIntroCartouche(levelNo) {
    const canvasOut = levelIntroCartouche;
    if (!canvasOut) return;
    const ctxOut = canvasOut.getContext('2d', {alpha:true});
    ctxOut.clearRect(0,0,canvasOut.width,canvasOut.height);
    try {
      const renderer = await ensureLevelRenderer();
      // Use the same explicit Nanpa-format source as every other descriptive
      // decimal in the Toki Pona UI. Passing `nanpa:${levelNo}` here is wrong:
      // the renderer treats that opener separately and then wraps the parsed
      // decimal again, producing a duplicated `nanpa:` outside the cartouche.
      const source = I18N?.numericCartoucheSource?.(String(levelNo));
      if (!source) throw new Error('no level numeric cartouche source');
      const rendered = await renderer.renderTextToNewCanvas({
        input:source,
        layout:{fontPx:64,align:'center',spacingPreset:'compact',paddingPx:10},
        parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true}
      });
      const src = rendered?.canvas;
      if (!src) throw new Error('no rendered canvas');
      const maxW = canvasOut.width - 16, maxH = canvasOut.height - 16;
      const scale = Math.min(maxW/src.width, maxH/src.height, 1.8);
      const dw = src.width*scale, dh = src.height*scale;
      ctxOut.drawImage(src,(canvasOut.width-dw)/2,(canvasOut.height-dh)/2,dw,dh);
    } catch (err) {
      // Never fake a cartouche by drawing its source syntax with the font. If the
      // renderer is unavailable, the small Latin fallback beside this canvas is
      // already present and remains unambiguous.
      console.warn('[game] level cartouche renderer unavailable', err);
    }
  }

  function showLevelIntro() {
    if (!levelIntroOverlay || !campaignAdapter) return;
    const def = campaignAdapter.currentLevel();
    const levelNo = def?.ordinal || level().chapter;
    // The semantic label belongs outside the numeric cartouche.  Do not put the
    // level number into this label as well: that would create a second inline
    // Nanpa cartouche above the dedicated level-number cartouche.
    renderLocalized(levelIntroTitle, isTpLanguage() ? 'ma musi' : 'Level');
    if (levelIntroLatinNumber) levelIntroLatinNumber.textContent = String(levelNo);
    levelIntroCartouche?.setAttribute('aria-label', isTpLanguage()
      ? `ma musi ${levelNo}: nanpa lon poki nanpa-linja-n lili`
      : `Level ${levelNo} as an abbreviated nanpa-linja-n numeric cartouche`);
    renderLocalized(levelIntroHint, isTpLanguage() ? 'o luka e ma ante la musi li open. Enter/Space li open kin.' : 'Tap anywhere to start · Enter/Space also starts');
    levelIntroShownAt = performance.now();
    openModal(levelIntroOverlay);
    renderLevelIntroCartouche(levelNo);
    levelIntroStartBtn?.focus({preventScroll:true});
  }

  function startLevelFromIntro() {
    if (!levelIntroOverlay || levelIntroOverlay.hidden) return false;
    if (performance.now() - levelIntroShownAt < 180) return false;
    state.levelIntroPending = false;
    closeModal(levelIntroOverlay);
    saveState();
    canvas.focus({preventScroll:true});
    scheduleMobileLandscapeGameCenter();
    return true;
  }

  function openLevelComplete() {
    const levelDef = campaignAdapter?.currentLevel();
    const next = campaignAdapter?.nextLevel?.();
    const levelNo = levelDef?.ordinal || level().chapter;
    const progress = currentLevelProgress();
    const isCampaignComplete = !next;
    setCampaignCelebration(isCampaignComplete);
    if (isCampaignComplete) {
      renderLocalized(levelCompleteEyebrow, isTpLanguage() ? 'musi ale li pini' : 'campaign complete');
      renderLocalized(levelCompleteTitle, isTpLanguage() ? 'pona mute a a' : 'Congratulations!');
      renderLocalized(levelCompleteText, isTpLanguage()
        ? `sina alasa pona e sitelen pona ${STANDARD_120.length} ale. sina pini e ma musi ${campaignAdapter?.runtime?.campaign?.levels?.length || levelNo} ale.`
        : `You recovered all ${STANDARD_120.length} glyphs and completed all ${campaignAdapter?.runtime?.campaign?.levels?.length || levelNo} levels.`);
      renderLocalized(levelCompleteCount, isTpLanguage()
        ? `${collectionCount()} / ${STANDARD_120.length} sitelen li kama · musi ale li pini`
        : `${collectionCount()} / ${STANDARD_120.length} glyphs recovered · full campaign complete`);
      renderLocalized(stayLevelBtn, isTpLanguage() ? 'o awen li alasa' : 'Keep exploring');
    } else {
      renderLocalized(levelCompleteEyebrow, uiText('levelCompleteEyebrow'));
      renderLocalized(levelCompleteTitle, isTpLanguage() ? `ma musi ${levelNo} li pini` : `Level ${levelNo} complete`);
      renderLocalized(levelCompleteText, isTpLanguage()
        ? `sitelen wile ${progress.requiredTotal} pi ma musi ${levelNo} en wile musi ale li pini. sina ken tawa ma musi ${next.ordinal}.`
        : `All ${progress.requiredTotal} required Level ${levelNo} glyphs and mandatory objectives are complete. Continue to Level ${next.ordinal}.`);
      renderLocalized(levelCompleteCount, progressSummaryText(progress));
      renderLocalized(stayLevelBtn, uiText('stayHere'));
    }
    renderLocalized(continueLevelBtn, next ? (isTpLanguage() ? `o tawa ma musi ${next.ordinal}` : `Continue to Level ${next.ordinal}`) : uiText('continue'));
    continueLevelBtn.hidden = !next;
    openModal(levelCompleteOverlay);
    (next ? continueLevelBtn : stayLevelBtn).focus({ preventScroll: true });
    if (isCampaignComplete) celebrationTone();
    else successTone();
  }

  function openModal(el) {
    modalOpen = true; clearMovement(); if (document.pointerLockElement) document.exitPointerLock?.(); el.hidden = false;
    viewportWrap?.classList.add('modalActive');
  }
  function closeModal(el) {
    el.hidden = true;
    modalOpen = anyModalOpen();
    viewportWrap?.classList.toggle('modalActive', modalOpen);
  }
  function anyModalOpen() { return [levelIntroOverlay, glyphPopup, collectionOverlay, sentenceOverlay, puzzleOverlay, levelCompleteOverlay, resetConfirmOverlay].some(el => el && !el.hidden); }

  function transitionLevel(levelId, x, y, angle, message) {
    cancelMapSteering(true);
    state.levelId = levelId; state.chapter = levels[levelId].chapter; state.x = x; state.y = y; state.angle = angle;
    showMessage(message); stepTone(); saveState(); updateHUD();
  }

  function goToNextCampaignLevel() {
    const next = campaignAdapter?.nextLevel?.();
    if (!next) { closeModal(levelCompleteOverlay); return; }
    const result = campaignAdapter.startLevel(next.id);
    if (!result.ok) { showMessage('The next level is not available yet.'); blockedTone(); return; }
    closeModal(levelCompleteOverlay);
    state.campaign = campaignAdapter.snapshot();
    state.levelIntroPending = true;
    state.ballOnTable = false;
    state.carrying = null;
    resetWorldObjects();
    if (next.id === 'L02') transitionLevel('l2main', 3.2, 3.6, 0, 'Level 2 is ready.');
    else if (next.id === 'L03') transitionLevel('l3main', 4.2, 3.6, 0, 'Level 3 is ready.');
    else if (next.id === 'L04') transitionLevel('l4main', 3.6, 3.6, 0, 'Level 4 is ready.');
    else if (next.id === 'L05') transitionLevel('l5main', 3.6, 3.6, 0, 'Level 5 is ready.');
    else if (next.id === 'L06') transitionLevel('l6main', 3.6, 3.6, 0, 'Level 6 is ready.');
    else if (next.id === 'L07') transitionLevel('l7main', 3.6, 3.6, 0, 'Level 7 is ready.');
    else if (next.id === 'L08') transitionLevel('l8main', 3.6, 3.6, 0, 'Level 8 is ready.');
    else if (next.id === 'L09') transitionLevel('l9upper', 3.4, 3.5, 0, 'Level 9 is ready.');
    else if (next.id === 'L10') transitionLevel('l10ground', 3.5, 6.3, 0, 'Level 10 is ready.');
    else if (next.id === 'L11') transitionLevel('l11ground', 3.5, 6.3, 0, 'Level 11 is ready.');
    else if (next.id === 'L12') transitionLevel('l12ground', 3.5, 6.3, 0, 'Level 12 is ready.');
    else transitionLevel('main', 3.1, 4.5, 0, `Level ${next.ordinal} is ready.`);
    log(`Entered Level ${next.ordinal}.`);
    saveState();
    window.setTimeout(() => showLevelIntro(), 40);
  }

  function mobileJoystickCatchUpActive() {
    // Any deliberate joystick input should remain time-based, not only the
    // outer-rim boost. On a slow phone a 70-120 ms render frame must advance
    // the player by the corresponding elapsed time even when the thumb is only
    // part-way from the centre. The input strength still controls the speed.
    return Boolean(
      mobileMove.forward || mobileMove.back || mobileMove.turnLeft || mobileMove.turnRight ||
      mobileMove.moveStrength > 0 || mobileMove.turnStrength > 0
    );
  }

  function mobileJoystickSimulationTiming(dt) {
    const elapsedDt = Math.max(0, Number(dt) || 0);
    const normalDt = Math.min(0.05, elapsedDt);
    const catchUp = mobileJoystickCatchUpActive();
    // requestAnimationFrame's elapsed time is the render-speed feedback. If a
    // phone draws fewer frames, each rendered frame consumes proportionally more
    // movement time. Keep a bounded ceiling for tab resumes and split the
    // displacement into collision-safe substeps rather than teleporting.
    const controlDt = catchUp ? Math.min(MOBILE_JOYSTICK_MAX_FRAME_DT, elapsedDt) : normalDt;
    const simSteps = catchUp ? Math.max(1, Math.ceil(controlDt / MOBILE_JOYSTICK_MAX_SIM_STEP)) : 1;
    return {normalDt, catchUp, controlDt, simSteps, stepDt:simSteps ? controlDt / simSteps : 0};
  }

  function update(dt) {
    if (modalOpen) {
      currentTarget = null; promptEl.textContent = ''; updateHUD(); return;
    }

    // Preserve the historical 50 ms simulation cap for non-joystick control
    // paths. Any active mobile joystick consumes real elapsed frame time (within
    // a bounded resume cap), split into collision-safe simulation substeps.
    const timing = mobileJoystickSimulationTiming(dt);
    const mapSteering = updateMapSteering(timing.normalDt);
    if (!mapSteering) {
      const {simSteps,stepDt} = timing;

      for (let simStep = 0; simStep < simSteps; simStep += 1) {
        let turn = 0;
        if (keys.ArrowLeft) turn -= 1;
        if (keys.ArrowRight) turn += 1;
        if (mobileMove.turnLeft) turn -= mobileMove.turnStrength;
        if (mobileMove.turnRight) turn += mobileMove.turnStrength;
        state.angle = normalizeAngle(state.angle + turn * ROTATE_SPEED * stepDt);

        let forward = 0, strafe = 0;
        if (keys.KeyW || keys.ArrowUp) forward += 1;
        if (keys.KeyS || keys.ArrowDown) forward -= 1;
        if (mobileMove.forward) forward += mobileMove.moveStrength;
        if (mobileMove.back) forward -= mobileMove.moveStrength;
        if (viewportMove.mode === 'forward') forward += viewportMove.strength;
        if (viewportMove.mode === 'back') forward -= viewportMove.strength;
        if (keys.KeyA) strafe -= 1;
        if (keys.KeyD) strafe += 1;

        if (forward || strafe) {
          const coarse = isCoarsePointer();
          const joystickDriving = mobileMove.forward || mobileMove.back;
          const mobileMovement = coarse || joystickDriving;
          if (mobileMovement) {
            // Joystick travel is intentionally allowed to exceed 1.0 at larger
            // radii. Key this to active joystick input as well as coarse-pointer
            // detection so hybrid/mobile browsers cannot accidentally normalize
            // the outer-rim speed boost away.
            forward = Math.max(-MOBILE_JOYSTICK_MOVE_MAX, Math.min(MOBILE_JOYSTICK_MOVE_MAX, forward));
            strafe = Math.max(-1, Math.min(1, strafe));
          } else {
            const len = Math.max(1, Math.hypot(forward, strafe));
            forward /= len; strafe /= len;
          }
          const cos = Math.cos(state.angle), sin = Math.sin(state.angle);
          const ms = mobileMovement ? MOBILE_MOVE_SPEED : MOVE_SPEED;
          const ss = mobileMovement ? MOBILE_STRAFE_SPEED : STRAFE_SPEED;
          const dx = (cos * forward * ms + -sin * strafe * ss) * stepDt;
          const dy = (sin * forward * ms + cos * strafe * ss) * stepDt;
          movePlayer(dx, dy, mobileMovement);
        }
      }
    }

    currentTarget = findInteractionTarget();
    renderLocalized(promptEl, interactionTextLocalized(currentTarget));
    updateHUD();
  }

  function frame(now) {
    // The rAF timestamp already measures the combined effect of drawing cost and
    // scheduling delay. Preserve enough of that elapsed time for mobile joystick
    // catch-up; update() applies the smaller legacy cap to non-joystick controls.
    const dt = Math.min(0.25, Math.max(0, (now - lastTime) / 1000));
    lastTime = now; update(dt); renderScene(); requestAnimationFrame(frame);
  }

  function renderExactPlayerText(el, source) {
    const raw=String(source ?? '');
    const localized=exactText(raw);
    // English source copy that has no Toki Pona mapping must never be passed to the
    // sitelen-pona ligature font: doing so can collapse its spaces/words into a run.
    const untranslatedTpFallback=isTpLanguage() && localized===raw;
    renderLocalized(el, localized, {sitelen:!untranslatedTpFallback});
  }

  function showMessage(text) {
    clearTimeout(messageTimer);
    renderExactPlayerText(messageEl, text);
    messageEl.classList.add('show');
    messageTimer = setTimeout(() => messageEl.classList.remove('show'), 3200);
  }

  function showLocalizedMessage(text) {
    clearTimeout(messageTimer);
    renderLocalized(messageEl, text, {sitelen:isTpLanguage()});
    messageEl.classList.add('show');
    messageTimer = setTimeout(() => messageEl.classList.remove('show'), 3200);
  }

  function log(text) {
    const item = { t: Date.now(), text };
    state.log.unshift(item); state.log = state.log.slice(0, 40); renderLog(); saveState();
  }

  function renderLog() {
    fieldLogEl.textContent = '';
    if (!state.log.length) { const d = document.createElement('div'); renderLocalized(d, uiText('noFieldNotes')); fieldLogEl.appendChild(d); return; }
    for (const entry of state.log) { const d = document.createElement('div'); d.className = 'fieldLogEntry'; renderExactPlayerText(d, entry.text); fieldLogEl.appendChild(d); }
  }

  function ensureAudio() {
    if (!state.sound) return null;
    if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; audioCtx = new AC(); }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  function tone(freq, duration = 0.08, type = 'sine', gain = 0.03, delay = 0) {
    const a = ensureAudio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + delay + duration);
    o.connect(g); g.connect(a.destination); o.start(a.currentTime + delay); o.stop(a.currentTime + delay + duration);
  }
  function successTone() { tone(440,.09,'triangle',.035); tone(660,.11,'triangle',.035,.09); tone(880,.13,'triangle',.035,.20); }
  function blockedTone() { tone(130,.12,'square',.018); }
  function pickupTone() { tone(380,.06,'triangle',.025); tone(540,.08,'triangle',.025,.05); }
  function doorTone() { tone(95,.16,'sawtooth',.018); tone(125,.20,'sawtooth',.012,.08); }
  function powerTone() { tone(90,.18,'sine',.03); tone(180,.22,'sine',.025,.13); tone(360,.26,'triangle',.022,.30); }
  function stepTone() { tone(170,.045,'triangle',.014); tone(135,.05,'triangle',.012,.06); }
  function softTone() { tone(300,.07,'sine',.018); }
  function celebrationTone() { successTone(); tone(990,.12,'triangle',.032,.34); tone(1320,.16,'triangle',.028,.48); }

  function ensureCampaignConfetti() {
    if (!campaignConfetti || campaignConfetti.childElementCount) return;
    const colors = ['#f4c430','#ff7f50','#5cc8ff','#90be6d','#f28482','#9d4edd','#ffd166','#06d6a0'];
    for (let i = 0; i < 72; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confettiPiece';
      piece.style.left = `${1 + ((i * 37) % 98)}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--delay', `${-((i % 19) * 0.27).toFixed(2)}s`);
      piece.style.setProperty('--fall', `${(3.8 + (i % 9) * 0.31).toFixed(2)}s`);
      piece.style.setProperty('--w', `${6 + (i % 4) * 2}px`);
      piece.style.setProperty('--h', `${8 + (i % 5) * 3}px`);
      piece.style.setProperty('--radius', i % 6 === 0 ? '50%' : '2px');
      piece.style.setProperty('--drift', `${((i % 2 === 0 ? 1 : -1) * (18 + (i % 7) * 9))}px`);
      piece.style.setProperty('--spin', `${(i % 2 === 0 ? 1 : -1) * (520 + (i % 8) * 90)}deg`);
      campaignConfetti.appendChild(piece);
    }
  }

  function setCampaignCelebration(active) {
    const on = Boolean(active);
    if (levelCompleteCard) levelCompleteCard.classList.toggle('isCampaignComplete', on);
    if (campaignCompleteBadge) campaignCompleteBadge.hidden = !on;
    if (campaignConfetti) {
      ensureCampaignConfetti();
      campaignConfetti.hidden = !on;
    }
    if (levelCompleteTitle) {
      levelCompleteTitle.classList.remove('campaignCongratsFlash');
      if (on) {
        void levelCompleteTitle.offsetWidth;
        levelCompleteTitle.classList.add('campaignCongratsFlash');
      }
    }
  }

  function restoreDoorState() {
    for (const levelData of Object.values(levels)) {
      for (const door of levelData.doors) door.open = Boolean(state.openDoors?.[door.id]);
    }
  }

  function resetWorldObjects() {
    for (const levelData of Object.values(levels)) for (const door of levelData.doors) door.open = false;
  }

  function openResetConfirm() {
    if (!resetConfirmOverlay) { resetGame(); return; }
    renderLocalized(resetConfirmProgress, isTpLanguage()
      ? `${collectionCount()} / ${STANDARD_120.length} sitelen li kama`
      : `${collectionCount()} / ${STANDARD_120.length} glyphs recovered`);
    openModal(resetConfirmOverlay);
    resetConfirmCancelBtn?.focus({ preventScroll: true });
  }

  async function resetGame() {
    if (resetConfirmOverlay && !resetConfirmOverlay.hidden) closeModal(resetConfirmOverlay);
    try { window.TokiPonaGameReset?.clearResetDirective?.(window.localStorage); } catch (_) {}
    state = freshState();
    resetWorldObjects();
    campaignAdapter = window.TokiPonaCampaignEngineAdapter.createAdapter({ campaign: window.TOKI_PONA_CAMPAIGN, persisted:null });
    state.campaign = campaignAdapter.snapshot();
    syncWorldFromCampaign();
    spriteCache.clear(); saveState(); await flushSave({replace:true});
    state.levelIntroPending = true;
    renderLog(); renderCollection(); updateHUD(); showMessage('New campaign started.');
    window.setTimeout(() => showLevelIntro(), 40);
  }

  function leaveSolvedMazeQuickly() {
    if (modalOpen || state.levelId !== 'maze' || !campaignWorld().mazeExitReleased) return false;
    clearMovement();
    transitionLevel('main', 3.2, 9.3, 0, 'You return to the maze entrance. The solved maze remains open.');
    return true;
  }


  // ---------------------------------------------------------------------------
  // QA campaign runner. This is deliberately absent from normal gameplay and is
  // installed only for game-engine.html?qa=1. It uses the real campaign adapter,
  // door requirements and puzzle completion path, while accelerating navigation
  // after proving a legal route exists.
  // ---------------------------------------------------------------------------
  const qaState = {
    installed:false, running:false, paused:false, stopped:false, stepBudget:0,
    speed:1, includeOptional:true, focusPuzzleId:null, lastAction:'idle',
    actionNo:0, runPromise:null, inPlaybackAction:false, badge:null, statusText:null, pauseBtn:null,
    stepBtn:null, runBtn:null, backBtn:null, restartBtn:null, stopBtn:null, slowerBtn:null, fasterBtn:null, ignoreBtn:null,
    hotspot:null, lastHotspotTapAt:0, touchPanelOpen:false,
    puzzleHistory:[], historyCursor:-1, restoringCheckpoint:false,
    suppressTouchControlClickPointerId:null, suppressTouchControlClickUntil:0
  };

  const QA_TRANSITION_DESTINATIONS = Object.freeze({
    mazeEnter:'maze', mazeExit:'main', ladderUp:'upper', ladderDown:'main', trapdoor:'lower', lowerLadderUp:'upper',
    l9UpperToMaze:'l9maze', l9MazeToUpper:'l9upper', l9UpperShortcutToSphinx:'l9maze', l9SphinxToUpper:'l9upper',
    l9SphinxToLower:'l9lower', l9LowerToSphinx:'l9maze', l9WeightsToUpper:'l9upper', l9UpperShortcutToWeights:'l9lower',
    l9UpperToVault:'l9lower', l9VaultToUpper:'l9upper',
    l10GroundToLower:'l10lower', l10LowerToGround:'l10ground', l10LowerToUpper:'l10upper', l10UpperToLower:'l10lower',
    l10GroundToUpper:'l10upper', l10UpperToGround:'l10ground',
    l11GroundToCanopy:'l11canopy', l11CanopyToGround:'l11ground', l11CanopyToLower:'l11lower', l11LowerToCanopy:'l11canopy',
    l11CanopyToRecovery:'l11ground', l11RecoveryToCanopy:'l11canopy',
    l12GroundToUpper:'l12upper', l12UpperToGround:'l12ground', l12GroundToLower:'l12lower', l12LowerToGround:'l12ground',
    l12LowerToFinal:'l12final', l12FinalToLower:'l12lower'
  });


  const QA_TRANSITION_PAIRS = Object.freeze({
    mazeEnter:'mazeExit', mazeExit:'mazeEnter', ladderUp:'ladderDown', ladderDown:'ladderUp', trapdoor:'lowerLadderUp', lowerLadderUp:'trapdoor',
    l9UpperToMaze:'l9MazeToUpper', l9MazeToUpper:'l9UpperToMaze',
    l9UpperShortcutToSphinx:'l9SphinxToUpper', l9SphinxToUpper:'l9UpperShortcutToSphinx',
    l9SphinxToLower:'l9LowerToSphinx', l9LowerToSphinx:'l9SphinxToLower',
    l9WeightsToUpper:'l9UpperShortcutToWeights', l9UpperShortcutToWeights:'l9WeightsToUpper',
    l9UpperToVault:'l9VaultToUpper', l9VaultToUpper:'l9UpperToVault',
    l10GroundToLower:'l10LowerToGround', l10LowerToGround:'l10GroundToLower',
    l10LowerToUpper:'l10UpperToLower', l10UpperToLower:'l10LowerToUpper',
    l10GroundToUpper:'l10UpperToGround', l10UpperToGround:'l10GroundToUpper',
    l11GroundToCanopy:'l11CanopyToGround', l11CanopyToGround:'l11GroundToCanopy',
    l11CanopyToLower:'l11LowerToCanopy', l11LowerToCanopy:'l11CanopyToLower',
    l11CanopyToRecovery:'l11RecoveryToCanopy', l11RecoveryToCanopy:'l11CanopyToRecovery',
    l12GroundToUpper:'l12UpperToGround', l12UpperToGround:'l12GroundToUpper',
    l12GroundToLower:'l12LowerToGround', l12LowerToGround:'l12GroundToLower',
    l12LowerToFinal:'l12FinalToLower', l12FinalToLower:'l12LowerToFinal'
  });

  function qaDelayMs(base) {
    return Math.max(35, Math.round((Number(base) || 0) / Math.max(.15, Number(qaState.speed) || 1)));
  }

  function qaSleep(base=500) {
    return new Promise(resolve => window.setTimeout(resolve, qaDelayMs(base)));
  }

  function qaLog(message, data) {
    const levelNo=campaignAdapter?.currentLevel?.()?.ordinal || state.chapter || '?';
    const prefix=`[TPQA L${levelNo}]`;
    if(data===undefined) console.log(prefix,message); else console.log(prefix,message,data);
    qaState.lastAction=String(message||'');
    qaUpdateBadge();
  }

  function qaTouchControlsPreferred() {
    try { return Boolean(window.matchMedia?.('(pointer: coarse)')?.matches); }
    catch (_) { return false; }
  }

  function qaSetTouchPanelOpen(open) {
    if(!QA_MODE || !qaState.badge) return false;
    qaState.touchPanelOpen=Boolean(open);
    qaState.badge.classList.toggle('qaPanel--touchOpen',qaState.touchPanelOpen);
    // Ignore/reveal semantics are device-independent. The old touch-only concealment
    // meant Ignore appeared to do nothing on laptops because fine-pointer QA panels
    // could never receive the concealed class.
    qaState.badge.classList.toggle('qaPanel--concealed',!qaState.touchPanelOpen);
    qaState.badge.classList.toggle('qaPanel--touchConcealed',qaTouchControlsPreferred()&&!qaState.touchPanelOpen);
    qaState.badge.setAttribute('aria-hidden',qaState.touchPanelOpen?'false':'true');
    return qaState.touchPanelOpen;
  }

  function qaRevealTouchControls() {
    if(!QA_MODE) return false;
    if(qaState.running&&!qaState.paused) qaPause();
    qaSetTouchPanelOpen(true);
    qaLog('touch controls opened');
    return true;
  }

  function qaIgnoreTouchControls() {
    if(!QA_MODE) return false;
    qaSetTouchPanelOpen(false);
    return true;
  }

  function qaHandleHotspotPointerDown(e) {
    if(!QA_MODE || !qaTouchControlsPreferred()) return;
    // Keep the QA gesture out of the normal viewport drag handler. That handler
    // captures pointers on pointerdown, which would retarget pointerup away from
    // this hotspot and make the mobile double-tap impossible to complete.
    e.preventDefault();
    e.stopPropagation();
  }

  function qaHandleHotspotPointerUp(e) {
    if(!QA_MODE || !qaTouchControlsPreferred()) return;
    e.preventDefault();
    e.stopPropagation();
    const now=window.performance?.now?.() ?? Date.now();
    const gap=now-qaState.lastHotspotTapAt;
    qaState.lastHotspotTapAt=now;
    if(gap>0&&gap<=360){
      qaState.lastHotspotTapAt=0;
      // Chromium can synthesize the tap's click after pointerup. In short-landscape
      // layout the newly revealed control strip appears beneath that same finger,
      // so consume only that originating click instead of accidentally activating
      // whichever QA button now occupies the hotspot coordinates.
      qaState.suppressTouchControlClickPointerId=Number.isFinite(e.pointerId)?e.pointerId:null;
      qaState.suppressTouchControlClickUntil=now+500;
      qaRevealTouchControls();
    }
  }

  function qaHandleTouchControlCaptureClick(e) {
    if(!QA_MODE || !qaState.suppressTouchControlClickUntil) return;
    const now=window.performance?.now?.() ?? Date.now();
    if(now>qaState.suppressTouchControlClickUntil){
      qaState.suppressTouchControlClickPointerId=null;
      qaState.suppressTouchControlClickUntil=0;
      return;
    }
    const clickPointerId=Number.isFinite(e.pointerId)?e.pointerId:null;
    const sameOrigin=qaState.suppressTouchControlClickPointerId===null || clickPointerId===null || clickPointerId===qaState.suppressTouchControlClickPointerId;
    if(!sameOrigin) return;
    qaState.suppressTouchControlClickPointerId=null;
    qaState.suppressTouchControlClickUntil=0;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function qaRevealFromDesktopLevel(e) {
    if(!QA_MODE || qaTouchControlsPreferred()) return false;
    e?.preventDefault?.();
    e?.stopPropagation?.();
    qaRevealTouchControls();
    return true;
  }

  function qaInstallDesktopLevelReveal() {
    if(!QA_MODE || !levelEl) return;
    levelEl.classList.add('qaLevelRevealTarget');
    // The HUD normally ignores pointer input so gameplay can receive it. In QA mode
    // the level badge is deliberately the one laptop reveal target; keep its clicks
    // out of viewport drag / interaction / pointer-lock handling.
    const block=e=>{ if(!qaTouchControlsPreferred()) e.stopPropagation(); };
    levelEl.addEventListener('pointerdown',block);
    levelEl.addEventListener('pointerup',block);
    levelEl.addEventListener('click',block);
    levelEl.addEventListener('dblclick',qaRevealFromDesktopLevel);
  }

  function qaDispatchControlAction(action) {
    if(!QA_MODE) return Promise.resolve(false);
    try{
      switch(String(action||'')){
        case 'pause': return Promise.resolve(qaTogglePause());
        case 'run': return Promise.resolve(qaRunCampaign());
        case 'step': return Promise.resolve(qaStep());
        case 'back': qaLog('backtracking…'); return Promise.resolve(qaBackToPreviousPuzzleStart());
        case 'stop': return Promise.resolve(qaStop());
        case 'slower': return Promise.resolve(qaSetSpeed(qaState.speed/1.35));
        case 'faster': return Promise.resolve(qaSetSpeed(qaState.speed*1.35));
        case 'ignore': return Promise.resolve(qaIgnoreTouchControls());
        case 'restart': return Promise.resolve(qaRestartCampaign());
        default: return Promise.resolve(false);
      }
    }catch(err){ return Promise.reject(err); }
  }

  function qaHandleControlClick(e) {
    if(!QA_MODE) return;
    const button=e.target?.closest?.('.qaMiniButton[data-qa-action]');
    if(!button || !e.currentTarget?.contains?.(button)) return;
    e.preventDefault();
    e.stopPropagation();
    qaDispatchControlAction(button.dataset.qaAction).catch(err=>qaFail(err));
  }

  function qaUpdateBadge() {
    if(!QA_MODE || !qaState.badge) return;
    const levelNo=campaignAdapter?.currentLevel?.()?.ordinal || state.chapter || '?';
    const mode=qaState.running?(qaState.paused?'PAUSED':'RUNNING'):'READY';
    const focus=activeCampaignPuzzle?.id || qaState.focusPuzzleId || 'next objective';
    qaState.statusText.textContent=`QA ${mode} · L${levelNo} · ×${qaState.speed.toFixed(2)} · ${focus}`;
    qaState.pauseBtn.textContent='P';
    qaState.pauseBtn.title=qaState.paused?'Resume (P)':'Pause (P)';
    qaState.pauseBtn.setAttribute('aria-label',qaState.paused?'Resume QA playback':'Pause QA playback');
  }

  function qaInstallBadge() {
    if(!QA_MODE || qaState.badge) return;
    const panel=document.createElement('div'); panel.className='qaPanel'; panel.setAttribute('role','status'); panel.setAttribute('aria-live','polite');
    const text=document.createElement('span'); text.className='qaStatusText';
    const controls=document.createElement('span'); controls.className='qaControls';
    const restart=document.createElement('button'); restart.type='button'; restart.className='qaMiniButton qaRestartButton'; restart.title='Restart campaign from Level 1 and run (X)'; restart.setAttribute('aria-label','Restart campaign from Level 1 and run'); restart.textContent='X'; restart.dataset.qaAction='restart';
    const pause=document.createElement('button'); pause.type='button'; pause.className='qaMiniButton'; pause.title='Pause / resume QA playback (P)'; pause.setAttribute('aria-label','Pause or resume QA playback'); pause.textContent='P'; pause.dataset.qaAction='pause';
    const run=document.createElement('button'); run.type='button'; run.className='qaMiniButton'; run.title='Run / continue campaign QA (R)'; run.setAttribute('aria-label','Run or continue QA campaign'); run.textContent='R'; run.dataset.qaAction='run';
    const step=document.createElement('button'); step.type='button'; step.className='qaMiniButton'; step.title='One QA step (N)'; step.setAttribute('aria-label','Run one QA step'); step.textContent='N'; step.dataset.qaAction='step';
    const back=document.createElement('button'); back.type='button'; back.className='qaMiniButton'; back.title='Previous puzzle start (B)'; back.setAttribute('aria-label','Return to the start of the previous QA puzzle'); back.textContent='B'; back.dataset.qaAction='back';
    const stop=document.createElement('button'); stop.type='button'; stop.className='qaMiniButton'; stop.title='Stop QA playback (S)'; stop.setAttribute('aria-label','Stop QA playback'); stop.textContent='S'; stop.dataset.qaAction='stop';
    const slower=document.createElement('button'); slower.type='button'; slower.className='qaMiniButton'; slower.title='Slow QA playback ([)'; slower.setAttribute('aria-label','Slow QA playback'); slower.textContent='−'; slower.dataset.qaAction='slower';
    const faster=document.createElement('button'); faster.type='button'; faster.className='qaMiniButton'; faster.title='Speed up QA playback (])'; faster.setAttribute('aria-label','Speed up QA playback'); faster.textContent='+'; faster.dataset.qaAction='faster';
    const ignore=document.createElement('button'); ignore.type='button'; ignore.className='qaMiniButton qaIgnoreButton'; ignore.title='Hide QA controls'; ignore.setAttribute('aria-label','Hide QA controls'); ignore.textContent='Ignore'; ignore.dataset.qaAction='ignore';
    controls.append(pause,run,step,back,stop,slower,faster,ignore,restart); panel.append(text,controls); viewportWrap?.appendChild(panel);
    const hotspot=document.createElement('div'); hotspot.className='qaHotspot'; hotspot.setAttribute('aria-label','QA controls: double tap'); hotspot.setAttribute('role','button'); hotspot.setAttribute('tabindex','-1'); viewportWrap?.appendChild(hotspot);
    qaState.badge=panel; qaState.statusText=text; qaState.pauseBtn=pause; qaState.stepBtn=step; qaState.runBtn=run; qaState.backBtn=back; qaState.restartBtn=restart; qaState.stopBtn=stop; qaState.slowerBtn=slower; qaState.fasterBtn=faster; qaState.ignoreBtn=ignore; qaState.hotspot=hotspot;
    // QA controls sit inside viewportWrap, whose normal pointerdown handler starts
    // mouse/touch look and captures the pointer. Make the QA panel an input barrier
    // so laptop clicks and touch presses stay with the QA controls instead of being
    // captured by gameplay underneath.
    const qaBlockGameplayPointer=e=>e.stopPropagation();
    panel.addEventListener('pointerdown',qaBlockGameplayPointer);
    panel.addEventListener('pointerup',qaBlockGameplayPointer);
    panel.addEventListener('pointercancel',qaBlockGameplayPointer);
    panel.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();});
    controls.addEventListener('click',qaHandleTouchControlCaptureClick,true);
    controls.addEventListener('click',qaHandleControlClick);
    hotspot.addEventListener('pointerdown',qaHandleHotspotPointerDown,{passive:false});
    hotspot.addEventListener('pointerup',qaHandleHotspotPointerUp,{passive:false});
    qaInstallDesktopLevelReveal();
    qaSetTouchPanelOpen(!qaTouchControlsPreferred());
    qaUpdateBadge();
  }

  function qaCheckpointSnapshot() {
    if(campaignAdapter) state.campaign=campaignAdapter.snapshot();
    return JSON.parse(JSON.stringify(state));
  }

  function qaReplayableCheckpointSnapshot(entry, campaign=window.TOKI_PONA_CAMPAIGN) {
    const snapshot=JSON.parse(JSON.stringify(entry?.snapshot||{}));
    if(!snapshot?.campaign || !entry?.puzzleId || !campaign) return snapshot;
    const level=(campaign.levels||[]).find(item=>(item.puzzles||[]).some(p=>p.id===entry.puzzleId));
    const puzzle=level?.puzzles?.find(p=>p.id===entry.puzzleId)||null;
    if(!level || !puzzle) return snapshot;
    const levelState=snapshot.campaign.levelStates?.[level.id];
    if(levelState){
      levelState.solvedPuzzles=(levelState.solvedPuzzles||[]).filter(id=>id!==entry.puzzleId);
      levelState.completed=false;
    }
    // CampaignRuntime.applyAlreadyOwned() is correct for normal saves, but QA B is
    // explicitly asking to replay this puzzle. If its reward glyphs are still owned,
    // the runtime can immediately auto-solve the checkpoint again. Remove only this
    // puzzle's reward glyphs from the replay branch; completing it manually/through QA
    // awards them again through the normal completion path.
    const replayRewards=new Set(puzzle.rewards?.glyphs||[]);
    if(replayRewards.size){
      const earnedElsewhere=new Set(campaign.baselineGlyphs||[]);
      for(const otherLevel of campaign.levels||[]){
        const solved=new Set(snapshot.campaign.levelStates?.[otherLevel.id]?.solvedPuzzles||[]);
        for(const otherPuzzle of otherLevel.puzzles||[]){
          if(otherPuzzle.id===entry.puzzleId || !solved.has(otherPuzzle.id)) continue;
          for(const g of otherPuzzle.rewards?.glyphs||[]) earnedElsewhere.add(g);
        }
      }
      const replayOnlyRewards=new Set([...replayRewards].filter(g=>!earnedElsewhere.has(g)));
      snapshot.campaign.globalGlyphs=(snapshot.campaign.globalGlyphs||[]).filter(g=>!replayOnlyRewards.has(g));
      if(snapshot.collected) for(const g of replayOnlyRewards) delete snapshot.collected[g];
    }
    snapshot.levelCompleted=false;
    return snapshot;
  }

  function qaRecordPuzzleCheckpoint(puzzle) {
    if(!QA_MODE || qaState.restoringCheckpoint || !puzzle || campaignSolved(puzzle.id)) return null;
    const current=qaState.puzzleHistory[qaState.historyCursor] || null;
    if(current?.puzzleId===puzzle.id) return current;
    if(qaState.historyCursor<qaState.puzzleHistory.length-1) qaState.puzzleHistory=qaState.puzzleHistory.slice(0,qaState.historyCursor+1);
    const entry={
      puzzleId:puzzle.id,
      level:Number(campaignAdapter?.currentLevel?.()?.ordinal || state.chapter || 0),
      levelId:state.levelId,
      snapshot:qaCheckpointSnapshot()
    };
    qaState.puzzleHistory.push(entry);
    qaState.historyCursor=qaState.puzzleHistory.length-1;
    qaLog(`checkpoint: ${puzzle.id}`);
    return entry;
  }

  function qaCloseTransientOverlaysForRestore() {
    for(const el of [levelIntroOverlay,glyphPopup,collectionOverlay,sentenceOverlay,puzzleOverlay,levelCompleteOverlay,resetConfirmOverlay]){
      if(el && !el.hidden) closeModal(el);
    }
    activeCampaignPuzzle=null;
    activePanelId=null;
    puzzleSlotValues=[];
    selectedPuzzleGlyph=null;
    selectedPuzzleFamily=null;
    selectedPuzzleSlotIndex=null;
    puzzleMechanismState=null;
    pendingGlyphRewards=[];
    clearTutorialSubmissionFeedback();
  }

  async function qaRestorePuzzleCheckpoint(index) {
    const entry=qaState.puzzleHistory[index];
    if(!entry) return false;
    qaState.restoringCheckpoint=true;
    try{
      qaCloseTransientOverlaysForRestore();
      state=normalizeSavedState(qaReplayableCheckpointSnapshot(entry));
      campaignAdapter=window.TokiPonaCampaignEngineAdapter.createAdapter({campaign:window.TOKI_PONA_CAMPAIGN,persisted:state.campaign||null});
      syncWorldFromCampaign();
      restoreDoorState();
      spriteCache.clear();
      renderLog(); renderCollection(); updateHUD();
      qaState.focusPuzzleId=null;
      qaState.historyCursor=index;
      const puzzle=campaignPuzzle(entry.puzzleId);
      if(!puzzle || campaignSolved(entry.puzzleId)) throw new Error(`QA checkpoint cannot restore ${entry.puzzleId}`);
      if(qaIsPhysicalPuzzle(puzzle)){
        const ref=qaPrimaryPhysicalObject(puzzle);
        if(ref) await qaTravelToObjectRef(ref);
        qaState.focusPuzzleId=puzzle.id;
      }else{
        openCampaignPuzzleById(puzzle.id);
        if(activeCampaignPuzzle?.id!==puzzle.id) throw new Error(`QA checkpoint could not reopen ${puzzle.id}`);
      }
      state.campaign=campaignAdapter.snapshot();
      saveState();
      qaLog(`restored puzzle start: ${puzzle.id}`);
      qaUpdateBadge();
      return true;
    } finally {
      qaState.restoringCheckpoint=false;
    }
  }

  async function qaStopForwardRunnerForBacktrack() {
    // Backtracking must never leave the old runCampaign async loop alive. A
    // restored checkpoint is a new QA branch: B rewinds state, while the next R
    // starts a fresh forward runner from that restored/manual state.
    if(!qaState.running) return false;
    if(!qaState.paused) qaPause();
    while(qaState.inPlaybackAction) await new Promise(r=>window.setTimeout(r,50));
    qaState.stopped=true;
    qaState.paused=false;
    qaState.stepBudget=0;
    qaUpdateBadge();
    try {
      await qaState.runPromise;
    } catch (err) {
      if(!String(err?.message||err).includes('QA run stopped')) throw err;
    }
    qaState.running=false;
    qaState.stopped=false;
    qaState.paused=true;
    qaState.stepBudget=0;
    qaState.inPlaybackAction=false;
    qaState.runPromise=null;
    qaUpdateBadge();
    return true;
  }

  function qaArmPausedForwardRunner() {
    if(!QA_MODE || qaState.running || !campaignAdapter) return false;
    qaRunCampaign({speed:qaState.speed,includeOptional:qaState.includeOptional,startPaused:true}).catch(err=>qaFail(err));
    return true;
  }

  function qaPreviousDistinctPuzzleIndex(history,cursor,currentPuzzleId=null) {
    const entries=Array.isArray(history)?history:[];
    if(!entries.length) return -1;
    let at=Math.min(Number.isInteger(cursor)?cursor:entries.length-1,entries.length-1);
    if(at<0) at=entries.length-1;
    const currentId=currentPuzzleId || entries[at]?.puzzleId || null;
    let target=at;
    // If the cursor itself represents the puzzle currently being tested (including
    // the common case after Leave, where activeCampaignPuzzle is already null),
    // step off that puzzle before looking for the previous one.
    if(currentId && entries[target]?.puzzleId===currentId) target-=1;
    // Manual open/leave/re-open activity can create more than one checkpoint for
    // the same puzzle. B means previous PUZZLE, so skip the whole same-ID run.
    while(target>=0 && currentId && entries[target]?.puzzleId===currentId) target-=1;
    return target;
  }

  async function qaBackToPreviousPuzzleStart() {
    if(!QA_MODE) throw new Error('TPQA is available only with ?qa=1');
    qaLog('backtracking…');
    await qaStopForwardRunnerForBacktrack();
    if(!qaState.puzzleHistory.length){qaLog('no earlier puzzle checkpoint');return false;}
    const cursor=Math.min(qaState.historyCursor,qaState.puzzleHistory.length-1);
    const currentId=activeCampaignPuzzle?.id || qaState.focusPuzzleId || qaState.puzzleHistory[cursor]?.puzzleId || null;
    const target=qaPreviousDistinctPuzzleIndex(qaState.puzzleHistory,cursor,currentId);
    if(target<0){qaLog('already at first puzzle checkpoint');return false;}
    qaState.paused=true; qaState.stepBudget=0; qaUpdateBadge();
    const restored=await qaRestorePuzzleCheckpoint(target);
    if(restored) qaArmPausedForwardRunner();
    return restored;
  }

  async function qaBoundary() {
    // Pause/step is a playback boundary, not a mid-puzzle freeze. Once one QA
    // progression action has started, let that atomic action finish normally.
    if(!qaState.running || qaState.inPlaybackAction) return;
    if(qaState.stopped) throw new Error('QA run stopped');
    while(qaState.paused && qaState.stepBudget<=0 && !qaState.stopped) await new Promise(r=>window.setTimeout(r,80));
    if(qaState.stopped) throw new Error('QA run stopped');
    if(qaState.paused && qaState.stepBudget>0) qaState.stepBudget-=1;
  }

  function qaPause() { if(!QA_MODE) return false; qaState.paused=true; qaLog('paused'); return true; }
  function qaResume() { if(!QA_MODE) return false; qaState.paused=false; qaState.stepBudget=0; qaLog('resumed'); return true; }
  function qaTogglePause() { return qaState.paused?qaResume():qaPause(); }
  function qaStop() { if(!QA_MODE) return false; qaState.stopped=true; qaState.paused=false; qaState.stepBudget=0; qaLog('stopping after current atomic action'); return true; }
  function qaSetSpeed(value) { const n=Number(value); if(!Number.isFinite(n)) return qaState.speed; qaState.speed=Math.max(.15,Math.min(8,n)); qaLog(`speed ×${qaState.speed.toFixed(2)}`); return qaState.speed; }
  function qaStep() {
    if(!QA_MODE) return Promise.resolve(false);
    if(qaState.running){ qaState.paused=true; qaState.stepBudget+=1; qaUpdateBadge(); return Promise.resolve(true); }
    return qaSolveAndNext({singleStep:true});
  }

  function qaObjectVisible(obj) {
    try { return !obj?.visibleWhen || Boolean(obj.visibleWhen()); } catch (_) { return false; }
  }

  function qaFindObjectById(id) {
    for(const [levelId,levelData] of Object.entries(levels)){
      const obj=(levelData.objects||[]).find(item=>item.id===id);
      if(obj) return {levelId,obj};
    }
    return null;
  }

  function qaFindObjectsForPuzzle(puzzleId) {
    const out=[];
    for(const [levelId,levelData] of Object.entries(levels)) for(const obj of levelData.objects||[]){
      if(obj.puzzleId===puzzleId) out.push({levelId,obj});
    }
    return out;
  }

  function qaLevelIdForArea(areaId) {
    for(const [levelId,levelData] of Object.entries(levels)) if((levelData.rooms||[]).some(room=>room.areaId===areaId)) return levelId;
    return null;
  }

  function qaTransitionAllowed(interact) {
    const world=campaignWorld();
    if(interact==='mazeEnter') return Boolean(world.mazeEntranceUnlocked);
    if(interact==='mazeExit') return Boolean(world.mazeExitReleased);
    if(interact==='ladderUp') return Boolean(world.upperAccess);
    if(interact==='trapdoor') return Boolean(world.maintenanceAccess);
    return true;
  }

  function qaTransitionEdges(levelId) {
    const out=[];
    for(const obj of levels[levelId]?.objects||[]){
      const dest=QA_TRANSITION_DESTINATIONS[obj.interact];
      if(!dest || !qaObjectVisible(obj) || !qaTransitionAllowed(obj.interact)) continue;
      out.push({from:levelId,to:dest,obj});
    }
    return out;
  }

  function qaLevelRoute(from,to) {
    if(from===to) return [];
    const q=[from], seen=new Set([from]), prev=new Map();
    for(let i=0;i<q.length;i++){
      const here=q[i];
      for(const edge of qaTransitionEdges(here)){
        if(seen.has(edge.to)) continue;
        seen.add(edge.to); prev.set(edge.to,{from:here,edge}); q.push(edge.to);
        if(edge.to===to){
          const path=[]; let cur=to;
          while(cur!==from){const p=prev.get(cur);path.push(p.edge);cur=p.from;}
          return path.reverse();
        }
      }
    }
    return null;
  }

  function qaCellInfo(levelId,x,y,allowUnlockable=true) {
    const data=levels[levelId]; if(!data) return {passable:false};
    if(y<0||y>=data.map.length||x<0||x>=data.map[y].length) return {passable:false};
    const ch=data.map[y][x]; if(ch==='#') return {passable:false};
    if(ch==='D'||ch==='P'){
      const door=(data.doors||[]).find(d=>d.x===x&&d.y===y);
      if(!door) return {passable:false};
      if(door.open) return {passable:true,door};
      const status=doorRequirementStatus(door);
      return {passable:Boolean(allowUnlockable&&status.ok),door,status};
    }
    return {passable:true};
  }

  function qaGridPath(levelId,start,target,allowUnlockable=true) {
    const sx=Math.floor(start[0]),sy=Math.floor(start[1]),tx=Math.floor(target[0]),ty=Math.floor(target[1]);
    const key=(x,y)=>`${x},${y}`, q=[[sx,sy]], prev=new Map(), seen=new Set([key(sx,sy)]);
    if(!qaCellInfo(levelId,sx,sy,allowUnlockable).passable || !qaCellInfo(levelId,tx,ty,allowUnlockable).passable) return null;
    for(let i=0;i<q.length;i++){
      const [x,y]=q[i]; if(x===tx&&y===ty){const path=[];let cur=[x,y];while(cur){path.push(cur);cur=prev.get(key(cur[0],cur[1]))||null;}return path.reverse();}
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,k=key(nx,ny); if(seen.has(k)||!qaCellInfo(levelId,nx,ny,allowUnlockable).passable) continue;
        seen.add(k);prev.set(k,[x,y]);q.push([nx,ny]);
      }
    }
    return null;
  }

  async function qaOpenDoorsAlongPath(path) {
    if(!Array.isArray(path)) return;
    for(let i=1;i<path.length;i++){
      const [x,y]=path[i], info=qaCellInfo(state.levelId,x,y,true), door=info.door;
      if(!door || door.open) continue;
      const [px,py]=path[i-1]; state.x=px+.5;state.y=py+.5;state.angle=Math.atan2((y+.5)-state.y,(x+.5)-state.x);updateHUD();renderScene();
      await qaSleep(280); performInteraction({kind:'door',door,dist:1}); await qaSleep(550);
      if(!door.open) throw new Error(`Door ${door.id||door.label} did not open on a QA-proven route`);
    }
  }

  function qaPlaceNearObject(obj) {
    const candidates=[];
    for(const r of [.45,.65,.85,1.05]) for(let i=0;i<8;i++){const a=i*Math.PI/4;candidates.push([obj.x-Math.cos(a)*r,obj.y-Math.sin(a)*r]);}
    const spot=candidates.find(([x,y])=>canOccupy(x,y)&&interactionLineOfSightClear(obj.x,obj.y,.08));
    if(spot){state.x=spot[0];state.y=spot[1];} else {state.x=Math.floor(obj.x)+.5;state.y=Math.floor(obj.y)+.5;}
    state.angle=Math.atan2(obj.y-state.y,obj.x-state.x);markCellExplored(Math.floor(state.x),Math.floor(state.y));updateHUD();renderScene();
  }

  function qaFindObjectByInteract(interact, levelId = null) {
    for(const [id,data] of Object.entries(levels)) {
      if(levelId && id!==levelId) continue;
      const obj=(data.objects||[]).find(o=>o.interact===interact && qaObjectVisible(o));
      if(obj) return {levelId:id,obj};
    }
    return null;
  }

  async function qaBridgeDisconnectedTarget(ref) {
    if(state.levelId!==ref.levelId) return false;
    const targetLevel=levels[ref.levelId];
    if(!targetLevel) return false;
    // Some authored floors intentionally contain disconnected regions reached by
    // different ladders/trapdoors (Level 9's Counterweight Chamber and Alignment
    // Vault are the canonical example). Find an exit in the target component,
    // then approach through its paired transition from the adjoining floor.
    for(const outObj of targetLevel.objects||[]) {
      const pairInteract=QA_TRANSITION_PAIRS[outObj.interact];
      if(!pairInteract || !qaObjectVisible(outObj) || !qaTransitionAllowed(outObj.interact)) continue;
      const targetComponentPath=qaGridPath(ref.levelId,[outObj.x,outObj.y],[ref.obj.x,ref.obj.y],true);
      if(!targetComponentPath) continue;
      const inverse=qaFindObjectByInteract(pairInteract);
      if(!inverse || !qaTransitionAllowed(inverse.obj.interact)) continue;
      await qaTravelToObjectRef(inverse);
      await qaBoundary();
      performInteraction({kind:'object',obj:inverse.obj,dist:1});
      await qaSleep(750);
      if(state.levelId!==ref.levelId) continue;
      if(qaGridPath(ref.levelId,[state.x,state.y],[ref.obj.x,ref.obj.y],true)) {
        qaLog(`entered disconnected ${ref.levelId} component via ${inverse.obj.id||inverse.obj.interact}`);
        return true;
      }
    }
    return false;
  }

  async function qaTravelToObjectRef(ref) {
    if(!ref?.obj) throw new Error('QA target object missing');
    if(state.levelId!==ref.levelId) await qaRouteToLevel(ref.levelId);
    let path=qaGridPath(state.levelId,[state.x,state.y],[ref.obj.x,ref.obj.y],true);
    if(!path && state.levelId===ref.levelId) {
      const bridged=await qaBridgeDisconnectedTarget(ref);
      if(bridged) path=qaGridPath(state.levelId,[state.x,state.y],[ref.obj.x,ref.obj.y],true);
    }
    if(!path) throw new Error(`No legal physical route to ${ref.obj.id||ref.obj.interact} on ${state.levelId}`);
    await qaOpenDoorsAlongPath(path);
    path=qaGridPath(state.levelId,[state.x,state.y],[ref.obj.x,ref.obj.y],false);
    if(!path) throw new Error(`Route to ${ref.obj.id||ref.obj.interact} remained blocked after opening eligible doors`);
    const last=path[Math.max(0,path.length-2)]||path[path.length-1];
    state.x=last[0]+.5;state.y=last[1]+.5;qaPlaceNearObject(ref.obj);saveState();
    qaLog(`arrived at ${ref.obj.id||ref.obj.interact}`); await qaSleep(650);
    return ref;
  }

  async function qaRouteToLevel(targetLevelId) {
    if(state.levelId===targetLevelId) return true;
    const visited=new Set();
    for(let guard=0;guard<24 && state.levelId!==targetLevelId;guard++){
      const current=state.levelId;
      const candidates=[];
      for(const edge of qaTransitionEdges(current)){
        const localPath=qaGridPath(current,[state.x,state.y],[edge.obj.x,edge.obj.y],true);
        if(!localPath) continue; // a transition in another disconnected room is not usable from here
        const tail=edge.to===targetLevelId?[]:qaLevelRoute(edge.to,targetLevelId);
        if(edge.to!==targetLevelId && !tail) continue;
        const score=(tail?.length||0)+1;
        candidates.push({edge,score,localPath});
      }
      candidates.sort((a,b)=>a.score-b.score || a.localPath.length-b.localPath.length);
      const choice=candidates.find(c=>!visited.has(`${current}:${c.edge.obj.id||c.edge.obj.interact}`)) || candidates[0];
      if(!choice) throw new Error(`No physically reachable floor transition from ${current} toward ${targetLevelId}`);
      visited.add(`${current}:${choice.edge.obj.id||choice.edge.obj.interact}`);
      await qaTravelToObjectRef({levelId:current,obj:choice.edge.obj});
      performInteraction({kind:'object',obj:choice.edge.obj,dist:1}); await qaSleep(750);
      if(state.levelId!==choice.edge.to) throw new Error(`Transition ${choice.edge.obj.interact} did not reach ${choice.edge.to}`);
    }
    if(state.levelId!==targetLevelId) throw new Error(`QA floor routing exceeded guard while travelling to ${targetLevelId}`);
    return true;
  }

  async function qaUseObject(ref, label='interaction') {
    await qaTravelToObjectRef(ref); await qaBoundary(); performInteraction({kind:'object',obj:ref.obj,dist:0}); qaLog(label); await qaSleep(700); return true;
  }

  function qaOwnedWordForLetter(letter) {
    const upper=String(letter||'').toUpperCase();
    return puzzleOwnedCandidates().find(word=>String(word)[0]?.toUpperCase()===upper) || null;
  }

  function qaCrosswordSlots(puzzle) {
    const model=countryCrosswordModel(puzzle), entries=model.entries;
    let chosen=null;
    const walk=(i,letters)=>{
      if(chosen) return;
      if(i>=entries.length){chosen=new Map(letters);return;}
      const entry=entries[i];
      for(const answer of entry.acceptedAnswers){
        let ok=true; const next=new Map(letters);
        for(let off=0;off<entry.length;off++){
          const y=entry.row+(entry.direction==='down'?off:0),x=entry.col+(entry.direction==='across'?off:0),k=`${y},${x}`,ch=answer[off];
          if(next.has(k)&&next.get(k)!==ch){ok=false;break;} next.set(k,ch);
        }
        if(ok) walk(i+1,next); if(chosen) return;
      }
    };
    walk(0,new Map()); if(!chosen) throw new Error(`No compatible crossword answer set for ${puzzle.id}`);
    return model.cells.map(cell=>{const letter=chosen.get(`${cell.row},${cell.col}`);const word=qaOwnedWordForLetter(letter);if(!word)throw new Error(`No owned glyph family ${letter} for ${puzzle.id}`);return word;});
  }

  function qaSlotSolution(puzzle) {
    const seq=puzzleSequence(puzzle); if(seq.length) return seq;
    if(puzzle.type==='country-cartouche'){
      const answer=String(puzzle.ui?.payload?.answer||'').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
      return [...answer].map(letter=>{const word=qaOwnedWordForLetter(letter);if(!word)throw new Error(`No owned glyph family ${letter} for ${puzzle.id}`);return word;});
    }
    if(puzzle.type==='country-crossword') return qaCrosswordSlots(puzzle);
    return [];
  }

  function qaFindSubset(values,target) {
    const n=values.length;
    for(let mask=0;mask<(1<<n);mask++){let sum=0;const selected=values.map((v,i)=>{const on=Boolean(mask&(1<<i));if(on)sum+=Number(v)||0;return on;});if(Math.abs(sum-Number(target))<1e-9)return selected;}
    return null;
  }

  function qaRouteRotations(puzzle,airflow=false) {
    const tiles=puzzle.ui?.payload?.tiles||[], limits=tiles.map(tile=>airflow?4:(tile.type==='straight'?2:4)), rot=Array(tiles.length).fill(0);
    let found=null;
    const test=()=>airflow?airflowConnectivity(puzzle,{rotations:rot}).solved:routeConnectivity(puzzle,rot).solved;
    const walk=i=>{if(found)return;if(i===rot.length){if(test())found=rot.slice();return;}for(let r=0;r<limits[i];r++){rot[i]=r;walk(i+1);if(found)return;}};
    walk(0); return found;
  }

  function qaPegSolution(initial) {
    const start=Array.from(initial||[]).map(v=>Number(v)?1:0), seen=new Set();
    const dfs=(pegs,moves)=>{const k=pegs.join('');if(seen.has(k))return null;seen.add(k);if(pegs.reduce((a,b)=>a+b,0)===1)return {pegs,moves};for(const move of pegMoves(pegs)){const n=pegs.slice();n[move.from]=0;n[move.mid]=0;n[move.to]=1;const r=dfs(n,moves.concat(move));if(r)return r;}return null;};
    return dfs(start,[]);
  }

  function qaSokobanSolution(puzzle) {
    const model=sokobanModel(puzzle), fresh=freshMechanismState(puzzle), key=(pl,cr)=>`${pl.join(',')}|${cr.map(p=>p.join(',')).sort().join(';')}`;
    const q=[{player:fresh.player,crates:fresh.crates,moves:[]}],seen=new Set([key(fresh.player,fresh.crates)]),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(let qi=0;qi<q.length&&qi<50000;qi++){
      const cur=q[qi],crset=new Set(cur.crates.map(p=>p.join(','))); if([...model.goals].every(g=>crset.has(g))) return cur;
      for(const [dx,dy] of dirs){const [px,py]=cur.player,nx=px+dx,ny=py+dy,nk=`${nx},${ny}`;if(model.walls.has(nk))continue;const ci=cur.crates.findIndex(([x,y])=>x===nx&&y===ny),cr=cur.crates.map(p=>p.slice());if(ci>=0){const bx=nx+dx,by=ny+dy,bk=`${bx},${by}`;if(model.walls.has(bk)||cr.some(([x,y])=>x===bx&&y===by))continue;cr[ci]=[bx,by];}const pl=[nx,ny],k=key(pl,cr);if(!seen.has(k)){seen.add(k);q.push({player:pl,crates:cr,moves:cur.moves.concat([[dx,dy]])});}}
    }
    return null;
  }

  function qaExactPath(puzzle) {
    const p=puzzle.ui?.payload||{},w=Number(p.width)||0,h=Number(p.height)||0,moves=Number(p.moves)||0,target=Number(p.targetSum)||0,end=p.end||[],values=p.values||[],start=p.start||[0,0];
    const path=[start.slice()]; let found=null;
    const dfs=(x,y,steps,sum)=>{if(found)return;if(steps===moves){if(x===Number(end[0])&&y===Number(end[1])&&sum===target)found=path.map(v=>v.slice());return;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;path.push([nx,ny]);dfs(nx,ny,steps+1,sum+(Number(values?.[ny]?.[nx])||0));path.pop();if(found)return;}};
    dfs(Number(start[0]),Number(start[1]),0,Number(values?.[start[1]]?.[start[0]])||0);return found;
  }

  function qaCoupledSwitchPresses(payload) {
    const start=Array.from(payload.start||[]).map(v=>Number(v)?1:0),target=Array.from(payload.target||[]).map(v=>Number(v)?1:0),masks=payload.masks||[];
    for(let bits=0;bits<(1<<masks.length);bits++){const lamps=start.slice();for(let i=0;i<masks.length;i++)if(bits&(1<<i))for(const lamp of masks[i])lamps[lamp]=lamps[lamp]?0:1;if(JSON.stringify(lamps)===JSON.stringify(target))return {lamps,presses:masks.map((_,i)=>Boolean(bits&(1<<i)))};}
    return null;
  }

  function qaSolvedMechanismState(puzzle) {
    const p=puzzle.ui?.payload||{}, fresh=freshMechanismState(puzzle);
    switch(puzzle.type){
      case 'dial-bank': return {...fresh,values:(p.targetValues||[]).map(Number)};
      case 'route-board': {const rotations=qaRouteRotations(puzzle,false);return {...fresh,rotations};}
      case 'path-grid': return {...fresh,x:Number(p.end?.[0]??fresh.x),y:Number(p.end?.[1]??fresh.y),nextCheckpoint:(p.checkpoints||[]).length,finished:true};
      case 'lights-out': return {...fresh,lights:Array.from(fresh.lights||[]).map(()=>Number(p.target??1))};
      case 'balance-scale': return {...fresh,selected:qaFindSubset(p.weights||[],p.target)};
      case 'context-match': return {...fresh,selectedIndex:Number(p.correctIndex)};
      case 'jug-transfer': {const a=Array.from(fresh.amounts||[]);if(a.length)a[a.length-1]=Number(p.target);return {...fresh,amounts:a};}
      case 'hanoi-stack': {const n=Math.max(1,Number(p.discCount)||3),target=Math.max(0,Number(p.targetRod)||2),rods=[[],[],[]];rods[target]=Array.from({length:n},(_,i)=>n-i);return {...fresh,rods,selectedRod:null,moves:Math.pow(2,n)-1};}
      case 'codebreaker': {const v=getCodebreakerVariant(puzzle);return {...fresh,guess:v.secret.slice(),solved:true,history:[{guess:v.secret.slice(),exact:v.secret.length,misplaced:0}]};}
      case 'equivalence-grid': {const fr=p.fractions||[],dec=p.decimals||[],pct=p.percents||[];const match=(arr,v)=>arr.findIndex(x=>Math.abs(Number(x.value)-Number(v))<1e-9);return {...fresh,decimalOrder:fr.map(x=>match(dec,x.value)),percentOrder:fr.map(x=>match(pct,x.value)),selected:null};}
      case 'schedule-order': return {...fresh,order:Array.from(p.targetOrder||[])};
      case 'river-crossing': return {...fresh,playerSide:Number(p.targetSide??1),itemSides:(p.travellers||[]).map(()=>Number(p.targetSide??1)),selectedItem:null,moves:7};
      case 'sokoban': {const s=qaSokobanSolution(puzzle);if(!s)throw new Error(`No Sokoban solution for ${puzzle.id}`);return {...fresh,player:s.player,crates:s.crates};}
      case 'sliding-grid': return {...fresh,tiles:Array.from(p.target||[])};
      case 'peg-solitaire': {const s=qaPegSolution(p.initial||[]);if(!s)throw new Error(`No peg solution for ${puzzle.id}`);return {...fresh,pegs:s.pegs,selected:null,moves:s.moves.length};}
      case 'pattern-sequence': return {...fresh,selectedIndex:Number(p.correctIndex)};
      case 'nonogram': {const rows=Array.from(p.target||[]),cells=[];for(const row of rows)for(const ch of String(row))cells.push(ch==='1'?1:0);return {...fresh,cells};}
      case 'card-sort': return {...fresh,order:Array.from(p.targetOrder||[]),selected:null};
      case 'calculator-sequence': return {...fresh,stage:Math.max(0,(p.problems||[]).length-1),input:'',solved:true,message:'QA solved'};
      case 'base-match': return {...fresh,stage:Math.max(0,(fresh.rounds||[]).length-1),selectedIndex:null,solved:true,message:'QA solved',answers:(fresh.rounds||[]).map(r=>r.correctIndex)};
      case 'ring-lock': return {...fresh,positions:Array.from(p.targetPositions||[]).map(Number)};
      case 'tone-sequence': return {...fresh,input:Array.from(p.sequence||[]),solved:true,playing:false,message:'QA solved'};
      case 'airflow-network': {const rotations=qaRouteRotations(puzzle,true);if(!rotations)throw new Error(`No airflow solution for ${puzzle.id}`);return {...fresh,rotations};}
      case 'pulse-sync': return {...fresh,phases:(p.periods||[]).map(period=>((Number(p.targetColumn)||0)%Number(period)+Number(period))%Number(period))};
      case 'spectrum-order': return {...fresh,order:Array.from(p.targetOrder||[]),selected:null};
      case 'power-balance': return {...fresh,selected:qaFindSubset(p.loads||[],p.target)};
      case 'deduction-order': return {...fresh,order:Array.from(p.targetOrder||[]),selected:null};
      case 'dual-mirror': return {...fresh,orientations:Array.from(p.targetOrientations||[]).map(Number)};
      case 'truth-gates': return {...fresh,gates:Array.from(p.targetGates||[])};
      case 'dependency-order': return {...fresh,order:Array.from(p.targetOrder||[]),selected:null};
      case 'exact-path': {const path=qaExactPath(puzzle);if(!path)throw new Error(`No exact path for ${puzzle.id}`);return {...fresh,path,message:'QA solved'};}
      case 'sphinx-riddles': {const v=getSphinxVariant(puzzle);return {...fresh,stage:v.riddleOrder.length,mistakes:0,solved:true,message:'QA solved',riddleOrder:v.riddleOrder,choiceOrders:v.choiceOrders};}
      case 'coupled-switches': {const s=qaCoupledSwitchPresses(p);if(!s)throw new Error(`No coupled-switch solution for ${puzzle.id}`);return {...fresh,lamps:s.lamps,moves:s.presses.filter(Boolean).length};}
      case 'layer-alignment': return {...fresh,rotations:(p.layers||[]).map(layer=>Number(layer.targetRotation)||0)};
      case 'market-till': return {...fresh,selected:qaFindSubset(p.tokens||[],p.targetCents)};
      case 'cold-chain': {for(let A=0;A<3;A++)for(let B=0;B<3;B++)for(let C=0;C<3;C++){const s={...fresh,controls:[A,B,C]};if(l10ColdSolved(puzzle,s))return s;}throw new Error(`No cold-chain solution for ${puzzle.id}`);}
      case 'textile-mixer': return {...fresh,selectedIndex:Number(p.correctIndex)};
      case 'record-classification': {const assignments={};for(const r of p.records||[])assignments[r.id]=r.destination;return {...fresh,assignments};}
      case 'call-triangulation': return {...fresh,selected:Array.from(p.target||[]).map(Number)};
      case 'lineage-match': return {...fresh,assignments:Array.from(p.targetAssignments||[])};
      case 'habitat-triage': return {...fresh,akesi:p.target?.akesi,moli:p.target?.moli};
      case 'sudoku': return {...fresh,cells:Array.from(p.solution||[]).map(Number),notes:Array.from({length:81},()=>[]),selected:null,noteMode:false};
      default: throw new Error(`TPQA has no mechanism solver for ${puzzle.type}`);
    }
  }

  function qaAnswerForPuzzle(puzzle) {
    if(!puzzle) return null; const p=puzzle.ui?.payload||{};
    if(puzzleSequence(puzzle).length) return {id:puzzle.id,type:puzzle.type,sequence:puzzleSequence(puzzle)};
    if(puzzle.type==='country-cartouche') return {id:puzzle.id,type:puzzle.type,answer:p.answer};
    if(puzzle.type==='country-crossword') return {id:puzzle.id,type:puzzle.type,entries:(p.entries||[]).map(e=>({number:e.number,answer:e.acceptedAnswers?.[0]}))};
    if(puzzle.type==='coordinate-map') return {id:puzzle.id,type:puzzle.type,target:[Number(p.targetX),Number(p.targetY)],source:p.source};
    if(puzzle.type==='codebreaker'){const v=getCodebreakerVariant(puzzle);return {id:puzzle.id,type:puzzle.type,words:v.words,secret:v.secret,answer:v.secret.map(i=>v.words[i])};}
    if(puzzle.type==='sphinx-riddles'){const v=getSphinxVariant(puzzle);return {id:puzzle.id,type:puzzle.type,answers:v.riddleOrder.map((ri,stage)=>{const r=p.riddles[ri];return {prompt:r.prompt||r.clue,answer:r.answer,choices:v.choiceOrders[stage]};})};}
    if(puzzle.type==='sudoku') return {id:puzzle.id,type:puzzle.type,solution:Array.from(p.solution||[])};
    const solved=isMechanismPuzzle(puzzle)?qaSolvedMechanismState(puzzle):null;
    return {id:puzzle.id,type:puzzle.type,solution:solved,payload:p};
  }

  async function qaSolveOpenPuzzle() {
    const puzzle=activeCampaignPuzzle; if(!puzzle) return false;
    qaLog(`solving ${puzzle.id}`); await qaBoundary();
    if(puzzle.type==='coordinate-map'){
      const payload=puzzle.ui?.payload||{};
      const cell=puzzleSlots.querySelector(`.coordinateMapCell[data-x="${Number(payload.targetX)}"][data-y="${Number(payload.targetY)}"]`);
      if(!cell) throw new Error(`QA could not find coordinate cell for ${puzzle.id}`);
      cell.click(); await qaSleep(800); qaState.focusPuzzleId=null; return campaignSolved(puzzle.id);
    }
    if(isMechanismPuzzle(puzzle)){
      puzzleMechanismState=qaSolvedMechanismState(puzzle);
      if(!mechanismSolved(puzzle)) throw new Error(`QA generated state does not solve ${puzzle.id}`);
      renderCampaignPuzzle(); await qaSleep(700);
    }else{
      const solution=qaSlotSolution(puzzle);
      if(solution.length){
        puzzleSlotValues=Array(puzzleSlotValues.length).fill(null);
        for(let i=0;i<solution.length;i++){puzzleSlotValues[i]=solution[i];if(i===solution.length-1||i%3===2){renderCampaignPuzzle();await qaSleep(150);}}
        if(!validateCampaignPuzzleSlots()) throw new Error(`QA generated slots do not solve ${puzzle.id}`);
      }
      renderCampaignPuzzle(); await qaSleep(500);
    }
    completeActiveCampaignPuzzle(); await qaSleep(800); qaState.focusPuzzleId=null; return true;
  }

  function qaPrimaryPhysicalObject(puzzle) {
    const refs=qaFindObjectsForPuzzle(puzzle.id).filter(ref=>qaObjectVisible(ref.obj));
    if(puzzle.id==='l1-ball-table') return qaFindObjectById('ball');
    if(puzzle.id==='l11-call-survey') return qaFindObjectById('l11CallA');
    if(puzzle.id==='l9-maze-survey') return qaFindObjectById('l9MarkerNorth');
    if(puzzle.id==='l9-counterweight') return qaFindObjectById('l9OrbRelic');
    if(puzzle.id==='l10-delivery-routing') return qaFindObjectById('l10BreadCrate');
    if(puzzle.id==='l10-textile-routing') return qaFindObjectById('l10BlueCloth');
    if(puzzle.id==='l11-parent-bands') return qaFindObjectById('l11RedBand');
    return refs[0]||null;
  }

  function qaNormalizeMutablePhysicalPuzzle(puzzle) {
    if(!puzzle || campaignSolved(puzzle.id)) return false;
    let changed=false;
    if(puzzle.id==='l9-counterweight'){
      if(String(state.carrying||'').startsWith('l9:')){state.carrying=null;changed=true;}
      if(Object.keys(state.l9Placements||{}).length){state.l9Placements={};changed=true;}
    }else if(puzzle.id==='l10-delivery-routing'){
      const baselineLocations={bread:'receiving',sweet:'receiving'};
      if(state.l10CartDock!=='receiving'){state.l10CartDock='receiving';changed=true;}
      if((state.l10CartCargo||[]).length){state.l10CartCargo=[];changed=true;}
      if(Object.keys(state.l10DeliveryPlacements||{}).length){state.l10DeliveryPlacements={};changed=true;}
      if(JSON.stringify(state.l10ParcelLocations||{})!==JSON.stringify(baselineLocations)){state.l10ParcelLocations=baselineLocations;changed=true;}
    }else if(puzzle.id==='l10-textile-routing'){
      if(String(state.carrying||'').startsWith('l10:textile:')){state.carrying=null;changed=true;}
      if(Object.keys(state.l10TextilePlacements||{}).length){state.l10TextilePlacements={};changed=true;}
      const baselineLocations={'blue-cloth':'upper-rack','white-cloth':'upper-rack'};
      if(JSON.stringify(state.l10TextileLocations||{})!==JSON.stringify(baselineLocations)){state.l10TextileLocations=baselineLocations;changed=true;}
    }else if(puzzle.id==='l11-parent-bands'){
      if(String(state.carrying||'').startsWith('l11:band:')){state.carrying=null;changed=true;}
      if(Object.keys(state.l11BandPlacements||{}).length){state.l11BandPlacements={};changed=true;}
      const baselineLocations={'red-band':'rack','blue-band':'rack'};
      if(JSON.stringify(state.l11BandLocations||{})!==JSON.stringify(baselineLocations)){state.l11BandLocations=baselineLocations;changed=true;}
    }
    if(changed){spriteCache.clear();qaLog(`normalized tester-modified state for ${puzzle.id}`);}
    return changed;
  }

  async function qaSolvePhysicalPuzzle(puzzle) {
    qaLog(`solving physical ${puzzle.id}`); await qaBoundary();
    qaNormalizeMutablePhysicalPuzzle(puzzle);
    if(puzzle.type==='pickup'){
      const ref=qaFindObjectsForPuzzle(puzzle.id).find(r=>qaObjectVisible(r.obj)); if(!ref)throw new Error(`Pickup object missing for ${puzzle.id}`); await qaUseObject(ref,`pickup ${puzzle.id}`); return true;
    }
    if(puzzle.id==='l1-ball-table'){
      if(!state.ballOnTable){if(state.carrying!=='ball')await qaUseObject(qaFindObjectById('ball'),'take sike');await qaUseObject(qaFindObjectById('table'),'place sike on supa');}
      if(state.ballOnTable&&!campaignSolved(puzzle.id)) await qaUseObject(qaFindObjectById('table'),'activate completed sike / supa puzzle');
      return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l9-maze-survey'){
      for(const id of ['l9MarkerNorth','l9MarkerWest','l9MarkerSouth']){const ref=qaFindObjectById(id);if(ref&&!state.l9Markers?.[ref.obj.markerId])await qaUseObject(ref,`survey ${ref.obj.markerId}`);}return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l11-call-survey'){
      for(const id of ['l11CallA','l11CallB','l11CallC']){const ref=qaFindObjectById(id);if(ref&&!state.l11CallMarkers?.[ref.obj.pylonId])await qaUseObject(ref,`record pylon ${ref.obj.pylonId}`);}return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l9-counterweight'){
      const p=puzzle.ui?.payload||{};
      for(const ped of p.pedestals||[]){if(state.l9Placements?.[ped.id]===ped.accept)continue;let ref=null;for(const [levelId,d] of Object.entries(levels)){const obj=(d.objects||[]).find(o=>o.interact==='l9CarryRelic'&&o.carryId===ped.accept);if(obj){ref={levelId,obj};break;}}if(!ref)throw new Error(`Relic ${ped.accept} missing`);if(state.carrying!==`l9:${ped.accept}`)await qaUseObject(ref,`take ${ped.accept} relic`);const pedestal=qaFindObjectById(`l9Pedestal${ped.id[0].toUpperCase()+ped.id.slice(1)}`);if(!pedestal)throw new Error(`Pedestal ${ped.id} missing`);await qaUseObject(pedestal,`place ${ped.accept} on ${ped.id}`);}return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l10-delivery-routing'){
      if(state.l10CartDock!=='receiving') await qaUseObject(qaFindObjectById('l10CartCtlReceiving'),'call cart to Receiving');
      for(const id of ['l10BreadCrate','l10SweetCrate']){const ref=qaFindObjectById(id);if(ref&&state.l10ParcelLocations?.[ref.obj.parcelId]==='receiving')await qaUseObject(ref,`load ${ref.obj.word}`);}
      if(state.l10CartDock!=='market') await qaUseObject(qaFindObjectById('l10CartCtlReceiving'),'send cart to Market Arcade');
      for(const id of ['l10BakeryStand','l10SweetStand']){const ref=qaFindObjectById(id);const expected=ref?.obj.expectedParcel;if(ref&&state.l10DeliveryPlacements?.[ref.obj.standId]!==expected)await qaUseObject(ref,`deliver ${expected}`);}
      return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l10-textile-routing'){
      const jobs=[['l10BlueCloth','l10DyeFrame','blue-cloth','dye-frame'],['l10WhiteCloth','l10FinishTable','white-cloth','finish-table']];
      for(const [parcelId,stationId,batch,dest] of jobs){if(state.l10TextilePlacements?.[dest]===batch)continue;if(state.carrying!==`l10:textile:${batch}`)await qaUseObject(qaFindObjectById(parcelId),`take ${batch}`);await qaUseObject(qaFindObjectById(stationId),`place ${batch}`);}return campaignSolved(puzzle.id);
    }
    if(puzzle.id==='l11-parent-bands'){
      const jobs=[['l11RedBand','l11WestPerch','red-band','west-perch'],['l11BlueBand','l11EastPerch','blue-band','east-perch']];
      for(const [bandObj,perchObj,band,dest] of jobs){if(state.l11BandPlacements?.[dest]===band)continue;if(state.carrying!==`l11:band:${band}`)await qaUseObject(qaFindObjectById(bandObj),`take ${band}`);await qaUseObject(qaFindObjectById(perchObj),`place ${band}`);}return campaignSolved(puzzle.id);
    }
    throw new Error(`TPQA has no physical solver for ${puzzle.id} (${puzzle.type})`);
  }

  function qaIsPhysicalPuzzle(puzzle) {
    return ['pickup','world-action','maze-survey','carry-placement','delivery-routing','textile-routing','band-placement'].includes(puzzle?.type);
  }

  function qaPuzzleInputUsable(puzzle) {
    if(puzzle?.type==='country-cartouche'){
      const answer=String(puzzle.ui?.payload?.answer||'').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
      return [...answer].every(letter=>Boolean(qaOwnedWordForLetter(letter)));
    }
    if(puzzle?.type==='country-crossword'){
      try { qaCrosswordSlots(puzzle); return true; } catch (_) { return false; }
    }
    return true;
  }

  function qaCurrentUnsolvedPuzzles() {
    const levelDef=campaignAdapter?.currentLevel?.(); if(!levelDef) return [];
    return (levelDef.puzzles||[]).filter(p=>!campaignSolved(p.id));
  }

  function qaPuzzleRequirementsMet(puzzle) {
    // The normal campaign availability API is intentionally area-local: it only
    // reports puzzles in runtime.currentArea. QA, however, must discover the next
    // objective anywhere the player can legally reach. Check the authored puzzle
    // prerequisites independently of currentArea, then let the physical route
    // proof below decide whether the player can actually get there.
    const req=puzzle?.requirements||{};
    for(const glyph of req.glyphs||[]) if(!collected(glyph)) return false;
    for(const solvedId of req.solvedPuzzles||[]) if(!campaignSolved(solvedId)) return false;
    const world=campaignWorld();
    for(const [key,value] of Object.entries(req.states||{})) if(world[key]!==value) return false;
    return true;
  }

  function qaPuzzleReachable(puzzle) {
    if(!qaPuzzleRequirementsMet(puzzle) || !qaPuzzleInputUsable(puzzle)) return false;
    const ref=qaIsPhysicalPuzzle(puzzle)?qaPrimaryPhysicalObject(puzzle):(qaFindObjectsForPuzzle(puzzle.id).find(r=>qaObjectVisible(r.obj))||null);
    if(!ref) return false;
    const route=qaLevelRoute(state.levelId,ref.levelId); if(route===null)return false;
    if(state.levelId===ref.levelId) return Boolean(qaGridPath(state.levelId,[state.x,state.y],[ref.obj.x,ref.obj.y],true));
    return true;
  }

  function qaNextPuzzle() {
    const unsolved=qaCurrentUnsolvedPuzzles();
    for(const puzzle of unsolved){
      if(!qaState.includeOptional && ['bonus','story'].includes(String(puzzle.sourceClass||''))) continue;
      if(qaPuzzleReachable(puzzle)) return puzzle;
    }
    return null;
  }

  async function qaMoveToPuzzle(puzzle) {
    const ref=qaIsPhysicalPuzzle(puzzle)?qaPrimaryPhysicalObject(puzzle):(qaFindObjectsForPuzzle(puzzle.id).find(r=>qaObjectVisible(r.obj))||null);
    if(!ref) throw new Error(`No world object for ${puzzle.id}`);
    await qaTravelToObjectRef(ref); qaState.focusPuzzleId=puzzle.id; qaLog(`next: ${puzzle.id}`); await qaSleep(700);
    if(!qaIsPhysicalPuzzle(puzzle)){
      performInteraction({kind:'object',obj:ref.obj,dist:0}); await qaSleep(650);
      if(activeCampaignPuzzle?.id!==puzzle.id && !campaignSolved(puzzle.id)) throw new Error(`Could not open ${puzzle.id}`);
    }
    qaRecordPuzzleCheckpoint(puzzle);
    qaUpdateBadge(); return puzzle;
  }

  async function qaDismissGlyphRewards() {
    while(glyphPopup&&!glyphPopup.hidden){await qaSleep(950);glyphPopupClose.click();await qaSleep(300);}
  }

  async function qaEnsureIntroDismissed() {
    if(levelIntroOverlay&&!levelIntroOverlay.hidden){await qaSleep(300);levelIntroShownAt=0;startLevelFromIntro();await qaSleep(550);}
  }

  async function qaSolveFocusedPuzzle(puzzle) {
    if(!puzzle || campaignSolved(puzzle.id)){qaState.focusPuzzleId=null;return false;}
    qaRecordPuzzleCheckpoint(puzzle);
    if(qaIsPhysicalPuzzle(puzzle)){
      const ok=await qaSolvePhysicalPuzzle(puzzle);
      if(!ok) throw new Error(`Physical QA solver did not complete ${puzzle.id}`);
      qaState.focusPuzzleId=null;
      return true;
    }
    // A tester can pause QA, Leave a normal popup puzzle, then press R. In that
    // state activeCampaignPuzzle is null but focusPuzzleId still names the popup.
    // Reacquire/reopen it through its real world object before using the normal
    // popup solver; never send a non-physical puzzle to qaSolvePhysicalPuzzle().
    await qaMoveToPuzzle(puzzle);
    if(activeCampaignPuzzle?.id!==puzzle.id) throw new Error(`Could not reopen focused puzzle ${puzzle.id}`);
    return qaSolveOpenPuzzle();
  }

  async function qaSolveCurrent() {
    await qaEnsureIntroDismissed();
    if(activeCampaignPuzzle){qaRecordPuzzleCheckpoint(activeCampaignPuzzle);return qaSolveOpenPuzzle();}
    if(qaState.focusPuzzleId){
      const p=campaignPuzzle(qaState.focusPuzzleId);
      return qaSolveFocusedPuzzle(p);
    }
    return false;
  }

  async function qaAdvanceLevelIfReady() {
    if(!campaignAdapter?.isLevelComplete?.()) return false;
    const remaining=qaNextPuzzle();
    if(remaining){if(levelCompleteOverlay&&!levelCompleteOverlay.hidden)closeModal(levelCompleteOverlay);return false;}
    const next=campaignAdapter?.nextLevel?.();
    if(!next){if(levelCompleteOverlay?.hidden)openLevelComplete();qaLog('campaign complete — final celebration left on screen');return 'complete';}
    await qaDismissGlyphRewards();
    if(levelCompleteOverlay?.hidden)openLevelComplete(); await qaSleep(1200);
    goToNextCampaignLevel(); qaState.focusPuzzleId=null; await qaSleep(900); await qaEnsureIntroDismissed(); qaLog(`entered Level ${next.ordinal}`); return true;
  }

  async function qaSolveAndNext(options={}) {
    if(!QA_MODE) throw new Error('TPQA is available only with ?qa=1');
    await qaBoundary();
    if(resetConfirmOverlay&&!resetConfirmOverlay.hidden) closeModal(resetConfirmOverlay);
    await qaEnsureIntroDismissed();
    const solved=await qaSolveCurrent(); if(solved){qaState.actionNo+=1;await qaDismissGlyphRewards();await qaSleep(550);}
    const advanced=await qaAdvanceLevelIfReady(); if(advanced==='complete')return {complete:true}; if(advanced) return {advanced:true};
    if(activeCampaignPuzzle) return {current:activeCampaignPuzzle.id};
    const puzzle=qaNextPuzzle();
    if(!puzzle){
      const unsolved=qaCurrentUnsolvedPuzzles();
      const details=unsolved.map(p=>({
        id:p.id,
        requirementsMet:qaPuzzleRequirementsMet(p),
        currentAreaAvailable:campaignPuzzleAvailable(p.id),
        area:p.area,
        requirements:p.requirements||{}
      }));
      throw new Error(`No physically reachable unsolved QA puzzle remains in Level ${campaignAdapter?.currentLevel?.()?.ordinal}. ${JSON.stringify(details)}`);
    }
    await qaMoveToPuzzle(puzzle); qaState.actionNo+=1; return {next:puzzle.id};
  }

  function qaStatus() {
    const levelDef=campaignAdapter?.currentLevel?.();
    const status={enabled:QA_MODE,running:qaState.running,paused:qaState.paused,speed:qaState.speed,level:levelDef?.ordinal||state.chapter,levelId:state.levelId,activePuzzle:activeCampaignPuzzle?.id||null,focusPuzzle:qaState.focusPuzzleId,nextPuzzle:qaNextPuzzle()?.id||null,checkpoint:qaState.puzzleHistory[qaState.historyCursor]?.puzzleId||null,checkpointIndex:qaState.historyCursor,checkpointCount:qaState.puzzleHistory.length,collection:`${collectionCount()}/120`,levelComplete:Boolean(campaignAdapter?.isLevelComplete?.()),lastAction:qaState.lastAction};
    console.table?.([status]); return status;
  }

  function qaAnswer() {
    const puzzle=activeCampaignPuzzle || (qaState.focusPuzzleId?campaignPuzzle(qaState.focusPuzzleId):qaNextPuzzle());
    if(!puzzle){console.info('[TPQA] no current/next puzzle');return null;} const answer=qaAnswerForPuzzle(puzzle);console.info('[TPQA answer]',answer);return answer;
  }

  function qaVariant() {
    const puzzle=activeCampaignPuzzle || (qaState.focusPuzzleId?campaignPuzzle(qaState.focusPuzzleId):qaNextPuzzle());
    if(!puzzle)return null; const variant=state.puzzleVariants?.[puzzle.id]||null;console.info('[TPQA variant]',puzzle.id,variant);return variant;
  }

  function qaSeed() {
    const value=state.saveEpoch; console.info('[TPQA save/campaign identity]',value); return value;
  }

  async function qaRunCampaign(options={}) {
    if(!QA_MODE) throw new Error('TPQA is available only with ?qa=1');
    for(let i=0;!campaignAdapter&&i<100;i++) await new Promise(r=>window.setTimeout(r,50));
    if(!campaignAdapter) throw new Error('Campaign engine is not ready yet');
    if(qaState.running){if(qaState.paused)qaResume();return qaState.runPromise;}
    if(options.reset){qaState.puzzleHistory=[];qaState.historyCursor=-1;await resetGame();await qaSleep(400);}
    if(options.speed!=null)qaSetSpeed(options.speed);
    const startPaused=Boolean(options.startPaused);
    qaState.includeOptional=options.includeOptional!==false;qaState.stopped=false;qaState.paused=startPaused;qaState.stepBudget=0;qaState.running=true;qaUpdateBadge();qaLog(startPaused?'campaign playback armed and paused':'campaign playback started');
    qaState.runPromise=(async()=>{
      try{
        let guard=0;
        while(!qaState.stopped&&guard++<300){
          await qaBoundary();
          qaState.inPlaybackAction=true;
          let result;
          try { result=await qaSolveAndNext(); }
          finally { qaState.inPlaybackAction=false; }
          if(result?.complete)break;
          await qaSleep(650);
        }
        if(guard>=300)throw new Error('QA campaign guard exceeded 300 progression actions');
        return qaStatus();
      }finally{qaState.inPlaybackAction=false;qaState.running=false;qaState.paused=false;qaState.stepBudget=0;qaUpdateBadge();}
    })();
    return qaState.runPromise;
  }

  async function qaRestartCampaign() {
    if(!QA_MODE) throw new Error('TPQA is available only with ?qa=1');
    const speed=qaState.speed, includeOptional=qaState.includeOptional;
    if(qaState.running){
      qaState.stopped=true; qaState.paused=false; qaState.stepBudget=0; qaUpdateBadge();
      try { await qaState.runPromise; } catch (_) {}
    }
    qaState.running=false; qaState.stopped=false; qaState.paused=false; qaState.stepBudget=0; qaState.inPlaybackAction=false;
    qaState.puzzleHistory=[]; qaState.historyCursor=-1;
    qaLog('restarting campaign from Level 1');
    await resetGame();
    await qaSleep(450);
    return qaRunCampaign({speed,includeOptional});
  }

  function qaEditableTarget(target) {
    if(!target || !(target instanceof Element)) return false;
    return Boolean(target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]'));
  }

  function qaHandleShortcut(e) {
    if(!QA_MODE || e.repeat || qaEditableTarget(e.target)) return false;
    const action=({KeyP:'pause',KeyN:'step',KeyB:'back',KeyR:'run',KeyX:'restart',KeyS:'stop',BracketLeft:'slower',BracketRight:'faster'})[e.code];
    if(!action) return false;
    e.preventDefault();
    qaDispatchControlAction(action).catch(err=>qaFail(err));
    return true;
  }

  function qaFail(error) {
    const err=error instanceof Error?error:new Error(String(error));qaState.running=false;qaState.paused=true;qaState.lastAction=`FAILED: ${err.message}`;qaUpdateBadge();console.error('[TPQA]',err);showMessage(`QA stopped: ${err.message}`);return err;
  }

  function installTPQA() {
    if(!QA_MODE || qaState.installed) return;
    qaState.installed=true;qaInstallBadge();
    const api={
      get enabled(){return true;}, answer:qaAnswer, solve:qaSolveCurrent, next:async()=>{const p=qaNextPuzzle();if(!p)throw new Error('No reachable next puzzle');return qaMoveToPuzzle(p);},
      solveAndNext:qaSolveAndNext, runCampaign:qaRunCampaign, restartCampaign:qaRestartCampaign, back:qaBackToPreviousPuzzleStart,
      pause:qaPause, resume:qaResume, stop:qaStop, step:qaStep, status:qaStatus,
      setSpeed:qaSetSpeed, seed:qaSeed, variant:qaVariant
    };
    window.TPQA=api;
    // Forgiving aliases for the two shorthand spellings used during design discussion.
    window.TPQR=api; window.TRQA=api;
    qaLog('test mode ready · R run · P pause/resume · N step · B previous puzzle · X restart · S stop · [ ] speed');
  }

  function viewportGestureIntent(clientY, rectTop, rectHeight) {
    const height = Math.max(1, Number(rectHeight) || 1);
    const centerY = (Number(rectTop) || 0) + height / 2;
    const normalized = Math.max(-1, Math.min(1, (clientY - centerY) / (height / 2)));
    const distance = Math.abs(normalized);
    if (distance <= VIEWPORT_MOVE_THRESHOLD) return { mode:'rotate', strength:0 };
    const t = Math.max(0, Math.min(1, (distance - VIEWPORT_MOVE_THRESHOLD) / (1 - VIEWPORT_MOVE_THRESHOLD)));
    return {
      mode: normalized < 0 ? 'forward' : 'back',
      strength: Math.pow(t, VIEWPORT_MOVE_EXPONENT)
    };
  }

  function resetViewportGesture(releaseCapture = true) {
    viewportMove.mode = 'idle';
    viewportMove.strength = 0;
    if (releaseCapture && dragPointerId !== null) {
      try { viewportWrap.releasePointerCapture?.(dragPointerId); } catch (_) {}
    }
    dragging = false;
    dragPointerId = null;
  }

  function updateViewportGestureFromPointer(e, isInitial = false) {
    const rect = viewportWrap.getBoundingClientRect();
    const next = viewportGestureIntent(e.clientY, rect.top, rect.height);
    const previousMode = viewportMove.mode;
    if (next.mode === 'rotate') {
      viewportMove.mode = 'rotate';
      viewportMove.strength = 0;
      if (!isInitial && previousMode === 'rotate') {
        const dx = e.clientX - lastPointerX;
        state.angle = normalizeAngle(state.angle + dx * (isCoarsePointer() ? 0.0052 : 0.008));
      }
      // Reset the horizontal reference whenever rotation resumes so crossing
      // back from a movement zone cannot produce a sudden turn jump.
      lastPointerX = e.clientX;
      return;
    }
    viewportMove.mode = next.mode;
    viewportMove.strength = next.strength;
    lastPointerX = e.clientX;
  }

  function setMobileJoystickIntent(intent, moveStrength = 0, turnStrength = 0) {
    mobileMove.forward = false;
    mobileMove.back = false;
    mobileMove.turnLeft = false;
    mobileMove.turnRight = false;
    mobileMove.moveStrength = 0;
    mobileMove.turnStrength = 0;
    if (!intent || intent === 'idle') return;
    if (intent.includes('N')) mobileMove.forward = true;
    if (intent.includes('S')) mobileMove.back = true;
    if (intent.includes('W')) mobileMove.turnLeft = true;
    if (intent.includes('E')) mobileMove.turnRight = true;
    mobileMove.moveStrength = Math.max(0, Math.min(MOBILE_JOYSTICK_MOVE_MAX, Number(moveStrength) || 0));
    mobileMove.turnStrength = Math.max(0, Math.min(MOBILE_JOYSTICK_TURN_MAX, Number(turnStrength) || 0));
  }

  function mobileJoystickIntent(dx, dy, deadRadius) {
    const radius = Math.hypot(dx, dy);
    if (!Number.isFinite(radius) || radius <= deadRadius) return 'idle';
    // Four absolute quadrants with 45-degree boundaries. Vertical quadrants
    // translate; side quadrants rotate in place.
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'N' : 'S';
    return dx < 0 ? 'W' : 'E';
  }

  function mobileJoystickStrength(radius, deadRadius, outerRadius) {
    const usable = Math.max(1, outerRadius - deadRadius);
    const t = Math.max(0, Math.min(1, (radius - deadRadius) / usable));
    const boostT = Math.max(0, Math.min(1, (t - MOBILE_JOYSTICK_BOOST_START) / Math.max(0.001, 1 - MOBILE_JOYSTICK_BOOST_START)));
    const boostCurve = boostT * boostT;
    const moveBoost = 1 + (MOBILE_JOYSTICK_MOVE_MAX - 1) * boostCurve;
    const turnBoost = 1 + (MOBILE_JOYSTICK_TURN_MAX - 1) * boostCurve;
    return {
      move: Math.pow(t, MOBILE_JOYSTICK_MOVE_EXPONENT) * moveBoost,
      turn: Math.pow(t, MOBILE_JOYSTICK_TURN_EXPONENT) * turnBoost
    };
  }

  function resetMobileJoystickGesture(gesture = mobileJoystickGesture) {
    gesture.drive = 'idle';
    gesture.steeringAngle = 0;
    gesture.lastPointerAngle = null;
  }

  function mobileJoystickSignedAngle(angle) {
    let a = Number(angle) || 0;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function mobileJoystickGestureCommand(dx, dy, deadRadius, outerRadius, gesture = mobileJoystickGesture) {
    const radius = Math.hypot(dx, dy);
    const absoluteIntent = mobileJoystickIntent(dx, dy, deadRadius);
    const strength = mobileJoystickStrength(radius, deadRadius, outerRadius);
    if (!Number.isFinite(radius) || radius <= deadRadius) {
      resetMobileJoystickGesture(gesture);
      return { intent:'idle', moveStrength:0, turnStrength:0, drive:'idle', steering:0, strength };
    }

    const pointerAngle = Math.atan2(dx, -dy); // clockwise from north

    // Left/right are always rotate-only. Crossing into either side quadrant
    // immediately cancels forward/backward translation and any accumulated
    // steering from the vertical quadrant.
    if (absoluteIntent === 'W' || absoluteIntent === 'E') {
      gesture.drive = 'idle';
      gesture.steeringAngle = 0;
      gesture.lastPointerAngle = pointerAngle;
      return {
        intent:absoluteIntent,
        moveStrength:0,
        turnStrength:strength.turn,
        drive:'idle',
        steering:absoluteIntent === 'W' ? -1 : 1,
        strength
      };
    }

    const nextDrive = absoluteIntent === 'N' ? 'forward' : 'back';
    if (gesture.drive !== nextDrive) {
      // Entering/re-entering a vertical quadrant starts straight. The initial
      // touch position inside that quadrant must never imply rotation.
      gesture.drive = nextDrive;
      gesture.steeringAngle = 0;
      gesture.lastPointerAngle = pointerAngle;
    } else if (gesture.lastPointerAngle == null) {
      gesture.lastPointerAngle = pointerAngle;
    } else {
      const angularDrag = mobileJoystickSignedAngle(pointerAngle - gesture.lastPointerAngle);
      // Sideways drag while remaining in the same vertical quadrant adds
      // steering. Reverse the angular sign while backing so dragging toward
      // screen-right still rotates right, and screen-left still rotates left.
      gesture.steeringAngle += gesture.drive === 'back' ? -angularDrag : angularDrag;
      gesture.steeringAngle = Math.max(-MOBILE_JOYSTICK_STEER_FULL_ANGLE, Math.min(MOBILE_JOYSTICK_STEER_FULL_ANGLE, gesture.steeringAngle));
      gesture.lastPointerAngle = pointerAngle;
    }

    const steerAbs = Math.abs(gesture.steeringAngle);
    const steerRatio = Math.max(0, Math.min(1,
      (steerAbs - MOBILE_JOYSTICK_STEER_DEADBAND) /
      Math.max(0.001, MOBILE_JOYSTICK_STEER_FULL_ANGLE - MOBILE_JOYSTICK_STEER_DEADBAND)
    ));
    const steering = steerRatio <= 0 ? 0 : (gesture.steeringAngle < 0 ? -steerRatio : steerRatio);
    const driveNorth = gesture.drive === 'forward';
    const intent = steering < 0 ? (driveNorth ? 'NW' : 'SW') : steering > 0 ? (driveNorth ? 'NE' : 'SE') : (driveNorth ? 'N' : 'S');
    return {
      intent,
      moveStrength:strength.move,
      turnStrength:strength.turn * Math.abs(steering),
      drive:gesture.drive,
      steering,
      strength
    };
  }

  function resetMobileJoystickVisual() {
    setMobileJoystickIntent('idle');
    resetMobileJoystickGesture();
    if (mobileMovePad) { mobileMovePad.dataset.sector = 'idle'; mobileMovePad.style.setProperty('--joystick-strength', '0'); }
    if (mobileJoystickThumb) {
      mobileJoystickThumb.style.left = '50%';
      mobileJoystickThumb.style.top = '50%';
    }
  }

  function mobileJoystickTuning() {
    const landscape = shortMobileLandscapePuzzleMode();
    return {
      deadRatio: landscape ? MOBILE_LANDSCAPE_JOYSTICK_DEAD_RATIO : MOBILE_JOYSTICK_DEAD_RATIO,
      moveScale: landscape ? MOBILE_LANDSCAPE_JOYSTICK_MOVE_SCALE : 1,
      turnScale: landscape ? MOBILE_LANDSCAPE_JOYSTICK_TURN_SCALE : 1,
      turnMax: landscape ? MOBILE_LANDSCAPE_JOYSTICK_TURN_MAX : MOBILE_JOYSTICK_TURN_MAX
    };
  }

  function updateMobileJoystickFromPointer(e) {
    if (!mobileMovePad) return;
    const rect = mobileMovePad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const outerRadius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const tuning = mobileJoystickTuning();
    const deadRadius = outerRadius * tuning.deadRatio;
    const command = mobileJoystickGestureCommand(dx, dy, deadRadius, outerRadius);
    const tunedTurnStrength = Math.min(tuning.turnMax, command.turnStrength * tuning.turnScale);
    setMobileJoystickIntent(command.intent, command.moveStrength * tuning.moveScale, tunedTurnStrength);
    mobileMovePad.dataset.sector = command.intent;
    mobileMovePad.style.setProperty('--joystick-strength', Math.min(1, command.strength.move).toFixed(3));
    if (mobileJoystickThumb) {
      const radius = Math.hypot(dx, dy) || 1;
      const maxThumbRadius = outerRadius * 0.68;
      const scale = Math.min(1, maxThumbRadius / radius);
      const tx = dx * scale;
      const ty = dy * scale;
      mobileJoystickThumb.style.left = `calc(50% + ${tx.toFixed(1)}px)`;
      mobileJoystickThumb.style.top = `calc(50% + ${ty.toFixed(1)}px)`;
    }
  }

  function miniMapGeometry() {
    const map = level().map;
    const w = miniMap.width, h = miniMap.height;
    const cell = Math.min(w / map[0].length, h / map.length);
    return { map, cell, ox:(w - map[0].length * cell) / 2, oy:(h - map.length * cell) / 2 };
  }

  function mapSteerCellRevealed(x, y) {
    const map = level().map;
    if (y < 0 || y >= map.length || x < 0 || x >= map[y].length) return false;
    const explored = state.explored[state.levelId] || {};
    const isCurrent = x === Math.floor(state.x) && y === Math.floor(state.y);
    return isCurrent || Boolean(explored[`${x},${y}`]);
  }

  function mapSteerRevealedWalkable(x, y) {
    if (!mapSteerCellRevealed(x, y)) return false;
    const c = level().map[y][x];
    if (c === '#') return false;
    if (c === 'D' || c === 'P') {
      const door = doorAtCell(x, y);
      if (!door?.open) return false;
    }
    return true;
  }

  function mapSteerPreviewDirection(dirX, dirY) {
    const mag = Math.hypot(dirX, dirY);
    if (!Number.isFinite(mag) || mag < 0.001) return [];
    const ux = dirX / mag, uy = dirY / mag;
    const map = level().map;
    const maxDist = Math.hypot(map[0]?.length || 0, map.length) + 2;
    const step = 0.20;
    const points = [];
    for (let d = step; d <= maxDist; d += step) {
      const x = state.x + ux * d, y = state.y + uy * d;
      const cx = Math.floor(x), cy = Math.floor(y);
      // Stop the visible dotted guide at the first fogged or blocked cell.
      // Do not inspect hidden-cell geometry before the fog check.
      if (!mapSteerCellRevealed(cx, cy)) break;
      if (!mapSteerRevealedWalkable(cx, cy)) break;
      points.push({x,y});
    }
    return points;
  }

  function mapSteerPointFromPointer(e) {
    if (!miniMap || !state.mapVisible) return null;
    const rect = miniMap.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (e.clientX - rect.left) * (miniMap.width / rect.width);
    const py = (e.clientY - rect.top) * (miniMap.height / rect.height);
    const {cell,ox,oy} = miniMapGeometry();
    // Deliberately do not clamp this point to the actual maze/floor-plan grid.
    // pointerdown begins on the minimap canvas, and pointer capture keeps later
    // drag events coming even when the finger moves beyond the canvas. In both
    // cases the pointer expresses a direction, not a destination that must be
    // inside known floor geometry.
    return {x:(px - ox) / cell, y:(py - oy) / cell};
  }

  function retargetMapSteering(e) {
    const targetPoint = mapSteerPointFromPointer(e);
    if (!targetPoint) {
      mobileMapSteer.targetCell = null;
      mobileMapSteer.targetPoint = null;
      mobileMapSteer.direction = null;
      mobileMapSteer.path = [];
      mobileMapSteer.pathIndex = 0;
      miniMap.classList.remove('isSteering');
      return false;
    }
    // A minimap touch is a direction command, not a request to pathfind to a
    // known cell. It remains valid in fog, over wall/background areas, and—
    // after a drag begins on the map—even beyond the map/canvas bounds.
    // Normal world collision remains the authority on how far movement goes.
    const dx = targetPoint.x - state.x, dy = targetPoint.y - state.y;
    const dist = Math.hypot(dx,dy);
    if (dist < 0.05) return false;
    const direction = {x:dx/dist, y:dy/dist};
    mobileMapSteer.levelId = state.levelId;
    mobileMapSteer.targetCell = {x:Math.floor(targetPoint.x), y:Math.floor(targetPoint.y)};
    mobileMapSteer.targetPoint = targetPoint;
    mobileMapSteer.direction = direction;
    mobileMapSteer.path = mapSteerPreviewDirection(direction.x, direction.y);
    mobileMapSteer.pathIndex = 0;
    // Point at the requested direction immediately. This makes a map touch a
    // direct steering gesture rather than a slow-turn command.
    state.angle = Math.atan2(direction.y, direction.x);
    miniMap.classList.add('isSteering');
    return true;
  }

  function cancelMapSteering(releaseCapture = true) {
    if (releaseCapture && mobileMapSteer.pointerId !== null) {
      try { miniMap.releasePointerCapture?.(mobileMapSteer.pointerId); } catch (_) {}
    }
    mobileMapSteer.active = false;
    mobileMapSteer.pointerId = null;
    mobileMapSteer.levelId = null;
    mobileMapSteer.targetCell = null;
    mobileMapSteer.targetPoint = null;
    mobileMapSteer.direction = null;
    mobileMapSteer.path = [];
    mobileMapSteer.pathIndex = 0;
    miniMap?.classList.remove('isSteering');
  }

  function updateMapSteering(dt) {
    if (!mobileMapSteer.active || mobileMapSteer.levelId !== state.levelId || !mobileMapSteer.direction) return false;
    const dir = mobileMapSteer.direction;
    // Keep the player facing the active touch direction exactly while held.
    // Collision still decides how much of that requested movement is possible.
    state.angle = Math.atan2(dir.y,dir.x);
    const step = MOBILE_MOVE_SPEED * dt;
    movePlayer(dir.x*step,dir.y*step,true);
    return true;
  }

  function bindMiniMapSteering() {
    if (!miniMap) return;
    const end = (e) => {
      if (mobileMapSteer.pointerId !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      cancelMapSteering(true);
    };
    miniMap.addEventListener('pointerdown', e => {
      if (modalOpen || !state.mapVisible || mobileMapSteer.pointerId !== null) return;
      e.preventDefault(); e.stopPropagation();
      resetMobileJoystickVisual();
      resetViewportGesture(true);
      mobileMapSteer.active = true;
      mobileMapSteer.pointerId = e.pointerId;
      mobileMapSteer.levelId = state.levelId;
      miniMap.setPointerCapture?.(e.pointerId);
      retargetMapSteering(e);
    }, {passive:false});
    miniMap.addEventListener('pointermove', e => {
      if (mobileMapSteer.pointerId !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      retargetMapSteering(e);
    }, {passive:false});
    miniMap.addEventListener('pointerup', end, {passive:false});
    miniMap.addEventListener('pointercancel', end, {passive:false});
  }

  function clearMovement() {
    keys = Object.create(null);
    resetMobileJoystickVisual();
    cancelMapSteering(true);
    resetViewportGesture(true);
  }

  function bindMobileControls() {
    if (!mobileMovePad) return;
    let joystickPointerId = null;
    const endJoystick = (e) => {
      if (joystickPointerId !== null && e.pointerId !== joystickPointerId) return;
      e.preventDefault(); e.stopPropagation();
      try { mobileMovePad.releasePointerCapture?.(e.pointerId); } catch (_) {}
      joystickPointerId = null;
      resetMobileJoystickVisual();
    };
    mobileMovePad.addEventListener('pointerdown', e => {
      const rect = mobileMovePad.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) > Math.min(rect.width, rect.height) / 2) return;
      e.preventDefault(); e.stopPropagation();
      cancelMapSteering(true);
      resetViewportGesture(true);
      joystickPointerId = e.pointerId;
      resetMobileJoystickGesture();
      mobileMovePad.setPointerCapture?.(e.pointerId);
      updateMobileJoystickFromPointer(e);
    }, { passive: false });
    mobileMovePad.addEventListener('pointermove', e => {
      if (joystickPointerId !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      updateMobileJoystickFromPointer(e);
    }, { passive: false });
    mobileMovePad.addEventListener('pointerup', endJoystick, { passive: false });
    mobileMovePad.addEventListener('pointercancel', endJoystick, { passive: false });
    mobileUseBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    mobileUseBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); performInteraction(); });
  }

  document.addEventListener('keydown', (e) => {
    if (qaHandleShortcut(e)) return;
    if (levelIntroOverlay && !levelIntroOverlay.hidden && (e.code === 'Enter' || e.code === 'Space')) { startLevelFromIntro(); e.preventDefault(); return; }
    if (!glyphPopup.hidden && (e.code === 'Enter' || e.code === 'Space')) { glyphPopupClose.click(); e.preventDefault(); return; }
    if (e.code === 'Escape' && modalOpen) {
      if (!glyphPopup.hidden) closeModal(glyphPopup);
      else if (!collectionOverlay.hidden) closeModal(collectionOverlay);
      else if (!sentenceOverlay.hidden) closeModal(sentenceOverlay);
      else if (!puzzleOverlay.hidden) closeCampaignPuzzleHost();
      else if (!levelCompleteOverlay.hidden) closeModal(levelCompleteOverlay);
      else if (resetConfirmOverlay && !resetConfirmOverlay.hidden) closeModal(resetConfirmOverlay);
      e.preventDefault(); return;
    }
    if (modalOpen) return;
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) { keys[e.code] = true; e.preventDefault(); }
    if (e.code === 'KeyE' && !e.repeat) { performInteraction(); e.preventDefault(); }
    if (e.code === 'KeyG' && !e.repeat) { openCollection(); e.preventDefault(); }
    if (e.code === 'KeyM' && !e.repeat) { cancelMapSteering(true); state.mapVisible = !state.mapVisible; saveState(); updateHUD(); e.preventDefault(); }
    if (e.code === 'KeyX' && !e.repeat && leaveSolvedMazeQuickly()) { e.preventDefault(); }
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', clearMovement);

  canvas.addEventListener('click', () => {
    canvas.focus();
    if (!isCoarsePointer() && document.pointerLockElement !== canvas && canvas.requestPointerLock && !modalOpen) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', e => { if (pointerLocked && !modalOpen) state.angle = normalizeAngle(state.angle + e.movementX * 0.0027); });

  viewportWrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.mobileMovePad, .mobileUseBtn, .mazeQuickExitBtn, .campaignContinueBtn, #miniMap, .qaPanel')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (modalOpen) return;
    cancelMapSteering(true);
    resetMobileJoystickVisual();
    dragging = true;
    dragPointerId = e.pointerId;
    lastPointerX = e.clientX;
    viewportWrap.setPointerCapture?.(e.pointerId);
    updateViewportGestureFromPointer(e, true);
  });
  viewportWrap.addEventListener('pointermove', (e) => {
    if (!dragging || dragPointerId !== e.pointerId || pointerLocked || modalOpen) return;
    updateViewportGestureFromPointer(e, false);
  });
  viewportWrap.addEventListener('pointerup', (e) => {
    if (dragPointerId !== e.pointerId) return;
    e.preventDefault();
    resetViewportGesture(true);
  });
  viewportWrap.addEventListener('pointercancel', (e) => {
    if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
    resetViewportGesture(false);
  });
  viewportWrap.addEventListener('dblclick', e => { if (!isCoarsePointer()) { e.preventDefault(); performInteraction(); } });

  soundBtn.addEventListener('click', () => { state.sound = !state.sound; saveState(); updateHUD(); if (state.sound) softTone(); });
  mapBtn.addEventListener('click', () => { cancelMapSteering(true); state.mapVisible = !state.mapVisible; saveState(); updateHUD(); });
  mazeQuickExitBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); leaveSolvedMazeQuickly(); });
  resetBtn.addEventListener('click', openResetConfirm);
  collectionBtn.addEventListener('click', openCollection);
  continueCampaignBtn?.addEventListener('click', () => {
    const next = campaignAdapter?.nextLevel?.();
    if (next) goToNextCampaignLevel();
    else if (campaignAdapter?.isLevelComplete()) openLevelComplete();
  });
  collectionClose.addEventListener('click', () => closeModal(collectionOverlay));
  glyphPopupClose.addEventListener('click', () => {
    closeModal(glyphPopup);
    if (pendingGlyphRewards.length) {
      const next = pendingGlyphRewards.shift();
      showGlyphReward(next.word, next.source);
    } else if (campaignAdapter?.isLevelComplete()) {
      openLevelComplete();
    }
  });
  sentenceCloseBtn.addEventListener('click', () => closeModal(sentenceOverlay));
  sentenceCompleteBtn.addEventListener('click', completeActiveSentence);
  puzzleResetBtn.addEventListener('click', clearCampaignPuzzleSlots);
  puzzleCompleteBtn.addEventListener('click', completeActiveCampaignPuzzle);
  puzzleCloseBtn.addEventListener('click', closeCampaignPuzzleHost);
  window.addEventListener('toki-campaign-open-puzzle', (event) => {
    const puzzle = event.detail && event.detail.puzzle;
    if (puzzle) {
      if(QA_MODE) qaRecordPuzzleCheckpoint(puzzle);
      openCampaignPuzzleHost(puzzle);
    }
  });
  levelIntroStartBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); startLevelFromIntro(); });
  levelIntroOverlay?.addEventListener('pointerup', (e) => { if (e.target === levelIntroStartBtn) return; e.preventDefault(); startLevelFromIntro(); }, {passive:false});
  continueLevelBtn.addEventListener('click', goToNextCampaignLevel);
  stayLevelBtn.addEventListener('click', () => closeModal(levelCompleteOverlay));
  resetConfirmCancelBtn?.addEventListener('click', () => closeModal(resetConfirmOverlay));
  resetConfirmStartBtn?.addEventListener('click', (e) => { e.preventDefault(); resetGame(); });
  languageSelect?.addEventListener('change', () => {
    uiLanguage = I18N?.setLanguage?.(languageSelect.value) || (languageSelect.value === 'en' ? 'en' : 'tp');
    applyStaticLanguage();
    renderLog();
    renderCollection();
    updateHUD();
    if (activePanelId && sentenceOverlay && !sentenceOverlay.hidden) {
      const panel = PANELS[activePanelId];
      renderLocalized(sentenceTitle, isTpLanguage() ? (activePanelId === 'entrySentence' ? 'sitelen open' : 'sitelen tomo sewi') : panel?.title || 'Inscription');
      renderSentencePanel();
    }
    if (activeCampaignPuzzle && puzzleOverlay && !puzzleOverlay.hidden) renderCampaignPuzzle();
    if (levelIntroOverlay && !levelIntroOverlay.hidden) showLevelIntro();
    if (levelCompleteOverlay && !levelCompleteOverlay.hidden) openLevelComplete();
    if (resetConfirmOverlay && !resetConfirmOverlay.hidden) openResetConfirm();
    canvas?.focus({preventScroll:true});
  });

  async function init() {
    applyStaticLanguage();
    if (puzzleBody && !puzzleBody.__mobileLandscapeFitObserver) {
      const observer = new MutationObserver(() => scheduleMobileLandscapePuzzleFit());
      observer.observe(puzzleBody, {childList:true, subtree:true});
      puzzleBody.__mobileLandscapeFitObserver = observer;
      if (puzzleInstructions && !puzzleInstructions.__mobileLandscapeFitObserver) {
        const instructionObserver = new MutationObserver(() => scheduleMobileLandscapePuzzleFit());
        instructionObserver.observe(puzzleInstructions, {childList:true, subtree:true, characterData:true});
        puzzleInstructions.__mobileLandscapeFitObserver = instructionObserver;
      }
      if (window.ResizeObserver && puzzleInstructions && !puzzleInstructions.__mobileLandscapeResizeObserver) {
        const instructionResizeObserver = new ResizeObserver(() => scheduleMobileLandscapePuzzleFit());
        instructionResizeObserver.observe(puzzleInstructions);
        puzzleInstructions.__mobileLandscapeResizeObserver = instructionResizeObserver;
      }
      const handleMobileLandscapeViewportChange = () => {
        scheduleMobileLandscapePuzzleFit();
        scheduleMobileLandscapeGameCenter();
      };
      window.addEventListener('resize', handleMobileLandscapeViewportChange, {passive:true});
      window.addEventListener('orientationchange', handleMobileLandscapeViewportChange, {passive:true});
      window.visualViewport?.addEventListener?.('resize', handleMobileLandscapeViewportChange, {passive:true});
    }
    installTPQA();
    try { db = await openDb(); } catch (err) { console.warn('[game] IndexedDB unavailable', err); db = null; }
    let saved = await dbGet();

    if (!window.TOKI_PONA_CAMPAIGN || !window.TokiPonaCampaignEngineAdapter) throw new Error('Campaign layer failed to load.');
    let recoveredTestReset = false;
    try {
      const recovery = window.TokiPonaGameReset?.recoverPendingReset?.(window.TOKI_PONA_CAMPAIGN, saved, window.localStorage);
      if (recovery?.recovered && recovery.state) {
        saved = recovery.state;
        await dbPut(saved);
        recoveredTestReset = true;
      }
      // The reset directive is a one-shot recovery guard. Once the matching reset
      // state is safely present in IndexedDB, consume it so later legitimate
      // progression cannot be mistaken for stale data and rewound on reload.
      window.TokiPonaGameReset?.consumeAppliedResetDirective?.(saved, window.localStorage);
    } catch (err) {
      console.warn('[game] test reset recovery failed', err);
    }

    state = normalizeSavedState(saved);
    const validation = window.TokiPonaCampaignValidator?.validateCampaign(window.TOKI_PONA_CAMPAIGN);
    if (validation && !validation.ok) throw new Error(window.TokiPonaCampaignValidator.formatReport(validation));
    campaignAdapter = window.TokiPonaCampaignEngineAdapter.createAdapter({ campaign:window.TOKI_PONA_CAMPAIGN, persisted:state.campaign || null });
    state.campaign = campaignAdapter.snapshot();
    restoreDoorState();
    syncWorldFromCampaign();
    repairLevel10TextileState();
    markCellExplored(Math.floor(state.x), Math.floor(state.y));

    if (document.fonts?.load) {
      try {
        await document.fonts.load(`48px "${NASIN_NANPA_FONT}"`, glyphChar('pona'));
        await document.fonts.ready;
        spriteCache.clear();
      } catch (_) {}
    }

    renderLog(); renderCollection(); updateHUD(); bindMobileControls(); bindMiniMapSteering();
    scheduleMobileLandscapeGameCenter();
    const restored = saved && saved.version === SAVE_VERSION;
    const restoredLevelNo = campaignAdapter.currentLevel()?.ordinal || state.chapter;
    if (campaignAdapter.isLevelComplete() && campaignAdapter.nextLevel?.()) {
      showMessage(`Level ${restoredLevelNo} complete. Use Continue to Level ${campaignAdapter.nextLevel().ordinal}.`);
    } else if (campaignAdapter.isLevelComplete() && !campaignAdapter.nextLevel?.()) {
      showMessage('Campaign complete: 120 / 120 glyphs recovered.');
      window.setTimeout(() => { if (!modalOpen) openLevelComplete(); }, 120);
    } else if (recoveredTestReset) {
      showMessage(`Level ${restoredLevelNo} has returned to its starting point.`);
    } else {
      showMessage(restored ? `Welcome back. Your Level ${restoredLevelNo} progress has been restored.` : 'Campaign ready.');
    }
    if (state.levelIntroPending) window.setTimeout(() => showLevelIntro(), 80);
    window.setInterval(() => { saveState(); flushSave(); }, 1200);
    window.addEventListener('pagehide', () => { saveState(); flushSave(); });
    requestAnimationFrame(frame);
  }

  init().catch(err => {
    console.error('[game] initialization failed', err);
    showMessage('The game could not initialize.');
  });
})();
