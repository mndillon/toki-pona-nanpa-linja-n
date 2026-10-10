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
        {areaId:'l3Core',name:'Synchronization Core',x1:1,y1:8,x2:8.9,y2:14.9,instruction:'o ante ala e kontekis.',hint:'Choose the contextual numeric cartouche that matches the time display.'}
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
        '#.............................#',
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
        {areaId:'l10Dispatch',name:'Dispatch Bay',x1:21.1,y1:1,x2:29.9,y2:13.9,instruction:'o pana e ijo pona tawa ma weka.',hint:()=>campaignWorld().l10TextileDone?'Final inspection: the clean pan sample belongs here; the unsafe suwi sample belongs in Quarantine.':'Dispatch is for the final inspection. Nothing here is active yet; follow the current objective first.'}
      ],
      doors:[],
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
        {id:'l10DispatchAuditStand',type:'pedestal',auditDest:'dispatch',x:25.0,y:4.2,scale:0.82,radius:0.38,interact:'l10AuditStand',puzzleId:'l10-inspection-audit',areaId:'l10Dispatch',visibleWhen:()=>Boolean(campaignWorld().l10TextileDone)},
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
        {areaId:'l10Textile',name:'Textile / Dye Loft',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o sama e telo kule. o pana e len tawa ilo pona.',hint:'Prepare the 2:1:1 dye mixture, then carry each cloth batch to the correct station. Completion drops an awning shortcut to the market floor.'},
        {areaId:'l10Ledger',name:'Ledger Office',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o lukin e lipu esun. o pana e ijo ike tawa ma jaki.',hint:'After the textile chain, two inspection samples appear here. Their records refer to the deliveries and cold history already used in this level.'}
      ],
      doors:[],
      objects:[
        {id:'l10UpperServiceLift',type:'ladder',x:2.5,y:10.6,scale:1.02,radius:0.36,interact:'l10UpperToLower',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10UpperLift)},
        {id:'l10UpperAwningDown',type:'ladder',x:10.3,y:10.6,scale:1.02,radius:0.36,interact:'l10UpperToGround',areaId:'l10Textile',visibleWhen:()=>Boolean(campaignWorld().l10AwningOpen)},
        {id:'l10BlueCloth',type:'parcel',word:'laso',textileId:'blue-cloth',x:3.0,y:3.1,scale:0.7,radius:0.3,interact:'l10TextileParcel',areaId:'l10Textile'},
        {id:'l10WhiteCloth',type:'parcel',word:'walo',textileId:'white-cloth',x:7.0,y:3.1,scale:0.7,radius:0.3,interact:'l10TextileParcel',areaId:'l10Textile'},
        {id:'l10DyeMixer',type:'console',x:5.2,y:6.8,scale:0.96,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-textile-mixer',areaId:'l10Textile'},
        {id:'l10DyeFrame',type:'pedestal',stationId:'dye-frame',x:4.0,y:10.0,scale:0.82,radius:0.38,interact:'l10TextileStation',puzzleId:'l10-textile-routing',areaId:'l10Textile'},
        {id:'l10FinishTable',type:'pedestal',stationId:'finish-table',x:8.0,y:10.0,scale:0.82,radius:0.38,interact:'l10TextileStation',puzzleId:'l10-textile-routing',areaId:'l10Textile'},
        {id:'l10BreadSample',type:'parcel',word:'pan',auditId:'bread-sample',x:16.0,y:4.0,scale:0.66,radius:0.28,interact:'l10AuditParcel',areaId:'l10Ledger',visibleWhen:()=>Boolean(campaignWorld().l10TextileDone)},
        {id:'l10SweetSample',type:'parcel',word:'suwi',auditId:'sweet-sample',x:20.0,y:4.0,scale:0.66,radius:0.28,interact:'l10AuditParcel',areaId:'l10Ledger',visibleWhen:()=>Boolean(campaignWorld().l10TextileDone)}
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
        {areaId:'l10Cold',name:'Cold Store',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o pona e lete. o awen e ko lon nanpa pona.',hint:'Three coupled controls must simultaneously reach freezer −18.0, chilled store +4.0 and gel loop +0.5. Stabilization activates the direct chilled service lift to the loft.'},
        {areaId:'l10Quarantine',name:'Quarantine',x1:12.1,y1:1,x2:23.9,y2:12.9,instruction:'o pana e ijo jaki lon ni.',hint:'The final unsafe inspection sample belongs here. Wrong placements remain recoverable.'}
      ],
      doors:[],
      objects:[
        {id:'l10ColdConsole',type:'console',x:5.5,y:4.2,scale:1.0,radius:0.4,interact:'campaignPuzzle',puzzleId:'l10-cold-chain',areaId:'l10Cold'},
        {id:'l10LowerGroundLift',type:'ladder',x:2.5,y:10.4,scale:1.02,radius:0.36,interact:'l10LowerToGround',areaId:'l10Cold'},
        {id:'l10LowerUpperLift',type:'ladder',x:9.2,y:10.4,scale:1.02,radius:0.36,interact:'l10LowerToUpper',areaId:'l10Cold',visibleWhen:()=>Boolean(campaignWorld().l10UpperLift)},
        {id:'l10QuarantineAuditStand',type:'pedestal',auditDest:'quarantine',x:18.0,y:8.0,scale:0.82,radius:0.38,interact:'l10AuditStand',puzzleId:'l10-inspection-audit',areaId:'l10Quarantine',visibleWhen:()=>Boolean(campaignWorld().l10TextileDone)}
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
        {areaId:'l12Final',name:'Final Sudoku Chamber',x1:1,y1:1,x2:11.9,y2:12.9,instruction:'o pini e musi nanpa pini.',hint:()=>campaignWorld().l12ExitUnlocked?'The final Sudoku is solved. All 120 canonical glyphs have been recovered.':'This is the last puzzle. Complete the expert 9×9 nanpa-linja-n Sudoku; use notes if needed and press Try answer only when ready.'}
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
  const viewportMove = { mode:'idle', strength:0 };
  const VIEWPORT_MOVE_THRESHOLD = 0.36;
  const VIEWPORT_MOVE_EXPONENT = 1.7;
  const MOBILE_JOYSTICK_DEAD_RATIO = 0.34;
  const MOBILE_JOYSTICK_MOVE_EXPONENT = 1.85;
  const MOBILE_JOYSTICK_TURN_EXPONENT = 2.25;
  const MOBILE_JOYSTICK_BOOST_START = 0.42;
  const MOBILE_JOYSTICK_MOVE_MAX = 1.90;
  const MOBILE_JOYSTICK_TURN_MAX = 1.65;
  const mobileMapSteer = { active:false, pointerId:null, levelId:null, targetCell:null, path:[], pathIndex:0 };
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
            showMessage('Saved game changed in another tab. This tab will not overwrite the newer reset. Reload to continue.');
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

  function movePlayer(dx, dy) {
    const nx = state.x + dx;
    const ny = state.y + dy;
    if (canOccupy(nx, state.y)) state.x = nx;
    if (canOccupy(state.x, ny)) state.y = ny;
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

  function l10AuditCorrect(){
    const placements=state.l10AuditPlacements||{};
    return placements.dispatch==='bread-sample'&&placements.quarantine==='sweet-sample';
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
    if(result.ok){showMessage('Textile batch complete. The market awning drops into a direct shortcut to the ground floor.');log('Level 10 textile batch complete: awning shortcut opened.');}
    return Boolean(result.ok);
  }

  function l10MaybeCompleteAudit(){
    if(campaignSolved('l10-inspection-audit')||!l10AuditCorrect())return false;
    const result=completeCampaignPuzzle('l10-inspection-audit','Earned by quarantining the unsafe sample and dispatching the clean shipment sample.');
    if(result.ok){showMessage('Inspection complete. The dispatch shutter is released.');log('Level 10 inspection complete: dispatch shutter released.');}
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
    if (obj.interact === 'l10AuditParcel') {
      if (campaignSolved('l10-inspection-audit')) return false;
      return state.l10AuditLocations?.[obj.auditId] === 'ledger';
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
      const dispatch=level().objects.find(obj=>obj.interact==='l10AuditStand'&&obj.auditDest==='dispatch');
      const auditId=state.l10AuditPlacements?.dispatch;
      if(dispatch&&auditId)drawSingleSprite({id:'l10AuditDispatchPlaced',type:'parcel',word:l10ParcelWord(auditId),x:dispatch.x,y:dispatch.y,scale:0.40},zBuffer,-0.50);
    }
    if (state.levelId === 'l10upper') {
      for (const station of level().objects.filter(obj=>obj.interact==='l10TextileStation')) {
        const textileId=state.l10TextilePlacements?.[station.stationId];
        if(textileId)drawSingleSprite({id:`l10TextilePlaced:${station.stationId}`,type:'parcel',word:l10ParcelWord(textileId),x:station.x,y:station.y,scale:0.40},zBuffer,-0.50);
      }
    }
    if (state.levelId === 'l10lower') {
      const quarantine=level().objects.find(obj=>obj.interact==='l10AuditStand'&&obj.auditDest==='quarantine');
      const auditId=state.l10AuditPlacements?.quarantine;
      if(quarantine&&auditId)drawSingleSprite({id:'l10AuditQuarantinePlaced',type:'parcel',word:l10ParcelWord(auditId),x:quarantine.x,y:quarantine.y,scale:0.40},zBuffer,-0.50);
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

  function getSprite(obj) {
    const puzzleSolved = Boolean(obj.puzzleId && campaignSolved(obj.puzzleId));
    const individuallyRecorded = Boolean(obj.interact === 'l11CallPylon' && state.l11CallMarkers?.[obj.pylonId]);
    const key = `${obj.type}:${obj.id || ''}:${obj.puzzleId || ''}:${obj.word || ''}:${obj.panelId || ''}:${state.lowerPowerOn ? 1 : 0}:${state.trapdoorOpen ? 1 : 0}:${puzzleSolved ? 1 : 0}:${individuallyRecorded ? 1 : 0}`;
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
        g.fillStyle = '#303a40'; g.fillRect(18, 31, 92, 87);
        g.strokeStyle = puzzleSolved ? '#8fd0a4' : '#71858f'; g.lineWidth = puzzleSolved ? 5 : 3; g.strokeRect(18, 31, 92, 87);
        g.fillStyle = puzzleSolved ? '#173925' : '#0f181d'; g.fillRect(28, 41, 72, 44);
        g.fillStyle = puzzleSolved ? '#a8e0b9' : '#96c8b6'; g.font = `48px "${NASIN_NANPA_FONT}"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyphChar('sona'), 64, 63);
        g.fillStyle = puzzleSolved ? '#56a874' : '#a78f6b'; g.fillRect(47, 98, 34, 7); verticalOffset = 0.07; break;
      }
      case 'mazeGate': {
        const world = campaignWorld();
        const isExit = obj.id === 'mazeExit';
        const unlocked = isExit ? Boolean(world.mazeExitReleased) : Boolean(world.mazeEntranceUnlocked);
        // Green is reserved for completed/solved state. Merely unlocking the
        // maze entrance uses an amber/neutral ready state until the maze itself
        // has been solved and the exit released.
        const solved = Boolean(world.mazeExitReleased);
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
    if (state.levelId === 'l10ground' && campaignWorld().l10BasementOpen) {
      // Once the delivery is complete, make the newly opened Cold Store route impossible to miss.
      // It remains marked even if that corner of the Market Arcade has not yet been explored.
      const hatch=level().objects.find(obj=>obj.id==='l10GroundColdLift');
      if(hatch){
        const hx=ox+hatch.x*cell,hy=oy+hatch.y*cell,size=Math.max(8,cell*1.05);
        mapCtx.save();
        mapCtx.fillStyle='#d7c28b';mapCtx.strokeStyle='#111';mapCtx.lineWidth=Math.max(1.2,cell*0.12);
        mapCtx.beginPath();mapCtx.arc(hx,hy,size*0.52,0,Math.PI*2);mapCtx.fill();mapCtx.stroke();
        mapCtx.fillStyle='#111';mapCtx.font=`900 ${Math.max(8,Math.floor(size*0.82))}px system-ui,sans-serif`;mapCtx.textAlign='center';mapCtx.textBaseline='middle';mapCtx.fillText('↓',hx,hy-0.5);
        mapCtx.restore();
      }
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
    if (mobileMapSteer.active && mobileMapSteer.levelId === state.levelId && mobileMapSteer.path.length) {
      mapCtx.save();
      mapCtx.strokeStyle='rgba(243,223,192,0.72)';mapCtx.lineWidth=Math.max(1.5,cell*0.12);mapCtx.setLineDash([Math.max(2,cell*0.28),Math.max(2,cell*0.22)]);
      mapCtx.beginPath();mapCtx.moveTo(ox+state.x*cell,oy+state.y*cell);
      for(let i=mobileMapSteer.pathIndex;i<mobileMapSteer.path.length;i+=1){const point=mobileMapSteer.path[i];mapCtx.lineTo(ox+point.x*cell,oy+point.y*cell);}
      mapCtx.stroke();mapCtx.setLineDash([]);
      const target=mobileMapSteer.path[mobileMapSteer.path.length-1];
      mapCtx.strokeStyle='#f3dfc0';mapCtx.lineWidth=Math.max(1.8,cell*0.16);mapCtx.beginPath();mapCtx.arc(ox+target.x*cell,oy+target.y*cell,Math.max(4,cell*0.34),0,Math.PI*2);mapCtx.stroke();
      mapCtx.restore();
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
    if (compact) {
      return `L${p.levelNo} ${p.requiredOwned}/${p.requiredTotal} req${p.bonusOwned ? ` · +${p.bonusOwned} bonus` : ''} · ${p.totalOwned}/120`;
    }
    return `Level ${p.levelNo}: ${p.requiredOwned}/${p.requiredTotal} required glyphs${p.bonusOwned ? ` · ${p.bonusOwned} bonus glyph${p.bonusOwned === 1 ? '' : 's'}` : ''} · ${p.totalOwned}/120 total`;
  }

  function currentObjective() {
    if (!campaignAdapter) return 'Loading campaign…';
    const progress = currentLevelProgress();
    if (campaignAdapter.isLevelComplete()) return `Level ${progress.levelNo} complete · continue when ready.`;
    const prefix = progress.requiredOwned >= progress.requiredTotal && progress.requiredTotal > 0
      ? `${progress.requiredOwned}/${progress.requiredTotal} required ✓ · main objective remains`
      : `${progress.requiredOwned}/${progress.requiredTotal} required${progress.bonusOwned ? ` · +${progress.bonusOwned} bonus` : ''}`;

    if (progress.levelNo === 9 && !campaignSolved('l9-maze-survey')) {
      const survey=l9MarkerProgress();
      return `${prefix} · Labyrinth survey ${survey.found}/${survey.needed} · Find and inspect the remaining survey markers.`;
    }
    if (progress.levelNo === 9 && campaignWorld().l9SphinxReady && !campaignSolved('l9-sphinx-riddles')) {
      return `${prefix} · Survey complete 3/3 · Return to the Sphinx Court at the centre of the labyrinth.`;
    }
    if (progress.levelNo === 9 && campaignSolved('l9-sphinx-riddles') && !campaignSolved('l9-counterweight')) {
      return `${prefix} · Sphinx solved · Use the quick exit from the Sphinx Court to reach the next chamber.`;
    }
    if (progress.levelNo === 10) {
      const world=campaignWorld();
      if(!world.l10PowerOn)return `${prefix} · Balance the Market Permit till to power the freight spine.`;
      if(!world.l10DeliveryDone){
        const bakery=state.l10DeliveryPlacements?.bakery?l10ParcelWord(state.l10DeliveryPlacements.bakery):'empty';
        const sweet=state.l10DeliveryPlacements?.['sweet-stall']?l10ParcelWord(state.l10DeliveryPlacements['sweet-stall']):'empty';
        return `${prefix} · Freight powered · bakery expects pan (${bakery}); sweet-goods expects suwi (${sweet}).`;
      }
      if(!world.l10ColdStable)return `${prefix} · Delivery complete · Cold Store entrance OPEN in the Market Arcade (↓ on minimap). Descend and stabilize the three cold-chain readings.`;
      if(!world.l10DyeReady)return `${prefix} · Cold chain stable · Take the chilled service lift to the Textile Loft and prepare the 2:1:1 dye bath.`;
      if(!world.l10TextileDone)return `${prefix} · Dye ready · Place laso cloth at the dye frame and walo cloth at the clean finishing table.`;
      if(!world.l10ExitUnlocked)return `${prefix} · Textile complete · Take the pan and suwi inspection samples from the Ledger Office; dispatch pan and quarantine suwi.`;
    }
    if (progress.levelNo === 11) {
      const world=campaignWorld(),calls=l11CallProgress();
      if(!world.l11CallsLogged)return `${prefix} · Acoustic survey ${calls.found}/${calls.needed} · Record all three call pylons in the Field Station and Habitat Hub.`;
      if(!world.l11CanopyOpen)return `${prefix} · Calls logged 3/3 · Use the Habitat Hub triangulation console to locate the night roost.`;
      if(!world.l11RoostDone)return `${prefix} · Roost located · Climb the marked canopy ladder ↑ and restore the overnight roost/feeding schedule.`;
      if(!world.l11LineageDone)return `${prefix} · Schedule restored · Descend through the marked incubator hatch ↓ and solve the Lineage Registry.`;
      if(!world.l11PairDone){
        const west=state.l11BandPlacements?.['west-perch']?l11BandWord(state.l11BandPlacements['west-perch']):'empty';
        const east=state.l11BandPlacements?.['east-perch']?l11BandWord(state.l11BandPlacements['east-perch']):'empty';
        return `${prefix} · Lineage solved · Nest bands: west expects loje (${west}); east expects laso (${east}).`;
      }
      if(!world.l11ExitUnlocked)return `${prefix} · Parent bands aligned · Take the new Nest Observatory shortcut ↓ to the Recovery Ward and complete habitat triage.`;
    }
    if (progress.levelNo === 12) {
      const world=campaignWorld();
      if(!world.l12SpineOnline)return `${prefix} · Final archive · Solve the Fracture Core ten-switch parity network first.`;
      if(!world.l12IdentityDone && !world.l12CipherDone)return `${prefix} · Archive spine online · Two marked routes are open: ↑ Identity Gallery and ↓ Totality Cipher Vault. Both branches are required.`;
      if(!world.l12IdentityDone)return `${prefix} · Totality cipher solved · Take the marked upper route and solve the eight-record Identity permutation.`;
      if(!world.l12RelationDone)return `${prefix} · Identity resolved · Complete the Triple Relation mirror array in the upper observatory.`;
      if(!world.l12CipherDone)return `${prefix} · Upper trials complete · Return to the Fracture Core and descend to solve the six-glyph Totality cipher.`;
      if(!world.l12ExitUnlocked)return `${prefix} · All preliminary trials complete · FINAL hatch ↓ is open in the Totality Cipher Vault. Descend to the last Sudoku.`;
    }

    // Map reveal is intentionally a cross-room objective. Keep its destination
    // explicit even while the player is still in Cartography or another room.
    if (progress.levelNo === 2 && campaignWorld().cacheRevealed && !campaignSolved('l2-hidden-cache')) {
      const cachePuzzle = campaignPuzzle('l2-hidden-cache');
      const cacheObjective = cachePuzzle?.ui?.objective || 'Return to the Lower Archive and inspect the revealed cache.';
      return `${prefix} · ${cacheObjective}`;
    }

    const available = campaignAdapter.availablePuzzles();
    const nextPuzzle = available.find(p => p.requiredForMinimum !== false) || available[0] || null;
    const nextObjective = nextPuzzle ? (nextPuzzle.ui?.objective || nextPuzzle.ui?.title || nextPuzzle.id) : campaignAdapter.objective();
    return `${prefix} · ${nextObjective}`;
  }

  function updateHUD() {
    syncWorldFromCampaign();
    const room = currentRoom();
    if (room.areaId) syncCampaignArea(room.areaId);
    roomEl.textContent = room.name;
    levelEl.textContent = `level ${level().chapter} · z ${level().z >= 0 ? '+' : ''}${level().z}`;
    tpInstructionEl.textContent = value(room.instruction) || '—';
    enInstructionEl.textContent = value(room.hint) || '';
    objectiveEl.textContent = currentObjective();
    const progress = currentLevelProgress();
    const carryRaw=String(state.carrying||'');
    const carriedName=state.carrying==='ball'?'sike':carryRaw.startsWith('l9:')?l9RelicWord(carryRaw.slice(3)):carryRaw.startsWith('l10:')?l10ParcelWord(carryRaw.split(':').slice(-1)[0]):carryRaw.startsWith('l11:band:')?`${l11BandWord(carryRaw.slice('l11:band:'.length))} band`:'—';
    if(progress.levelNo===10){
      const cartCargo=(state.l10CartCargo||[]).map(l10ParcelWord);
      inventoryEl.textContent=`carrying: ${carriedName} · cart: ${l10CartDockName(state.l10CartDock)} ${cartCargo.length}/2${cartCargo.length?` (${cartCargo.join(', ')})`:''}`;
    }else inventoryEl.textContent = `carrying: ${carriedName}`;
    const count = progress.totalOwned;
    hudGlyphCountEl.textContent = progressSummaryText(progress, true);
    collectionBtnCountEl.textContent = `${count} / 120`;
    if (continueCampaignBtn) {
      const next = campaignAdapter?.nextLevel?.();
      const complete = Boolean(campaignAdapter?.isLevelComplete());
      continueCampaignBtn.hidden = !complete;
      continueCampaignBtn.textContent = next ? `Continue to Level ${next.ordinal}` : 'Replay celebration';
    }
    soundBtn.textContent = state.sound ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    mapBtn.textContent = state.mapVisible ? 'Map on' : 'Map off';
    mapBtn.setAttribute('aria-pressed', String(state.mapVisible));
    miniMap.classList.toggle('isHidden', !state.mapVisible);
    if (mazeQuickExitBtn) {
      mazeQuickExitBtn.hidden = !(state.levelId === 'maze' && campaignWorld().mazeExitReleased);
    }

    if (!state.visitedRooms[`${state.levelId}:${room.name}`]) {
      state.visitedRooms[`${state.levelId}:${room.name}`] = true;
      log(`Entered ${room.name}.`);
    }
  }

  function interactionLineOfSightClear(targetX, targetY, endpointAllowance = 0.08) {
    // Interaction discovery is intentionally independent of camera facing, but walls and
    // closed doors must block it. This prevents prompts for glyphs/panels on the far side
    // of maze walls while still allowing an in-range object behind the player to be found
    // simply by rotating toward it.
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
      if (!interactionLineOfSightClear(obj.x, obj.y, 0.08)) continue;
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

  function interactionText(target) {
    if (!target) return '';
    const p = interactionPrefix();
    if (target.kind === 'door') {
      const status = doorRequirementStatus(target.door);
      if (!status.ok) return `${p} · ${target.door.label} — locked`;
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
      case 'l10AuditParcel': return state.carrying?`${p} · hands full`:`${p} · take ${obj.word} inspection sample`;
      case 'l10AuditStand': {
        const placed=state.l10AuditPlacements?.[obj.auditDest];
        if(campaignSolved('l10-inspection-audit'))return `${p} · inspect completed ${obj.auditDest} placement`;
        if(placed)return state.carrying?`${p} · ${l10ParcelWord(placed)} sample placed here`:`${p} · take placed ${l10ParcelWord(placed)} sample`;
        if(String(state.carrying||'').startsWith('l10:audit:'))return `${p} · place carried sample in ${obj.auditDest}`;
        return `${p} · ${obj.auditDest} sample position`;
      }
      case 'l10ExitTerminal': return `${p} · inspect open dispatch route`;
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

  function describePuzzleRequirements(puzzle) {
    if (!puzzle) return 'This mechanism is not ready.';
    const rt = campaignRuntime();
    const solved = rt ? rt.solvedSet() : new Set();
    const world = campaignWorld();
    const missingGlyphs = (puzzle.requirements.glyphs || []).filter(g => !collected(g));
    const missingStates = Object.entries(puzzle.requirements.states || {}).filter(([k,v]) => world[k] !== v).map(([k]) => k);
    const missingPuzzles = (puzzle.requirements.solvedPuzzles || []).filter(id => !solved.has(id));
    const parts = [];
    if (missingGlyphs.length) parts.push(`glyph keys: ${missingGlyphs.join(', ')}`);
    if (missingStates.length) parts.push(`world state: ${missingStates.join(', ')}`);
    if (missingPuzzles.length) parts.push(`earlier puzzle: ${missingPuzzles.join(', ')}`);
    return parts.length ? `Not ready — missing ${parts.join(' · ')}.` : 'This mechanism is not ready.';
  }

  function showGlyphReward(word, source) {
    if (!isCollectibleGlyph(word)) return;
    const count = collectionCount();
    glyphPopupGlyph.textContent = glyphChar(word);
    glyphPopupTitle.textContent = word;
    glyphPopupSource.textContent = source || 'Glyph recovered.';
    glyphPopupCount.textContent = progressSummaryText(currentLevelProgress());
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
      showMessage('Exact payment accepted. Conveyor and freight-cart power comes online across the market.');
      log('Level 10 freight spine powered from the market till.');
    }
    if (puzzleId === 'l10-cold-chain') {
      showMessage('Cold chain stable. The chilled service lift now runs directly between the basement and textile loft.');
      log('Level 10 cold chain stable: upper service lift activated.');
    }
    if (puzzleId === 'l10-textile-mixer') {
      showMessage('The 2:1:1 dye mixture is ready. Place both cloth batches at their correct stations.');
      log('Level 10 dye bath prepared at 2:1:1.');
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
      showMessage('Final Sudoku solved. All 120 canonical glyphs are recovered. The campaign is complete.');
      log('Level 12 final Sudoku complete: 120/120 canonical glyphs recovered.');
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
      if (puzzleId === 'l9-sphinx-riddles') {
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

  function performInteraction() {
    if (modalOpen) return;
    const target = findInteractionTarget();
    if (!target) { showMessage('Nothing within reach.'); blockedTone(); return; }

    if (target.kind === 'door') {
      const d = target.door;
      const status = doorRequirementStatus(d);
      if (!status.ok) {
        const missing = [...status.missingGlyphs, ...status.missingStates];
        showMessage(`${d.label} is locked${missing.length ? ` — missing ${missing.join(', ')}` : ''}.`);
        blockedTone(); return;
      }
      d.open = true; state.openDoors[d.id] = true;
      showMessage(`${d.label} opens.`);
      doorTone(); log(`Opened ${d.label}.`); saveState(); return;
    }

    const obj = target.obj;
    if (obj.areaId) syncCampaignArea(obj.areaId);
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
          showMessage('The maze door is still sealed.'); blockedTone();
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
          showMessage('The exit is sealed. Three glyph sockets are waiting for the glyphs hidden in the maze.'); blockedTone();
        }
        break;
      case 'ladderUp':
        if (!campaignWorld().upperAccess) { showMessage('The upper hatch is sealed. The maze mechanism controls it.'); blockedTone(); }
        else transitionLevel('upper', 2.3, 2.5, 0.15, 'You climb into the Upper Gallery.');
        break;
      case 'ladderDown':
        transitionLevel('main', 16.0, 9.35, Math.PI, 'You climb down into the Lower Concourse.');
        break;
      case 'trapdoor':
        if (!campaignWorld().maintenanceAccess) { showMessage('The maintenance hatch is locked.'); blockedTone(); }
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
        if(!campaignWorld().l10PowerOn){showMessage('The freight controls have no power. Balance the Market Permit till first.');blockedTone();break;}
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
        if(campaignSolved('l10-textile-routing')){showMessage('The textile batch is already complete.');softTone();break;}
        if(state.carrying){showMessage('You can carry only one object at a time.');blockedTone();break;}
        state.carrying=`l10:textile:${obj.textileId}`;state.l10TextileLocations[obj.textileId]='carrying';spriteCache.clear();
        showMessage(`You take the ${obj.word} cloth batch.`);pickupTone();break;
      }
      case 'l10TextileStation': {
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
      case 'l10AuditParcel': {
        if(campaignSolved('l10-inspection-audit')){showMessage('The inspection is already complete.');softTone();break;}
        if(state.carrying){showMessage('You can carry only one object at a time.');blockedTone();break;}
        state.carrying=`l10:audit:${obj.auditId}`;state.l10AuditLocations[obj.auditId]='carrying';spriteCache.clear();
        const status=obj.auditId==='sweet-sample'?'cold history +8.5 excursion':'cold history remained within limits';
        showMessage(`${obj.word} sample taken — ${status}.`);pickupTone();break;
      }
      case 'l10AuditStand': {
        if(campaignSolved('l10-inspection-audit')){showMessage('The inspection placement is complete.');softTone();break;}
        state.l10AuditPlacements=state.l10AuditPlacements||{};const placed=state.l10AuditPlacements[obj.auditDest];
        if(placed){
          if(state.carrying){showMessage('Your hands are full.');blockedTone();break;}
          state.carrying=`l10:audit:${placed}`;delete state.l10AuditPlacements[obj.auditDest];state.l10AuditLocations[placed]='carrying';spriteCache.clear();
          showMessage(`You recover the ${l10ParcelWord(placed)} inspection sample.`);pickupTone();break;
        }
        if(!String(state.carrying||'').startsWith('l10:audit:')){showMessage(`The ${obj.auditDest} position is empty.`);softTone();break;}
        const auditId=String(state.carrying).slice('l10:audit:'.length);state.l10AuditPlacements[obj.auditDest]=auditId;state.l10AuditLocations[auditId]=obj.auditDest;state.carrying=null;spriteCache.clear();
        showMessage(`${l10ParcelWord(auditId)} sample placed in ${obj.auditDest}.`);stepTone();
        if(!l10MaybeCompleteAudit())log(`Inspection placement: ${l10ParcelWord(auditId)} → ${obj.auditDest}.`);
        break;
      }
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
      case 'l12ExitTerminal': showMessage('The final archive is stable. All 120 canonical glyphs are recovered.');successTone();break;
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
    glyphPopupSource.textContent = source || 'Glyph recovered.';
    glyphPopupCount.textContent = progressSummaryText(currentLevelProgress());
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
    sentenceTitle.textContent = panel.title;
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
      sentenceStatus.textContent = `Complete: ${panel.completionText}`;
      sentenceCompleteBtn.disabled = true;
      sentenceCompleteBtn.textContent = 'Sentence complete';
    } else if (missing.length === 1 && missing[0] === panel.reward) {
      sentenceStatus.textContent = `Only one glyph is missing. Your collection is sufficient to reconstruct the sentence.`;
      sentenceCompleteBtn.disabled = false;
      sentenceCompleteBtn.textContent = 'Complete sentence';
    } else {
      sentenceStatus.textContent = `${missing.length} glyphs are still missing. Recover more glyphs and return to this inscription.`;
      sentenceCompleteBtn.disabled = true;
      sentenceCompleteBtn.textContent = 'More glyphs required';
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

  function renderGlyphFamilyPicker() {
    puzzleTray.textContent = '';
    const families = puzzleFamilyMap();
    const familyRow = document.createElement('div');
    familyRow.className = 'puzzleFamilyRow';
    for (const letter of TOKI_PONA_LETTERS) {
      const words = families.get(letter) || [];
      if (!words.length) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `puzzleFamilyKey${selectedPuzzleFamily === letter ? ' isSelected' : ''}`;
      btn.textContent = letter;
      btn.setAttribute('aria-label', `${letter} glyph family, ${words.length} available`);
      btn.addEventListener('click', () => {
        selectedPuzzleFamily = selectedPuzzleFamily === letter ? null : letter;
        selectedPuzzleGlyph = null;
        renderCampaignPuzzle();
      });
      familyRow.appendChild(btn);
    }
    const punctuation = document.createElement('button');
    punctuation.type = 'button';
    punctuation.className = `puzzleFamilyKey punctuation${selectedPuzzleFamily === 'PUNCT' ? ' isSelected' : ''}`;
    punctuation.textContent = '·';
    punctuation.title = 'Punctuation / structural symbols';
    punctuation.setAttribute('aria-label','Punctuation and structural symbols');
    punctuation.addEventListener('click', () => {
      selectedPuzzleFamily = selectedPuzzleFamily === 'PUNCT' ? null : 'PUNCT';
      selectedPuzzleGlyph = null;
      renderCampaignPuzzle();
    });
    familyRow.appendChild(punctuation);
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
    drawerTitle.textContent = selectedPuzzleFamily === 'PUNCT' ? 'Punctuation' : selectedPuzzleFamily;
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
      key.addEventListener('click', () => choosePuzzleGlyph(token));
      key.addEventListener('pointerup', directChoosePuzzleGlyphFromEvent);
      key.addEventListener('pointerdown', beginPuzzleGlyphDrag, { passive:false });
      drawerKeys.appendChild(key);
    }
    drawer.appendChild(drawerKeys);
    puzzleTray.appendChild(drawer);
  }

  const MECHANISM_PUZZLE_TYPES = new Set(['dial-bank','route-board','path-grid','lights-out','balance-scale','context-match','jug-transfer','hanoi-stack','codebreaker','equivalence-grid','schedule-order','river-crossing','sokoban','sliding-grid','peg-solitaire','pattern-sequence','nonogram','card-sort','calculator-sequence','base-match','ring-lock','tone-sequence','airflow-network','pulse-sync','spectrum-order','power-balance','deduction-order','dual-mirror','truth-gates','dependency-order','exact-path','sphinx-riddles','coupled-switches','layer-alignment','market-till','cold-chain','textile-mixer','call-triangulation','lineage-match','habitat-triage','sudoku']);
  const DIGIT_GLYPH_WORDS = ['ijo','wan','tu','seli','awen','luka','utala','mun','pipi','jo'];

  function isMechanismPuzzle(puzzle) {
    return Boolean(puzzle && MECHANISM_PUZZLE_TYPES.has(puzzle.type));
  }

  function mechanismDigit(value) {
    const n = Number(value);
    const word = Number.isInteger(n) && n >= 0 && n <= 9 ? DIGIT_GLYPH_WORDS[n] : null;
    return word ? glyphChar(word) : String(value);
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
      case 'dual-mirror': return { orientations:Array.from(payload.initialOrientations || (payload.mirrors || []).map(()=>0)).map(v=>Number(v)?1:0) };
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

  function routeConnectivity(puzzle) {
    const payload = puzzle.ui?.payload || {};
    const width = Number(payload.width) || 4, height = Number(payload.height) || 4;
    const tiles = payload.tiles || [];
    const state = puzzleMechanismState || freshMechanismState(puzzle);
    const byPos = new Map();
    tiles.forEach((tile,index) => byPos.set(`${tile.x},${tile.y}`, {tile,index,rotation:state.rotations?.[index] ?? tile.rotation ?? 0}));
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
      case 'call-triangulation': return Array.isArray(st.selected) && Number(st.selected[0])===Number(payload.target?.[0]) && Number(st.selected[1])===Number(payload.target?.[1]);
      case 'lineage-match': return JSON.stringify(st.assignments||[])===JSON.stringify(payload.targetAssignments||[]);
      case 'habitat-triage': return String(st.akesi||'')===String(payload.target?.akesi||'') && String(st.moli||'')===String(payload.target?.moli||'');
      case 'sudoku': return Array.isArray(st.cells) && st.cells.length===81 && JSON.stringify(st.cells.map(Number))===JSON.stringify((payload.solution||[]).map(Number));
      case 'pattern-sequence': return Number(st.selectedIndex)===Number(payload.correctIndex);
      default: return false;
    }
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
    if (NO_PREVIEW_MECHANISM_TYPES.has(puzzle?.type)) {
      puzzleStatus.textContent = neutralText || 'Set the complete answer, then press Try answer. Correctness is checked only when you submit.';
    } else {
      puzzleStatus.textContent = text || 'Adjust the mechanism, then press Try answer.';
    }
    puzzleCompleteBtn.disabled = false;
  }

  function renderDialBankPuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState;
    const clues=document.createElement('div'); clues.className='mechanismClues';
    for(const clue of payload.clues||[]) { const row=document.createElement('div'); row.className='mechanismClue'; row.textContent=clue; clues.appendChild(row); }
    const bank=document.createElement('div'); bank.className='dialBank';
    const names=['left','middle','right'];
    (st.values||[]).forEach((value,index)=>{
      const dial=document.createElement('div'); dial.className='dialUnit';
      const label=document.createElement('div'); label.className='dialLabel'; label.textContent=names[index]||`dial ${index+1}`;
      const up=document.createElement('button'); up.type='button'; up.className='dialAdjust'; up.textContent='▲'; up.setAttribute('aria-label',`Increase ${label.textContent}`);
      const display=document.createElement('div'); display.className='dialValue'; display.innerHTML=`<span class="sitelenGlyph">${mechanismDigit(value)}</span><small>${value}</small>`;
      const down=document.createElement('button'); down.type='button'; down.className='dialAdjust'; down.textContent='▼'; down.setAttribute('aria-label',`Decrease ${label.textContent}`);
      up.addEventListener('click',()=>{st.values[index]=(Number(st.values[index])+1)%10;renderCampaignPuzzle();});
      down.addEventListener('click',()=>{st.values[index]=(Number(st.values[index])+9)%10;renderCampaignPuzzle();});
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
      btn.className=`routeTile${connectivity.connected.has(`${x},${y}`)?' connected':''}`; btn.textContent=routeTileSymbol(item.tile.type,rot);
      if(x===0&&y===Number(payload.sourceRow)) btn.dataset.edge='IN';
      if(x===width-1&&y===Number(payload.sinkRow)) btn.dataset.edge='OUT';
      btn.setAttribute('aria-label',`Rotate relay at column ${x+1}, row ${y+1}${btn.dataset.edge ? `, ${btn.dataset.edge}` : ''}`);
      btn.addEventListener('click',()=>{state.rotations[item.index]=(rot+1)%(item.tile.type==='straight'?2:4);renderCampaignPuzzle();});
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
      if(nx<0||ny<0||nx>=width||ny>=height||blocks.has(`${nx},${ny}`)){puzzleStatus.textContent='That route is blocked.';blockedTone();return;}
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
      const x=index%size,y=Math.floor(index/size);
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<size&&ny<size){const i=ny*size+nx;st.lights[i]=st.lights[i]?0:1;}}
      renderCampaignPuzzle();
    };
    st.lights.forEach((on,index)=>{const b=document.createElement('button');b.type='button';b.className=`lightCell${on?' on':''}`;b.setAttribute('aria-label',`Lamp ${index+1}, ${on?'on':'off'}`);b.addEventListener('click',()=>toggle(index));grid.appendChild(b);});
    puzzleSlots.appendChild(grid);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All lamps are lit. Press Try answer to confirm the observation panel.':'Make every lamp glow at the same time.');
  }

  function renderBalancePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const weights=payload.weights||[]; const sum=balanceSum(puzzle);
    const target=document.createElement('div'); target.className='balanceTarget';
    const label=document.createElement('strong'); label.textContent='target mass';
    const canvas=document.createElement('canvas'); canvas.width=220; canvas.height=68; canvas.className='balanceTargetCanvas';
    target.append(label,canvas); puzzleSlots.appendChild(target); renderNanpaSourceToCanvas(String(payload.target),canvas,36);
    const tray=document.createElement('div'); tray.className='balanceWeights';
    weights.forEach((weight,index)=>{const b=document.createElement('button');b.type='button';b.className=`balanceWeight${st.selected[index]?' selected':''}`;b.innerHTML=`<span class="sitelenGlyph">${mechanismDigit(weight)}</span><small>${weight}</small>`;b.setAttribute('aria-pressed',String(Boolean(st.selected[index])));b.addEventListener('click',()=>{st.selected[index]=!st.selected[index];renderCampaignPuzzle();});tray.appendChild(b);});
    const readout=document.createElement('div');readout.className=`balanceReadout${sum===Number(payload.target)?' balanced':''}`;readout.textContent=`selected mass: ${sum}`;
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
      const c=document.createElement('canvas');c.width=320;c.height=78;c.className='contextChoiceCanvas';b.append(tag,c);b.addEventListener('click',()=>{st.selectedIndex=index;renderCampaignPuzzle();});choices.appendChild(b);
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
    header.innerHTML=`<strong>target</strong><span class="sitelenGlyph">${mechanismDigit(target)}</span><small>${target} units</small>`;
    const vessels=document.createElement('div'); vessels.className='jugVessels';
    caps.forEach((cap,index)=>{
      const amount=Number(st.amounts?.[index])||0;
      const unit=document.createElement('div'); unit.className='jugUnit';
      const vessel=document.createElement('div'); vessel.className='jugVessel';
      const fill=document.createElement('div'); fill.className='jugVesselFill'; fill.style.height=`${cap ? (amount/cap)*100 : 0}%`;
      const read=document.createElement('div'); read.className='jugReadout'; read.innerHTML=`<span class="sitelenGlyph">${mechanismDigit(amount)}</span><small>${amount} / ${cap}</small>`;
      vessel.append(fill,read); const label=document.createElement('div'); label.className='jugLabel'; label.textContent=`${cap}-unit vessel`;
      unit.append(vessel,label); vessels.appendChild(unit);
    });
    const controls=document.createElement('div'); controls.className='jugControls';
    const action=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='jugAction';b.textContent=label;b.addEventListener('click',()=>{fn();renderCampaignPuzzle();});controls.appendChild(b);};
    action(`Fill ${caps[0]}`,()=>{st.amounts[0]=caps[0];});
    action(`Fill ${caps[1]}`,()=>{st.amounts[1]=caps[1];});
    action(`Empty ${caps[0]}`,()=>{st.amounts[0]=0;});
    action(`Empty ${caps[1]}`,()=>{st.amounts[1]=0;});
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
      for(const size of rod){const disk=document.createElement('div');disk.className='hanoiDisk';disk.style.width=`${38+(Number(size)/n)*56}%`;disk.innerHTML=`<span class="sitelenGlyph">${mechanismDigit(size)}</span>`;stack.appendChild(disk);}
      const base=document.createElement('div'); base.className='hanoiBase'; const label=document.createElement('small');label.textContent=`post ${rodIndex+1}`;
      btn.append(post,stack,base,label);
      btn.addEventListener('click',()=>{
        if(st.selectedRod==null){if(!rod.length){puzzleStatus.textContent='That post has no disc to move.';blockedTone();return;}st.selectedRod=rodIndex;renderCampaignPuzzle();return;}
        const from=Number(st.selectedRod); if(from===rodIndex){st.selectedRod=null;renderCampaignPuzzle();return;}
        const source=st.rods[from], dest=st.rods[rodIndex], disk=source[source.length-1], top=dest[dest.length-1];
        if(disk==null){st.selectedRod=null;renderCampaignPuzzle();return;}
        if(top!=null && Number(top)<Number(disk)){puzzleStatus.textContent='A larger disc cannot sit on a smaller disc.';blockedTone();return;}
        source.pop(); dest.push(disk); st.moves=(Number(st.moves)||0)+1; st.selectedRod=null; renderCampaignPuzzle();
      });
      board.appendChild(btn);
    });
    const moves=document.createElement('div');moves.className='hanoiMoves';moves.textContent=`moves: ${Number(st.moves)||0}`;
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
    const legend=document.createElement('div');legend.className='codeLegend';
    const legendTitle=document.createElement('strong');legendTitle.textContent='available glyphs';legend.appendChild(legendTitle);
    words.forEach((word)=>{const item=document.createElement('span');item.className='codeLegendGlyph';item.title=word;item.setAttribute('aria-label',word);const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(word);item.appendChild(glyph);legend.appendChild(item);});
    const guess=document.createElement('div'); guess.className='codeGuess';guess.style.setProperty('--code-cols',String(Math.min(words.length,6)));guess.dataset.symbolCount=String(words.length);
    st.guess.forEach((value,index)=>{const word=words[Number(value)%words.length]||words[0];const b=document.createElement('button');b.type='button';b.className='codeSymbol';b.innerHTML=`<span class="sitelenGlyph">${glyphChar(word)}</span>`;b.setAttribute('aria-label',`Position ${index+1}, ${word}. Tap to change glyph.`);b.addEventListener('click',()=>{st.guess[index]=(Number(st.guess[index])+1)%words.length;renderCampaignPuzzle();});guess.appendChild(b);});
    const submit=document.createElement('button');submit.type='button';submit.className='codeSubmit';submit.textContent='Test code';submit.disabled=Boolean(st.solved);submit.addEventListener('click',()=>{
      const fb=codebreakerFeedback(secret,st.guess); st.history.push({guess:Array.from(st.guess),exact:fb.exact,misplaced:fb.misplaced});
      const max=Math.max(1,Number(payload.maxHistory)||5); if(st.history.length>max) st.history.splice(0,st.history.length-max);
      if(fb.exact===secret.length){st.solved=true;successTone();} else softTone(); renderCampaignPuzzle();
    });
    const history=document.createElement('div');history.className='codeHistory';
    for(const item of st.history){const row=document.createElement('div');row.className='codeHistoryRow';const code=document.createElement('span');code.className='codeHistorySymbols';for(const v of item.guess){const word=words[Number(v)%words.length]||words[0];const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(word);glyph.title=word;code.appendChild(glyph);}const fb=document.createElement('span');fb.textContent=`exact ${item.exact} · misplaced ${item.misplaced}`;row.append(code,fb);history.appendChild(row);}
    puzzleSlots.append(legend,guess,submit,history);
    setMechanismStatus(puzzle,st.solved?`The ${secret.length}-glyph code is confirmed. Press Try answer to confirm the vault.`:st.history.length?'Use exact/misplaced feedback to refine the permutation.':`Tap each of the ${secret.length} positions to choose a glyph, then test the code.`);
  }

  function renderEquivalencePuzzle(puzzle) {
    const payload=puzzle.ui?.payload||{}; const st=puzzleMechanismState; const fractions=payload.fractions||[], decimals=payload.decimals||[], percents=payload.percents||[];
    const wrap=document.createElement('div');wrap.className='equivalenceWrap';
    const grid=document.createElement('div');grid.className='equivalenceGrid';
    for(const title of ['fraction','decimal','percent']){const h=document.createElement('div');h.className='equivalenceHeader';h.textContent=title;grid.appendChild(h);}
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
      const rendered=await renderer.renderTextToNewCanvas({input:String(source),layout:{fontPx,align:'center',spacingPreset:'compact',paddingPx:6},parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true}});
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
      const rank=document.createElement('div');rank.className='scheduleRank';rank.textContent=String(row+1);
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
    const ruleLead=document.createElement('strong');ruleLead.textContent='jan must stay with these pairs:';rules.appendChild(ruleLead);
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
    labels.innerHTML='<span>LEFT BANK</span><span></span><span>RIVER</span><span></span><span>RIGHT BANK</span>';
    scene.appendChild(labels);
    const board=document.createElement('div');board.className='riverBoard';

    const cargoExists=(row,side)=>travellers.findIndex((_,i)=>selected!==i && Number(itemSides[i])===side && Number(itemRows[i])===row);
    const alignedItemIndex=travellers.findIndex((_,i)=>selected!==i && Number(itemSides[i])===playerSide && Number(itemRows[i])===boatRow);
    const boatCol=playerSide===0?1:2;
    const boatCargoLabel=selected!=null && travellers[selected] ? `supa&${travellers[selected].glyph||'ijo'}` : 'supa';

    function renderBankToken(i){
      const tr=travellers[i];
      const token=document.createElement('div'); token.className='riverToken';
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
      load.textContent='Load';
      load.disabled=alignedItemIndex<0;
      load.addEventListener('click',()=>{
        if(alignedItemIndex<0){blockedTone(); return;}
        st.selectedItem=alignedItemIndex; renderCampaignPuzzle();
      });
    } else {
      load.textContent='Unload';
      load.addEventListener('click',()=>{
        const occupied=travellers.some((_,i)=>i!==selected && Number(itemSides[i])===playerSide && Number(itemRows[i])===boatRow);
        if(occupied){puzzleStatus.textContent='That bank position is already occupied.'; blockedTone(); return;}
        st.itemSides[selected]=playerSide; st.itemRows[selected]=boatRow; st.selectedItem=null; renderCampaignPuzzle();
      });
    }
    const cross=document.createElement('button'); cross.type='button'; cross.className='riverCrossButton'; cross.textContent=playerSide===0?'Cross →':'← Cross';
    cross.addEventListener('click',()=>{
      const to=playerSide?0:1;
      const next={ playerSide:to, boatRow, itemSides:Array.from(itemSides), itemRows:Array.from(itemRows), selectedItem:selected, moves:(Number(st.moves)||0)+1 };
      if(selected!=null) { next.itemSides[selected]=to; next.itemRows[selected]=boatRow; }
      const unsafe=riverCrossingUnsafeDetail(puzzle,next);
      if(unsafe){puzzleStatus.textContent=`No: ${unsafe.label} would be left together without jan.`; blockedTone(); return;}
      puzzleMechanismState=next; renderCampaignPuzzle();
    });
    controls.append(up,down,load,cross);

    const footer=document.createElement('div'); footer.className='riverFooter';
    const moves=document.createElement('span'); moves.textContent=`crossings: ${Number(st.moves)||0}`;
    const hint=document.createElement('span');
    hint.textContent=selected==null ? (alignedItemIndex>=0 ? 'Aligned with a bank object. Load it, or cross alone.' : 'Move the raft up or down to align with an object, then load or cross.') : `Cargo aboard: ${travellers[selected]?.label||''}. Cross, or unload at the aligned bank position.`;
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
    (st.tiles||[]).forEach((value,index)=>{const b=document.createElement('button');b.type='button';b.className=`slidingTile${Number(value)===0?' blank':''}`;if(Number(value)!==0)b.innerHTML=`<span class="sitelenGlyph">${mechanismDigit(value)}</span><small>${value}</small>`;b.disabled=Number(value)===0;b.addEventListener('click',()=>{const z=st.tiles.indexOf(0),x=index%size,y=Math.floor(index/size),zx=z%size,zy=Math.floor(z/size);if(Math.abs(x-zx)+Math.abs(y-zy)!==1){blockedTone();return;}[st.tiles[index],st.tiles[z]]=[st.tiles[z],st.tiles[index]];renderCampaignPuzzle();});grid.appendChild(b);});
    puzzleSlots.appendChild(grid);setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The panel is in numerical order. Press Try answer to confirm the gallery.':'Slide tiles into ascending order, with the empty space last.');
  }

  function renderPegSolitairePuzzle(puzzle) {
    const st=puzzleMechanismState;const row=document.createElement('div');row.className='pegLine';
    (st.pegs||[]).forEach((on,index)=>{const b=document.createElement('button');b.type='button';b.className=`pegHole${on?' occupied':''}${st.selected===index?' selected':''}`;b.textContent=on?'●':'○';b.setAttribute('aria-label',`Hole ${index+1}, ${on?'occupied':'empty'}`);b.addEventListener('click',()=>{if(on){st.selected=st.selected===index?null:index;renderCampaignPuzzle();return;}if(st.selected==null)return;const move=pegMoves(st.pegs).find(m=>m.from===st.selected&&m.to===index);if(!move){puzzleStatus.textContent='That peg cannot jump into this hole.';blockedTone();return;}st.pegs[move.from]=0;st.pegs[move.mid]=0;st.pegs[move.to]=1;st.selected=null;st.moves=(Number(st.moves)||0)+1;renderCampaignPuzzle();});row.appendChild(b);});
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
      const item=document.createElement('span'); item.className='nonogramClueNumber sitelenGlyph';
      item.textContent=mechanismDigit(value); item.title=String(value); clue.appendChild(item);
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
    const note=document.createElement('div'); note.className='cardSortNote'; note.textContent=`swaps: ${Number(st.swaps)||0}`;
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
    const progress=document.createElement('div'); progress.className='calculatorProgress'; progress.textContent=`problem ${Math.min(stage+1,problems.length)} / ${problems.length}`;

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
    const answerLabel=document.createElement('strong'); answerLabel.textContent='calculator';
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
    const progress=document.createElement('div');progress.className='baseMatchProgress';progress.textContent=`choice ${stage+1} / ${rounds.length}`;
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
    (payload.clues||[]).forEach((text,index)=>{const item=document.createElement('div');item.className='ringLockClue';item.textContent=`${index+1}. ${text}`;clues.appendChild(item);});
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
    const replay=document.createElement('button');replay.type='button';replay.className='toneReplay';replay.textContent='Play pattern';
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
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=mechanismDigit(index+1);
      const label=document.createElement('small');label.textContent=`tone ${index+1}`;
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
      const label=document.createElement('span');label.className='pulseLaneLabel sitelenGlyph';label.textContent=mechanismDigit(laneIndex+1);
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
    const note=document.createElement('div');note.className='pulseNote';note.textContent=`moves: ${Number(st.moves)||0} · each arrow shifts this lane and the next lane in opposite directions`;
    wrap.append(board,note);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'All three pulse lanes meet at the gate. Press Try answer to confirm the chamber.':'Line up a pulse from every lane in the vertical gate.');
  }

  function renderSpectrumOrderPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,filters=payload.filters||[];
    const info=new Map(filters.map(x=>[x.id,x]));
    const wrap=document.createElement('div');wrap.className='spectrumWrap';
    const clues=document.createElement('div');clues.className='spectrumClues';
    (payload.clues||[]).forEach((text,index)=>{const row=document.createElement('div');row.className='spectrumClue';row.textContent=`${index+1}. ${text}`;clues.appendChild(row);});
    const row=document.createElement('div');row.className='spectrumFilters';
    (st.order||[]).forEach((id,index)=>{
      const spec=info.get(id)||{id,label:id},btn=document.createElement('button');btn.type='button';
      btn.className=`spectrumFilter spectrumFilter--${id}${Number(st.selected)===index?' selected':''}`;
      const swatch=document.createElement('span');swatch.className='spectrumSwatch';swatch.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=spec.label||id;btn.append(swatch,label);
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
      const row=document.createElement('div');row.className='deductionClue';row.textContent=`${index+1}. ${text}`;clues.appendChild(row);
    });
    const order=document.createElement('div');order.className=rowClass;
    (st.order||tokens).forEach((word,index)=>{
      const btn=document.createElement('button');btn.type='button';btn.className=`deductionToken${Number(st.selected)===index?' selected':''}`;
      const slot=document.createElement('span');slot.className='deductionSlot';slot.textContent=String(index+1);
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
    legend.textContent=`${beamLabels.join(', ')} each have one inlet and one matching outlet. Rotate mirrors / ↔ \\.`;
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
    const wrap=document.createElement('div');wrap.className='truthGateWrap';
    const diagram=document.createElement('div');diagram.className='truthGateDiagram';
    const labels=['G1: A,B','G2: B,C','G3: G1,G2'];
    for(let i=0;i<3;i++){
      const gate=document.createElement('button');gate.type='button';gate.className='truthGateSelect';
      const label=document.createElement('small');label.textContent=labels[i];
      const value=document.createElement('strong');value.textContent=st.gates?.[i]||options[0];
      gate.append(label,value);
      gate.addEventListener('click',()=>{
        const current=options.indexOf(st.gates[i]);st.gates[i]=options[(current+1+options.length)%options.length];renderCampaignPuzzle();
      });
      diagram.appendChild(gate);
    }
    const table=document.createElement('div');table.className='truthTable';
    for(const head of ['A','B','C','Y']){const h=document.createElement('strong');h.textContent=head;table.appendChild(h);}
    rows.forEach(row=>{
      for(const value of [row.a,row.b,row.c,row.y]){
        const cell=document.createElement('span');cell.className='truthBit sitelenGlyph';cell.textContent=mechanismDigit(Number(value));table.appendChild(cell);
      }
    });
    const key=document.createElement('div');key.className='truthGateKey';key.textContent='AND: both · OR: either · XOR: different';
    wrap.append(diagram,table,key);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The circuit matches all eight rows. Press Try answer to confirm the rack.':'Set G1, G2 and G3 so one circuit satisfies every truth-table row.');
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
      const step=document.createElement('span');step.className='exactPathStep';step.textContent=idx!=null?String(idx+1):'';
      const glyph=document.createElement('span');glyph.className='exactPathValue sitelenGlyph';glyph.textContent=mechanismDigit(Number(values?.[y]?.[x])||0);
      btn.append(step,glyph);
      const dist=Math.abs(x-Number(last[0]))+Math.abs(y-Number(last[1])),canMove=dist===1&&idx==null&&path.length<Number(payload.moves)+1;
      btn.disabled=!canMove;
      btn.setAttribute('aria-label',`Cell column ${x+1}, row ${y+1}, value ${values?.[y]?.[x]}`);
      if(canMove)btn.addEventListener('click',()=>{st.path.push([x,y]);st.message='';renderCampaignPuzzle();});
      grid.appendChild(btn);
    }
    const controls=document.createElement('div');controls.className='exactPathControls';
    const undo=document.createElement('button');undo.type='button';undo.textContent='Undo last move';undo.disabled=path.length<=1;undo.addEventListener('click',()=>{if(st.path.length>1)st.path.pop();st.message='';renderCampaignPuzzle();});
    const reset=document.createElement('button');reset.type='button';reset.textContent='Restart route';reset.addEventListener('click',()=>{st.path=[Array.from(payload.start||[0,0])];st.message='';renderCampaignPuzzle();});
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
    const progress=document.createElement('div');progress.className='sphinxProgress';progress.textContent=`memory ${Math.min(stage+1,order.length)} / ${order.length} · mistakes ${Number(st.mistakes)||0}`;
    const text=document.createElement('div');text.className='sphinxRiddle';text.textContent=riddle?.text||'';
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
        lamp.textContent=String(index+1);row.appendChild(lamp);
      });
      return row;
    };
    rows.append(makeRow('safe',target,false),makeRow('route',st.lamps||[],true));
    const levers=document.createElement('div');levers.className='coupledLevers';
    masks.forEach((mask,index)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='coupledLever';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=mechanismDigit(index+1);
      const info=document.createElement('small');info.textContent=`flips ${(mask||[]).map(i=>Number(i)+1).join(' · ')}`;
      btn.append(glyph,info);
      btn.addEventListener('click',()=>{
        st.lamps=Array.from(st.lamps||[]);for(const lampIndex of mask||[])st.lamps[lampIndex]=st.lamps[lampIndex]?0:1;
        st.moves=(Number(st.moves)||0)+1;renderCampaignPuzzle();
      });
      levers.appendChild(btn);
    });
    const note=document.createElement('div');note.className='coupledSwitchNote';note.textContent=`moves: ${Number(st.moves)||0}`;
    wrap.append(rows,levers,note);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,mechanismSolved(puzzle)?'The route pattern is safe. Press Try answer to confirm the shaft control.':'Match every route lamp to the safe pattern.');
  }

  function renderLayerAlignmentPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState,size=Math.max(2,Number(payload.size)||5),layers=payload.layers||[],target=payload.targetMarkers||{};
    const wrap=document.createElement('div');wrap.className='layerAlignWrap';
    const targetBox=document.createElement('div');targetBox.className='layerTargetSummary';
    targetBox.textContent='Targets: '+Object.entries(target).map(([label,pos])=>`${label}→(${Number(pos[0])+1},${Number(pos[1])+1})`).join(' · ');
    const stack=document.createElement('div');stack.className='layerAlignStack';

    layers.forEach((layer,index)=>{
      const unit=document.createElement('div');unit.className='layerAlignUnit';
      const head=document.createElement('div');head.className='layerAlignHead';
      const left=document.createElement('button');left.type='button';left.textContent='↶';left.setAttribute('aria-label',`Rotate ${layer.label||layer.id} floor counter-clockwise`);
      const label=document.createElement('strong');label.textContent=layer.label||layer.id||`floor ${index+1}`;
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
      const rot=document.createElement('small');rot.className='layerRotation';rot.textContent=`quarter-turns: ${Number(st.rotations[index])||0}`;
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
      const detail=document.createElement('div');detail.textContent=item.discount?`${item.price} − ${item.discount} = ${item.final}`:`${item.price}`;
      copy.append(head,detail);headRow.append(glyph,copy);
      const frame=document.createElement('div');frame.className='marketTillCartoucheFrame';
      const c=document.createElement('canvas');c.width=320;c.height=82;c.className='marketTillCanvas';frame.appendChild(c);
      card.append(headRow,frame);cards.appendChild(card);
      renderNanpaSourceToCanvas(item.final||item.price,c,38);
    });
    const targetBox=document.createElement('div');targetBox.className='marketTillTarget';
    const targetLabel=document.createElement('strong');targetLabel.textContent='exact total';
    const targetFrame=document.createElement('div');targetFrame.className='marketTillCartoucheFrame marketTillCartoucheFrame--target';
    const tc=document.createElement('canvas');tc.width=420;tc.height=92;tc.className='marketTillCanvas';targetFrame.appendChild(tc);targetBox.append(targetLabel,targetFrame);renderNanpaSourceToCanvas(centsText(target),tc,42);
    const tokens=document.createElement('div');tokens.className='marketTillTokens';
    (payload.tokens||[]).forEach((cents,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`marketToken${st.selected[index]?' selected':''}`;
      b.textContent=centsText(cents);b.setAttribute('aria-pressed',String(Boolean(st.selected[index])));
      b.addEventListener('click',()=>{st.selected[index]=!st.selected[index];renderCampaignPuzzle();});tokens.appendChild(b);
    });
    const read=document.createElement('div');read.className=`marketTillReadout${sum===target?' exact':''}`;read.textContent=`payment ${centsText(sum)} / ${centsText(target)}`;
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
      b.innerHTML=`<strong>${label}</strong><span>setting ${Number(st.controls[index])||0}</span>`;
      b.addEventListener('click',()=>{st.controls[index]=((Number(st.controls[index])||0)+1)%3;renderCampaignPuzzle();});controls.appendChild(b);
    });
    const gauges=document.createElement('div');gauges.className='coldGauges';
    [['freezer','freezer'],['chilled store','chill'],['gel loop','gel']].forEach(([label,key])=>{
      const ok=Math.abs(Number(readings[key])-Number(want[key]))<1e-9;
      const box=document.createElement('div');box.className=`coldGauge${ok?' matched':''}`;
      const h=document.createElement('strong');h.textContent=label;
      const c=document.createElement('canvas');c.width=230;c.height=62;c.className='coldGaugeCanvas';
      const small=document.createElement('small');small.textContent=`target ${signedOneDecimal(want[key])}`;
      box.append(h,c,small);gauges.appendChild(box);renderNanpaSourceToCanvas(signedOneDecimal(readings[key]),c,34);
    });
    wrap.append(controls,gauges);puzzleSlots.appendChild(wrap);
    setMechanismStatus(puzzle,l10ColdSolved(puzzle,st)?'All three readings are stable. Press Try answer to confirm the cold-chain controller.':'Adjust the coupled controls until all three readings match their targets simultaneously.');
  }

  function renderTextileMixerPuzzle(puzzle){
    const payload=puzzle.ui?.payload||{},st=puzzleMechanismState;
    const wrap=document.createElement('div');wrap.className='textileMixerWrap';
    const formula=document.createElement('div');formula.className='textileFormula';formula.innerHTML=`<span class="sitelenGlyph">${glyphChar('laso')}</span><strong>50%</strong><span>+</span><strong>25% water</strong><span>+</span><strong>25% binder</strong>`;
    const options=document.createElement('div');options.className='textileRatioOptions';
    (payload.options||[]).forEach((values,index)=>{
      const b=document.createElement('button');b.type='button';b.className=`textileRatio${Number(st.selectedIndex)===index?' selected':''}`;b.textContent=values.join(' : ');
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
      const dist=document.createElement('span');dist.className='sitelenGlyph callTriangDistanceGlyph';dist.textContent=mechanismDigit(sensor.distance);dist.setAttribute('aria-hidden','true');
      const latin=document.createElement('span');latin.className='callTriangLatin';latin.textContent=String(sensor.distance);
      const lab=document.createElement('small');lab.textContent='grid steps';
      reading.append(dist,latin,lab);card.append(id,reading);legend.appendChild(card);
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
      const head=document.createElement('strong');head.textContent=`pair ${pair.id}`;card.appendChild(head);
      const traits=document.createElement('div');traits.className='lineageTraits';
      (pair.traits||[]).forEach(word=>{const g=document.createElement('span');g.className='sitelenGlyph';g.textContent=glyphChar(word);g.title=word;traits.appendChild(g);});
      card.appendChild(traits);pairGrid.appendChild(card);
    });
    const evidence=document.createElement('div');evidence.className='lineageEvidence';
    const evidenceHead=document.createElement('strong');evidenceHead.textContent='cross-record observations';evidence.appendChild(evidenceHead);
    const evidenceList=document.createElement('ul');
    constraints.forEach(c=>{const li=document.createElement('li');li.textContent=c.text||'';evidenceList.appendChild(li);});
    const once=document.createElement('li');once.textContent='Every parent pair A–D is used exactly once.';evidenceList.appendChild(once);evidence.appendChild(evidenceList);
    const rows=document.createElement('div');rows.className='lineageRows';
    hatchlings.forEach((h,index)=>{
      const row=document.createElement('div');row.className='lineageRow';
      const info=document.createElement('div');info.className='lineageHatchling';
      const label=document.createElement('strong');label.textContent=`hatchling ${h.id}`;
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
      const label=document.createElement('strong');label.textContent=role.label;head.append(glyph,label);
      const rule=document.createElement('span');rule.textContent=role.rule;card.append(head,rule);brief.appendChild(card);
    });
    const records=document.createElement('div');records.className='habitatRecords';
    stations.forEach(station=>{
      const card=document.createElement('div');card.className='habitatRecord';
      const title=document.createElement('strong');title.textContent=station.label;
      const facts=document.createElement('ul');(station.facts||[]).forEach(f=>{const li=document.createElement('li');li.textContent=f;facts.appendChild(li);});
      card.append(title,facts);records.appendChild(card);
    });
    const selectors=document.createElement('div');selectors.className='habitatSelectors';
    const makeSelector=(key,title)=>{
      const box=document.createElement('div');box.className='habitatSelector';
      const head=document.createElement('div');head.className='habitatSelectorHead';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=glyphChar(key);
      const lab=document.createElement('strong');lab.textContent=title;head.append(glyph,lab);box.appendChild(head);
      const buttons=document.createElement('div');buttons.className='habitatChoiceGrid';
      stations.forEach(station=>{const btn=document.createElement('button');btn.type='button';btn.className=`habitatChoice${st[key]===station.id?' selected':''}`;btn.textContent=station.label;btn.addEventListener('click',()=>{st[key]=station.id;renderCampaignPuzzle();});buttons.appendChild(btn);});
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
    lead.textContent='Final puzzle · every row, column and 3×3 box must contain 1–9 exactly once. Small Latin numerals are accessibility fallbacks; the large symbols are nanpa-linja-n digits.';
    const grid=document.createElement('div');grid.className='sudokuGrid';
    for(let i=0;i<81;i++){
      const r=Math.floor(i/9),c=i%9,given=Boolean(givens[i]),value=Number(cells[i])||0;
      const btn=document.createElement('button');btn.type='button';
      btn.className=`sudokuCell${given?' given':''}${selected===i?' selected':''}${c%3===2&&c<8?' boxRight':''}${r%3===2&&r<8?' boxBottom':''}`;
      btn.setAttribute('aria-label',given?`Row ${r+1}, column ${c+1}, given ${value}`:`Row ${r+1}, column ${c+1}${value?`, value ${value}`:', empty'}`);
      if(value){
        const glyph=document.createElement('span');glyph.className='sudokuGlyph sitelenGlyph';glyph.textContent=mechanismDigit(value);
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
    const mode=document.createElement('button');mode.type='button';mode.className=`sudokuMode${st.noteMode?' active':''}`;mode.textContent=`Notes: ${st.noteMode?'ON':'OFF'}`;mode.addEventListener('click',()=>{st.noteMode=!st.noteMode;renderCampaignPuzzle();});
    const clear=document.createElement('button');clear.type='button';clear.textContent='Clear cell';clear.disabled=selected==null||Boolean(givens[selected]);clear.addEventListener('click',()=>{if(selected==null||givens[selected])return;st.cells[selected]=0;st.notes[selected]=[];renderCampaignPuzzle();});
    controls.append(mode,clear);
    const keypad=document.createElement('div');keypad.className='sudokuKeypad';
    for(let n=1;n<=9;n++){
      const b=document.createElement('button');b.type='button';b.className='sudokuKey';
      const glyph=document.createElement('span');glyph.className='sitelenGlyph';glyph.textContent=mechanismDigit(n);
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
    puzzleTrayWrap.hidden=true; puzzleResetBtn.hidden=false; puzzleCompleteBtn.hidden=false; puzzleCompleteBtn.textContent='Try answer';
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
      case 'call-triangulation': renderCallTriangulationPuzzle(puzzle); break;
      case 'lineage-match': renderLineageMatchPuzzle(puzzle); break;
      case 'habitat-triage': renderHabitatTriagePuzzle(puzzle); break;
      case 'sudoku': renderSudokuPuzzle(puzzle); break;
      case 'pattern-sequence': renderPatternSequencePuzzle(puzzle); break;
    }
    // Submission is deliberately always available for mechanism puzzles. The UI must
    // never reveal a correct configuration merely by enabling or highlighting the button.
    puzzleCompleteBtn.disabled=false;
    puzzleCompleteBtn.textContent='Try answer';
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
    const label = document.createElement('div'); label.className='coordinatePuzzleLabel'; label.textContent='coordinate clue';
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
          puzzleStatus.textContent='Correct. A cache has been revealed in the Lower Archive.';
          successTone();
          const id=puzzle.id, title=puzzle.ui.title||id;
          closeModal(puzzleOverlay); puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism'); activeCampaignPuzzle=null; selectedPuzzleSlotIndex=null;
          const result=completeCampaignPuzzle(id,`Solved ${title}.`);
          if (result.ok) showMessage('A hidden cache has appeared in the Lower Archive. It is marked on the minimap.');
        } else {
          puzzleStatus.textContent=`That is ${x}, ${y}. The coordinate clue points somewhere else.`;
          blockedTone();
        }
      });
      grid.appendChild(cell);
    }
    puzzleSlots.appendChild(grid);
    puzzleStatus.textContent='Tap the cell at the coordinate shown above.';
  }

  function renderCountryPuzzle(puzzle) {
    const answer = String(puzzle.ui?.payload?.answer || '').toUpperCase().replace(/[^AEIJKLMNOPSTUW]/g,'');
    const clueBox=document.createElement('div'); clueBox.className='countryClueBox';
    const tp=document.createElement('div'); tp.className='countryClueTp'; tp.textContent=puzzle.ui?.payload?.clueTp || '';
    const en=document.createElement('div'); en.className='countryClueEn'; en.textContent=puzzle.ui?.payload?.clueEn || '';
    clueBox.append(tp,en); puzzleSlots.appendChild(clueBox);
    if (!Array.isArray(puzzleSlotValues) || puzzleSlotValues.length!==answer.length) puzzleSlotValues=Array(answer.length).fill(null);
    if (selectedPuzzleSlotIndex == null && answer.length && puzzleSlotValues.some(v=>!v)) selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(-1);
    [...answer].forEach((letter,index)=>{
      const slot=document.createElement('button'); slot.type='button'; slot.className=`puzzleSlot fillable ${puzzleSlotValues[index]?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}`; slot.dataset.slotIndex=String(index);
      const glyph=document.createElement('div'); glyph.className=puzzleSlotValues[index]?'puzzleSlotGlyph sitelenGlyph':'puzzleSlotGlyph'; glyph.textContent=puzzleSlotValues[index]?displayPuzzleToken(puzzleSlotValues[index]):'＋';
      const label=document.createElement('div'); label.className='puzzleSlotLabel'; label.textContent=letter;
      slot.append(glyph,label);
      slot.addEventListener('click',()=>activatePuzzleSlot(index));
      puzzleSlots.appendChild(slot);
    });
    renderGlyphFamilyPicker();
    puzzleCompleteBtn.hidden=false; puzzleResetBtn.hidden=false; puzzleTrayWrap.hidden=false;
    puzzleCompleteBtn.disabled=false;
    puzzleCompleteBtn.textContent='Try answer';
    puzzleStatus.textContent='Tap a slot, choose a letter, then tap or drag a glyph. Press Try answer when ready; correctness is checked only after submission.';
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
      const tp=document.createElement('span');tp.textContent=entry.clueTp||'';
      const en=document.createElement('small');en.textContent=entry.clueEn||'';
      clue.append(head,tp,en);clues.appendChild(clue);
    });

    const grid=document.createElement('div');grid.className='countryCrosswordGrid';grid.style.setProperty('--cross-cols',String(model.width));grid.style.setProperty('--cross-rows',String(model.height));
    for(let y=0;y<model.height;y++)for(let x=0;x<model.width;x++){
      const key=`${y},${x}`,cell=model.byKey.get(key);
      if(!cell){const block=document.createElement('div');block.className='countryCrosswordCell block';grid.appendChild(block);continue;}
      const index=cell.slotIndex,value=puzzleSlotValues[index];
      const b=document.createElement('button');b.type='button';b.className=`countryCrosswordCell puzzleSlot fillable ${value?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}`;b.dataset.slotIndex=String(index);
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
    puzzleCompleteBtn.textContent='Try answer';
    puzzleStatus.textContent='Any country name that matches its clue, length and crossings is valid. Press Try answer when ready; correctness is checked only after submission.';
  }

  async function renderNanpaSourceToCanvas(source, target, fontPx=48, parserOverrides={}) {
    const ctxOut=target.getContext('2d',{alpha:true}); ctxOut.clearRect(0,0,target.width,target.height);
    try {
      const renderer=await ensureLevelRenderer();
      const rendered=await renderer.renderTextToNewCanvas({input:String(source),layout:{fontPx,align:'center',spacingPreset:'compact',paddingPx:8},parser:{abbreviateNumericCartouches:true,nanpaColonParsing:true,nanpaColonRendering:true,relaxedNanpaLinjanParsing:true,relaxedNanpaLinjanRendering:true,...parserOverrides}});
      const src=rendered?.canvas; if(!src) throw new Error('no canvas');
      const scale=Math.min((target.width-10)/src.width,(target.height-10)/src.height,1.5); const dw=src.width*scale,dh=src.height*scale;
      ctxOut.drawImage(src,(target.width-dw)/2,(target.height-dh)/2,dw,dh);
    } catch(err) {
      ctxOut.fillStyle='#111';ctxOut.font='16px system-ui';ctxOut.textAlign='center';ctxOut.textBaseline='middle';ctxOut.fillText(String(source),target.width/2,target.height/2);
    }
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
    puzzleEyebrow.textContent = puzzle.type === 'country-cartouche' ? 'country cartouche' : puzzle.type === 'country-crossword' ? 'country crossword' : puzzle.type === 'coordinate-map' ? 'map puzzle' : mechanismPuzzle ? 'mechanism puzzle' : puzzle.type === 'terminal' ? 'campaign terminal' : 'glyph-key puzzle';
    puzzleTitle.textContent = puzzle.ui.title || puzzle.id;
    puzzleInstructions.textContent = puzzle.ui.instructions || '';
    puzzleSlots.textContent = '';
    puzzleTray.textContent = '';
    puzzleStatus.textContent = '';
    puzzleResetBtn.hidden = false;
    puzzleResetBtn.textContent = mechanismPuzzle ? 'Reset' : 'Clear';
    puzzleTrayWrap.hidden = false;
    puzzleCompleteBtn.hidden = false;
    puzzleCompleteBtn.textContent = puzzle.type === 'terminal' ? 'Confirm' : 'Try answer';
    puzzleCloseBtn.hidden = puzzle.ui.canExit === false;
    hidePuzzleLiveCartouchePreview();

    if (puzzle.type === 'coordinate-map') { renderCoordinateMapPuzzle(puzzle); return; }
    if (puzzle.type === 'country-cartouche') { renderCountryPuzzle(puzzle); return; }
    if (puzzle.type === 'country-crossword') { renderCountryCrosswordPuzzle(puzzle); return; }
    if (mechanismPuzzle) { renderMechanismPuzzle(puzzle); return; }

    if (!seq.length) {
      puzzleResetBtn.hidden = true; puzzleTrayWrap.hidden = true;
      const box = document.createElement('div'); box.className = 'puzzleTerminalMessage';
      box.textContent = puzzle.type === 'terminal' ? 'The terminal is ready. Confirm when you are satisfied.' : 'This mechanism is ready.';
      puzzleSlots.appendChild(box); puzzleCompleteBtn.disabled = false; return;
    }

    if (!Array.isArray(puzzleSlotValues) || puzzleSlotValues.length !== seq.length) puzzleSlotValues = Array(seq.length).fill(null);
    const displayedSequence = Array.isArray(puzzle.ui?.payload?.displaySequence) ? puzzle.ui.payload.displaySequence : [];
    if (displayedSequence.length) {
      const source = document.createElement('div'); source.className = 'puzzleSourceSequence';
      const sourceLabel = document.createElement('div'); sourceLabel.className = 'puzzleSourceSequenceLabel'; sourceLabel.textContent = 'cache inscription';
      const sourceGlyphs = document.createElement('div'); sourceGlyphs.className = 'puzzleSourceSequenceGlyphs';
      for (const word of displayedSequence) {
        const glyph = document.createElement('div'); glyph.className = 'puzzleSourceGlyph sitelenGlyph'; glyph.textContent = displayPuzzleToken(word); glyph.title = word; glyph.setAttribute('aria-label', word);
        sourceGlyphs.appendChild(glyph);
      }
      source.append(sourceLabel, sourceGlyphs);
      puzzleSlots.appendChild(source);
    }
    if (selectedPuzzleSlotIndex == null && seq.length && puzzleSlotValues.some(v=>!v)) selectedPuzzleSlotIndex = nextEmptyPuzzleSlotIndex(-1);
    seq.forEach((expected,index)=>{
      const slot=document.createElement('button'); slot.type='button'; slot.className=`puzzleSlot fillable ${puzzleSlotValues[index]?'':'empty'}${selectedPuzzleSlotIndex===index?' selectedTarget':''}`; slot.dataset.slotIndex=String(index); slot.setAttribute('aria-label',`Glyph slot ${index+1}`);
      const glyph=document.createElement('div'); glyph.className=puzzleSlotValues[index]?'puzzleSlotGlyph sitelenGlyph':'puzzleSlotGlyph'; glyph.textContent=puzzleSlotValues[index]?displayPuzzleToken(puzzleSlotValues[index]):'＋';
      const label=document.createElement('div'); label.className='puzzleSlotLabel'; label.textContent=String(index+1);
      slot.append(glyph,label);
      slot.addEventListener('click',()=>activatePuzzleSlot(index));
      puzzleSlots.appendChild(slot);
    });
    renderPuzzleLiveCartouchePreview(puzzle);
    renderGlyphFamilyPicker();
    puzzleCompleteBtn.disabled = false;
    puzzleCompleteBtn.textContent = 'Try answer';
    puzzleStatus.textContent = `Tap a slot, choose a letter, then tap or drag a glyph. Fill all ${seq.length} positions and press Try answer. Correctness is checked only after submission.`;
  }

  function openCampaignPuzzleHost(puzzle) {
    activeCampaignPuzzle = puzzle;
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
    const firstControl = puzzleSlots.querySelector('.puzzleSlot.fillable') || puzzleTray.querySelector('.puzzleFamilyKey');
    (firstControl || puzzleCompleteBtn || puzzleCloseBtn).focus?.({ preventScroll:true });
  }

  function clearCampaignPuzzleSlots() {
    if (!activeCampaignPuzzle) return;
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
      puzzleStatus.textContent = 'Answer incomplete. Fill every required position, then press Try answer.';
      blockedTone();
      return;
    }
    if (isMechanismPuzzle(puzzle) && !mechanismSolved(puzzle)) {
      puzzleStatus.textContent = 'That answer did not work. Review the clues, adjust the mechanism, and try again.';
      blockedTone();
      return;
    }
    if (needsSlots && !validateCampaignPuzzleSlots()) {
      puzzleStatus.textContent = 'That answer did not work. Review the clues and try again.';
      blockedTone();
      return;
    }
    const id = puzzle.id;
    const title = puzzle.ui.title || id;
    closeModal(puzzleOverlay);
    puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism');
    activeCampaignPuzzle = null;
    puzzleMechanismState = null;
    selectedPuzzleSlotIndex = null;
    const result = completeCampaignPuzzle(id, `Earned by completing ${title}.`);
    if (result.ok && !result.awarded?.length) showMessage(`${title} complete.`);
  }

  function closeCampaignPuzzleHost() {
    if (activeCampaignPuzzle?.ui?.canExit === false) return;
    activeCampaignPuzzle = null;
    puzzleSlotValues = [];
    selectedPuzzleGlyph = null;
    selectedPuzzleFamily = null;
    selectedPuzzleSlotIndex = null;
    puzzleCard?.classList.remove('puzzleCard--keys','puzzleCard--map','puzzleCard--mechanism');
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

  function directChoosePuzzleGlyphFromEvent(e) {
    if (!isCoarsePointer()) return;
    const token = e.currentTarget?.dataset?.word;
    if (!token) return;
    choosePuzzleGlyph(token);
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
    collectionCountEl.textContent = `${count} / 120`;
    collectionBtnCountEl.textContent = `${count} / 120`;
    if (collectionLevelProgressEl) collectionLevelProgressEl.textContent = progressSummaryText(progress);
    glyphGrid.textContent = '';
    for (const word of STANDARD_120) {
      const cell = document.createElement('div');
      const has = collected(word);
      cell.className = `glyphCell${has ? '' : ' missing'}`;
      cell.title = has ? word : 'Not yet recovered';
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
      const rendered = await renderer.renderTextToNewCanvas({
        input:String(levelNo),
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
      // Keep the start screen usable if the shared renderer asset is unavailable.
      ctxOut.fillStyle='#111'; ctxOut.textAlign='center'; ctxOut.textBaseline='middle';
      ctxOut.font=`64px "${NASIN_NANPA_FONT}"`;
      const digitWord = levelNo === 1 ? 'wan' : levelNo === 2 ? 'tu' : levelNo === 3 ? 'seli' : levelNo === 4 ? 'awen' : levelNo === 5 ? 'luka' : levelNo === 6 ? 'utala' : levelNo === 7 ? 'mun' : levelNo === 8 ? 'pipi' : levelNo === 9 ? 'jo' : null;
      const fallback = levelNo===10 ? `${glyphChar('nanpa')} : ${glyphChar('wan')} ${glyphChar('ijo')} ${glyphChar('nanpa')}` : levelNo===11 ? `${glyphChar('nanpa')} : ${glyphChar('wan')} ${glyphChar('wan')} ${glyphChar('nanpa')}` : levelNo===12 ? `${glyphChar('nanpa')} : ${glyphChar('wan')} ${glyphChar('tu')} ${glyphChar('nanpa')}` : digitWord ? `${glyphChar('nanpa')} : ${glyphChar(digitWord)} ${glyphChar('nanpa')}` : String(levelNo);
      ctxOut.fillText(fallback,canvasOut.width/2,canvasOut.height/2);
      console.warn('[game] level cartouche renderer unavailable', err);
    }
  }

  function showLevelIntro() {
    if (!levelIntroOverlay || !campaignAdapter) return;
    const def = campaignAdapter.currentLevel();
    const levelNo = def?.ordinal || level().chapter;
    levelIntroTitle.textContent = `Level ${levelNo}`;
    levelIntroHint.textContent = 'Tap anywhere to start · Enter/Space also starts';
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
    canvas.focus();
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
      if (levelCompleteEyebrow) levelCompleteEyebrow.textContent = 'campaign complete';
      levelCompleteTitle.textContent = 'Congratulations!';
      levelCompleteText.textContent = `You recovered all ${STANDARD_120.length} canonical glyphs and completed the full ${campaignAdapter?.runtime?.campaign?.levels?.length || levelNo}-level campaign.`;
      levelCompleteCount.textContent = `${collectionCount()} / ${STANDARD_120.length} glyphs recovered · full campaign complete`;
      stayLevelBtn.textContent = 'Keep exploring';
    } else {
      if (levelCompleteEyebrow) levelCompleteEyebrow.textContent = 'level complete';
      levelCompleteTitle.textContent = `Level ${levelNo} complete`;
      levelCompleteText.textContent = `All ${progress.requiredTotal} required Level ${levelNo} glyphs and mandatory objectives are complete. Continue to Level ${next.ordinal}.`;
      levelCompleteCount.textContent = progressSummaryText(progress);
      stayLevelBtn.textContent = 'Stay here';
    }
    continueLevelBtn.textContent = next ? `Continue to Level ${next.ordinal}` : 'Continue';
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

  function update(dt) {
    if (modalOpen) {
      currentTarget = null; promptEl.textContent = ''; updateHUD(); return;
    }

    const mapSteering = updateMapSteering(dt);
    if (!mapSteering) {
      let turn = 0;
      if (keys.ArrowLeft) turn -= 1;
      if (keys.ArrowRight) turn += 1;
      if (mobileMove.turnLeft) turn -= mobileMove.turnStrength;
      if (mobileMove.turnRight) turn += mobileMove.turnStrength;
      state.angle = normalizeAngle(state.angle + turn * ROTATE_SPEED * dt);

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
        if (coarse) {
          // Preserve the joystick's deliberate high-rim boost. Desktop movement
          // still normalizes diagonals, but mobile forward/back may exceed 1.0
          // only near the outer rim for faster traversal.
          forward = Math.max(-MOBILE_JOYSTICK_MOVE_MAX, Math.min(MOBILE_JOYSTICK_MOVE_MAX, forward));
          strafe = Math.max(-1, Math.min(1, strafe));
        } else {
          const len = Math.max(1, Math.hypot(forward, strafe));
          forward /= len; strafe /= len;
        }
        const cos = Math.cos(state.angle), sin = Math.sin(state.angle);
        const ms = coarse ? MOBILE_MOVE_SPEED : MOVE_SPEED;
        const ss = coarse ? MOBILE_STRAFE_SPEED : STRAFE_SPEED;
        const dx = (cos * forward * ms + -sin * strafe * ss) * dt;
        const dy = (sin * forward * ms + cos * strafe * ss) * dt;
        movePlayer(dx, dy);
      }
    }

    currentTarget = findInteractionTarget();
    promptEl.textContent = interactionText(currentTarget);
    updateHUD();
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now; update(dt); renderScene(); requestAnimationFrame(frame);
  }

  function showMessage(text) {
    clearTimeout(messageTimer); messageEl.textContent = text; messageEl.classList.add('show');
    messageTimer = setTimeout(() => messageEl.classList.remove('show'), 3200);
  }

  function log(text) {
    const item = { t: Date.now(), text };
    state.log.unshift(item); state.log = state.log.slice(0, 40); renderLog(); saveState();
  }

  function renderLog() {
    fieldLogEl.textContent = '';
    if (!state.log.length) { const d = document.createElement('div'); d.textContent = 'No field notes yet.'; fieldLogEl.appendChild(d); return; }
    for (const entry of state.log) { const d = document.createElement('div'); d.className = 'fieldLogEntry'; d.textContent = entry.text; fieldLogEl.appendChild(d); }
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
    resetConfirmProgress.textContent = `${collectionCount()} / ${STANDARD_120.length} glyphs recovered`;
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
    const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    const sectors = ['N','NE','E','SE','S','SW','W','NW'];
    return sectors[Math.floor((degrees + 22.5) / 45) % 8];
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

  function resetMobileJoystickVisual() {
    setMobileJoystickIntent('idle');
    if (mobileMovePad) { mobileMovePad.dataset.sector = 'idle'; mobileMovePad.style.setProperty('--joystick-strength', '0'); }
    if (mobileJoystickThumb) {
      mobileJoystickThumb.style.left = '50%';
      mobileJoystickThumb.style.top = '50%';
    }
  }

  function updateMobileJoystickFromPointer(e) {
    if (!mobileMovePad) return;
    const rect = mobileMovePad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const outerRadius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const deadRadius = outerRadius * MOBILE_JOYSTICK_DEAD_RATIO;
    const intent = mobileJoystickIntent(dx, dy, deadRadius);
    const strength = mobileJoystickStrength(Math.hypot(dx, dy), deadRadius, outerRadius);
    setMobileJoystickIntent(intent, strength.move, strength.turn);
    mobileMovePad.dataset.sector = intent;
    mobileMovePad.style.setProperty('--joystick-strength', Math.min(1, strength.move).toFixed(3));
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

  function mapSteerCellWalkable(x, y) {
    const map = level().map;
    if (y < 0 || y >= map.length || x < 0 || x >= map[y].length) return false;
    const explored = state.explored[state.levelId] || {};
    const isCurrent = x === Math.floor(state.x) && y === Math.floor(state.y);
    if (!isCurrent && !explored[`${x},${y}`]) return false;
    const c = map[y][x];
    if (c === '#') return false;
    if (c === 'D' || c === 'P') {
      const door = doorAtCell(x, y);
      if (!door?.open) return false;
    }
    return canOccupy(x + 0.5, y + 0.5);
  }

  function mapSteerPathTo(targetX, targetY) {
    const sx = Math.floor(state.x), sy = Math.floor(state.y);
    if (!mapSteerCellWalkable(targetX, targetY)) return [];
    const key = (x,y) => `${x},${y}`;
    const startKey = key(sx,sy), targetKey = key(targetX,targetY);
    if (startKey === targetKey) return [{x:targetX + 0.5, y:targetY + 0.5}];
    const queue = [[sx,sy]], prev = new Map([[startKey,null]]);
    for (let i=0; i<queue.length; i+=1) {
      const [x,y] = queue[i];
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        const k = key(nx,ny);
        if (prev.has(k) || !mapSteerCellWalkable(nx,ny)) continue;
        prev.set(k,key(x,y));
        if (k === targetKey) {
          const cells = [[nx,ny]];
          let cursor = key(x,y);
          while (cursor && cursor !== startKey) {
            const [cx,cy] = cursor.split(',').map(Number);
            cells.push([cx,cy]);
            cursor = prev.get(cursor);
          }
          cells.reverse();
          return cells.map(([cx,cy]) => ({x:cx+0.5,y:cy+0.5}));
        }
        queue.push([nx,ny]);
      }
    }
    return [];
  }

  function mapSteerCellFromPointer(e) {
    if (!miniMap || !state.mapVisible) return null;
    const rect = miniMap.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (e.clientX - rect.left) * (miniMap.width / rect.width);
    const py = (e.clientY - rect.top) * (miniMap.height / rect.height);
    const {map,cell,ox,oy} = miniMapGeometry();
    const x = Math.floor((px - ox) / cell), y = Math.floor((py - oy) / cell);
    if (y < 0 || y >= map.length || x < 0 || x >= map[y].length) return null;
    return {x,y};
  }

  function retargetMapSteering(e) {
    const cell = mapSteerCellFromPointer(e);
    if (!cell || !mapSteerCellWalkable(cell.x,cell.y)) {
      mobileMapSteer.targetCell = null;
      mobileMapSteer.path = [];
      mobileMapSteer.pathIndex = 0;
      miniMap.classList.remove('isSteering');
      return false;
    }
    const path = mapSteerPathTo(cell.x,cell.y);
    if (!path.length) {
      mobileMapSteer.targetCell = null;
      mobileMapSteer.path = [];
      mobileMapSteer.pathIndex = 0;
      miniMap.classList.remove('isSteering');
      return false;
    }
    mobileMapSteer.levelId = state.levelId;
    mobileMapSteer.targetCell = cell;
    mobileMapSteer.path = path;
    mobileMapSteer.pathIndex = 0;
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
    mobileMapSteer.path = [];
    mobileMapSteer.pathIndex = 0;
    miniMap?.classList.remove('isSteering');
  }

  function updateMapSteering(dt) {
    if (!mobileMapSteer.active || mobileMapSteer.levelId !== state.levelId || !mobileMapSteer.path.length) return false;
    while (mobileMapSteer.pathIndex < mobileMapSteer.path.length) {
      const waypoint = mobileMapSteer.path[mobileMapSteer.pathIndex];
      const dx = waypoint.x - state.x, dy = waypoint.y - state.y;
      if (Math.hypot(dx,dy) > 0.11) break;
      mobileMapSteer.pathIndex += 1;
    }
    if (mobileMapSteer.pathIndex >= mobileMapSteer.path.length) return true;
    const waypoint = mobileMapSteer.path[mobileMapSteer.pathIndex];
    const dx = waypoint.x - state.x, dy = waypoint.y - state.y;
    const dist = Math.max(0.0001,Math.hypot(dx,dy));
    const desired = Math.atan2(dy,dx);
    const diff = normalizeAngle(desired - state.angle);
    const maxTurn = ROTATE_SPEED * 1.15 * dt;
    state.angle = normalizeAngle(state.angle + Math.max(-maxTurn,Math.min(maxTurn,diff)));
    const facing = Math.max(0,Math.cos(Math.min(Math.PI/2,Math.abs(diff))));
    if (facing > 0.15) {
      const step = Math.min(dist, MOBILE_MOVE_SPEED * (0.30 + 0.70*facing) * dt);
      movePlayer((dx/dist)*step,(dy/dist)*step);
    }
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
    if (e.target.closest?.('.mobileMovePad, .mobileUseBtn, .mazeQuickExitBtn, .campaignContinueBtn, #miniMap')) return;
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
    if (puzzle) openCampaignPuzzleHost(puzzle);
  });
  levelIntroStartBtn?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); startLevelFromIntro(); });
  levelIntroOverlay?.addEventListener('pointerup', (e) => { if (e.target === levelIntroStartBtn) return; e.preventDefault(); startLevelFromIntro(); }, {passive:false});
  continueLevelBtn.addEventListener('click', goToNextCampaignLevel);
  stayLevelBtn.addEventListener('click', () => closeModal(levelCompleteOverlay));
  resetConfirmCancelBtn?.addEventListener('click', () => closeModal(resetConfirmOverlay));
  resetConfirmStartBtn?.addEventListener('click', (e) => { e.preventDefault(); resetGame(); });

  async function init() {
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
    markCellExplored(Math.floor(state.x), Math.floor(state.y));

    if (document.fonts?.load) {
      try {
        await document.fonts.load(`48px "${NASIN_NANPA_FONT}"`, glyphChar('pona'));
        await document.fonts.ready;
        spriteCache.clear();
      } catch (_) {}
    }

    renderLog(); renderCollection(); updateHUD(); bindMobileControls(); bindMiniMapSteering();
    const restored = saved && saved.version === SAVE_VERSION;
    const restoredLevelNo = campaignAdapter.currentLevel()?.ordinal || state.chapter;
    if (campaignAdapter.isLevelComplete() && campaignAdapter.nextLevel?.()) {
      showMessage(`Level ${restoredLevelNo} complete. Use Continue to Level ${campaignAdapter.nextLevel().ordinal}.`);
    } else if (campaignAdapter.isLevelComplete() && !campaignAdapter.nextLevel?.()) {
      showMessage('Campaign complete: 120 / 120 glyphs recovered.');
      window.setTimeout(() => { if (!modalOpen) openLevelComplete(); }, 120);
    } else if (recoveredTestReset) {
      showMessage(`Testing reset restored: Level ${restoredLevelNo} is back at its exact start.`);
    } else {
      showMessage(restored ? `Saved Level ${restoredLevelNo} progress restored from IndexedDB.` : 'Campaign ready.');
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
