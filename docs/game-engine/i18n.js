(() => {
  'use strict';

  const STORAGE_KEY = 'toki-pona-rooms-language';
  const LANG_TP = 'tp';
  const LANG_EN = 'en';

  const UI = {
    pageTitle: { en: 'Toki Pona rooms — complete 12-level campaign', tp: 'musi tomo — nasin musi 12' },
    skipToGame: { en: 'Skip to game', tp: 'o tawa musi' },
    home: { en: 'Home', tp: 'tomo open' },
    intro: {
      en: 'Explore twelve first-person levels and recover all 120 glyphs by solving spatial, logic, number, word and mechanism puzzles. Your progress is saved automatically.',
      tp: 'o tawa lon ma musi 12. o alasa e sitelen pona 120 kepeken musi ma, musi sona, musi nanpa, musi nimi, en musi ilo. musi li awen e tawa sina.'
    },
    gameAria: { en: 'First-person room explorer', tp: 'musi tomo pi lukin jan' },
    hudLocalInstruction: { en: 'local instruction', tp: 'nasin lon ni' },
    hudCurrentObjective: { en: 'current objective', tp: 'wile lon tenpo ni' },
    controlsTitle: { en: 'Controls and progress', tp: 'ilo tawa en kama pona' },
    mouseHint: { en: 'click view for mouse look · center drag turns · hold/drag near top or bottom moves · Esc releases', tp: 'o luka e lukin la ilo tawa li lawa e lukin · o tawa e luka lon insa la lukin li sike · o awen e luka lon sewi anu anpa la jan li tawa · [[Esc]] li weka e lawa pi ilo tawa' },
    glyphCollection: { en: 'Glyph collection', tp: 'kulupu sitelen' },
    soundOn: { en: 'Sound on', tp: 'kalama lon' },
    soundOff: { en: 'Sound off', tp: 'kalama ala' },
    mapOn: { en: 'Map on', tp: 'sitelen ma lon' },
    mapOff: { en: 'Map off', tp: 'sitelen ma ala' },
    newGame: { en: 'New game', tp: 'musi sin' },
    controlsLegend: {
      en: 'W/S move · A/D strafe · ←/→ turn · E interact · G glyph collection · M map · X leave solved maze · mobile: use the circular joystick by quadrant: up moves forward, down moves backward, left/right rotate in place, and sideways drag within up/down steers; touch/hold the map to face and move that way; center-drag the main view to turn; hold/drag near the top or bottom to move; USE interacts.',
      tp: '[[W/S]] li tawa · [[A/D]] li tawa poka · [[←/→]] li sike · [[E]] li kepeken · [[G]] li open e kulupu sitelen · [[M]] li open e sitelen ma · [[X]] li tawa weka tan nasin nasa pini · ilo luka: ilo sike tawa la poka sewi li tawa sinpin; poka anpa li tawa monsi; poka loje en poka laso li sike taso; luka li tawa poka lon poka sewi anu poka anpa la jan li tawa li sike; o luka e sitelen ma la jan li lukin li tawa lon nasin ni; o tawa e luka lon insa lukin la jan li sike; o luka lon sewi anu anpa la jan li tawa; [[USE]] li kepeken.'
    },
    glyphHelp: {
      en: 'Only the original 120 glyphs are collectible. Common Sitelen Pona 2026 glyphs outside that 120, plus standard punctuation/support symbols, are available from the start. Full-screen glyph puzzles use the shared letter-family picker. Choose a Toki Pona letter to see every available glyph in that family; punctuation/support symbols have their own key. Tap-first interaction is mobile-safe and glyphs remain reusable.',
      tp: 'sitelen pona 120 taso li ken kama lon kulupu sina. sitelen ante pi nasin 2026 en sitelen pi toki ala li lon tan open. lon musi poki sitelen la o anu e sitelen kalama wan. ni la sitelen jo ale li kama lon kulupu ona. sina ken kepeken sitelen sama lon tenpo mute. luka wan li pana e sitelen wan taso.'
    },
    reference: { en: 'Reference:', tp: 'lipu sona:' },
    cheatSheet: { en: 'nanpa-linja-n PDF cheat sheet', tp: 'lipu [[PDF]] pi [[nanpa-linja-n]]' },
    fieldNotes: { en: 'Field notes', tp: 'lipu sona tawa' },
    level: { en: 'level', tp: 'ma musi' },
    tapStart: { en: 'Tap anywhere to start.', tp: 'o luka e ma la musi li open.' },
    start: { en: 'Start', tp: 'o open' },
    glyphRecovered: { en: 'glyph recovered', tp: 'sitelen li kama' },
    continue: { en: 'Continue', tp: 'o tawa' },
    gameQuest: { en: 'game quest', tp: 'wile musi' },
    close: { en: 'Close', tp: 'o pini' },
    collectionHelp: { en: 'Collected glyphs use the nasin nanpa font. Missing positions stay concealed.', tp: 'sitelen kama li kepeken nasin nanpa. sitelen pi kama ala li awen len.' },
    glyphInscription: { en: 'glyph inscription', tp: 'sitelen nimi' },
    incompleteSentence: { en: 'Incomplete sentence', tp: 'toki li pini ala' },
    completeSentence: { en: 'Complete sentence', tp: 'o pini e toki' },
    leaveInscription: { en: 'Leave inscription', tp: 'o tawa weka' },
    glyphKeyPuzzle: { en: 'glyph-key puzzle', tp: 'musi sitelen' },
    puzzle: { en: 'Puzzle', tp: 'musi sona' },
    currentCartouche: { en: 'current sitelen cartouche', tp: 'poki sitelen lon tenpo ni' },
    availableGlyphKeys: { en: 'available glyph keys', tp: 'sitelen ken' },
    clear: { en: 'Clear', tp: 'o weka' },
    tryAnswer: { en: 'Try answer', tp: 'o alasa' },
    leavePuzzle: { en: 'Leave puzzle', tp: 'o tawa weka' },
    levelCompleteEyebrow: { en: 'level complete', tp: 'ma musi li pini' },
    levelComplete: { en: 'Level complete', tp: 'ma musi li pini' },
    levelObjectivesComplete: { en: 'The level objectives are complete.', tp: 'wile ale pi ma musi ni li pini.' },
    campaignComplete: { en: '🎉 Congratulations — all 120 glyphs recovered! 🎉', tp: '🎉 pona mute! sitelen pona 120 ale li kama! 🎉' },
    glyphsRecovered: { en: 'glyphs recovered', tp: 'sitelen li kama' },
    stayHere: { en: 'Stay here', tp: 'o awen lon ni' },
    replayCelebration: { en: 'Replay celebration', tp: 'o musi pona sin' },
    confirmNewGame: { en: 'confirm new game', tp: 'o sona e musi sin' },
    startNewGameQ: { en: 'Start a new game?', tp: 'sina wile open e musi sin anu seme?' },
    resetWarning: { en: 'Current saved progress will be erased and replaced with a fresh campaign start.', tp: 'musi awen lon tenpo ni li weka. musi sin li open tan open.' },
    cancel: { en: 'Cancel', tp: 'o weka' },
    yesNewGame: { en: 'Yes, start new game', tp: 'lon. o open e musi sin' },
    languageLabel: { en: 'Language', tp: 'toki' },
    use: { en: 'USE', tp: 'KEPEKEN' },
    leaveMaze: { en: 'Leave maze', tp: 'o tawa weka' },
    noFieldNotes: { en: 'No field notes yet.', tp: 'lipu sona li lon ala.' },
    loadingCampaign: { en: 'Loading campaign…', tp: 'musi li kama…' },
    carrying: { en: 'carrying', tp: 'sina jo e' },
    cart: { en: 'cart', tp: 'ilo tawa' },
    required: { en: 'required', tp: 'wile' },
    bonus: { en: 'bonus', tp: 'namako' },
    total: { en: 'total', tp: 'ale' }
  };

  const PUZZLES = {
    'l1-intro-o': { title:'o alasa e [[o]]' },
    'l1-intro-e': { title:'o alasa e [[e]]' },
    'l1-ball-table': { title:'[[o pana e sike lon supa]]', instructions:'o pana e sike lon supa. ni la ilo li pana e sitelen nanpa tu.' },
    'l1-maze-seli': { title:'sitelen nasin 1' },
    'l1-maze-awen': { title:'sitelen nasin 2' },
    'l1-maze-luka': { title:'sitelen nasin 3' },
    'l1-maze-code': { title:'nanpa pi kama weka tan nasin nasa', instructions:'sitelen nasin tu wan li pana e nasin. o pali e linja 1 → 3 → 2.' },
    'l1-upper-number': { title:'poki nanpa open', instructions:'o pali e poki nanpa lili tawa 123. sitelen [[nanpa]] li ken kepeken sin lon poki sama.' },
    'l1-maintenance-sequence': { title:'linja wawa', instructions:'o ante e linja sitelen nanpa luka: 5 → 4 → 3 → 2 → 1.' },
    'l1-inner-signed-number': { title:'tomo nanpa len', instructions:'o pali e poki nanpa pi nasin lili tawa −4.5.' },
    'l1-terminal': { title:'ilo sona pi ma musi 1', instructions:'ilo ni li namako. sina ken pini e ma musi 1 kepeken ilo ni ala.' },

    'l2-digit-order': { title:'sitelen nanpa pini', instructions:'o pana e sitelen nanpa luka pi ma musi 1 lon nasin tan lili tawa suli. ilo li pana e sitelen nanpa pini tu.' },
    'l2-country-kana': { title:'[[ma seme?]]', instructions:'o sona e ma. o sitelen e nimi Toki Pona ona. poki ale li wile e sitelen jo wan. nimi pi sitelen ni o open kepeken sitelen kalama wile.' },
    'l2-archive-sequence': { title:'linja pi tomo lipu', instructions:'sona ni li lon: 0 → 1 → 2 → 6. o pali e linja sitelen tu tu.' },
    'l2-workshop-stones': { title:'nanpa kiwen', instructions:'lipu lili li pana e linja ni: [[MA]] → 1 → 2 → 4. o pana e linja sama tawa ilo. ni la sitelen kiwen li kama.' },
    'l2-map-cache': { title:'sitelen ma nanpa', objective:'o pini e musi sitelen ma lon tomo sitelen ma.', instructions:'poki nanpa [[ma]] li pana e lon ma. o luka e poki ma lon lon sama.' },
    'l2-hidden-cache': { title:'poki len li open', objective:'o tawa sin tawa tomo lipu anpa. o lukin e poki sin.', instructions:'poki li pana e sitelen pona tu wan. o pana e sitelen sama lon nasin sama.' },
    'l2-thousands': { title:'kulupu nanpa suli', instructions:'o pana e 1 → 2 → 3 → 4 lon nasin. pini la sitelen [[kulupu]] li kama. lon poki nanpa lili la [[kulupu]] li sitelen e poka kipisi lon kulupu nanpa suli.' },
    'l2-scientific': { title:'tomo sona nanpa', instructions:'ilo li pana e 1.53. o pali e poki nanpa lili sama. pona la sitelen pi nasin nanpa [[neko]] li kama.' },
    'l2-full-form-bridge': { title:'sitelen suli pi kulupu nanpa', instructions:'lon nasin sitelen suli la kipisi kulupu nanpa li [[NEKE]]. lon nasin sitelen lili la ona li [[kulupu]]. o pali e sitelen pona tu tu pi [[NEKE]].' },
    'l2-vault-terminal': { title:'open li pini', instructions:'ilo ni li namako. ma musi li pini lon tenpo ni: sitelen wile ale en wile ma ale li pona.' },

    'l3-clock-alignment': { title:'tenpo sike tu wan', instructions:'o ante e sike tenpo tu wan. sona tu wan ale o lon lon tenpo sama. sike ale li ken ante ona taso.' },
    'l3-relay-routing': { title:'nasin wawa', instructions:'o sike e kipisi nasin. linja wawa wan o tawa tan poka loje tawa poka laso.' },
    'l3-path-circuit': { title:'nasin ma ilo', instructions:'o tawa e sitelen tawa lon [[A]], [[B]], [[C]] lon nasin ni. ni la o tawa tawa pini. poki pimeja li ken ala.' },
    'l3-lights-pattern': { title:'suno ilo lukin', instructions:'o pana e wawa tawa suno ilo 9 ale. sina luka e suno wan la suno poka ona li ante kin.' },
    'l3-balance-machine': { title:'ilo suli sama', instructions:'o anu e kiwen tan kiwen tu tu. suli pi kiwen anu ale o sama e suli wile. kiwen wan li ken kepeken tenpo wan taso.' },
    'l3-context-match': { title:'ilo pi tenpo sama', instructions:'sitelen sewi li tenpo 03:09. o anu e poki nanpa ni taso: ona li tenpo, li suno ala, li nanpa ante ala.' },

    'l4-jug-transfer': { title:'telo suli 4', instructions:'o pana e telo suli 4 taso. sina jo e poki suli 3 e poki suli 5. sina ken pana e telo lon poki, weka e telo, anu pana e telo tan poki wan tawa poki ante.' },
    'l4-hanoi-stack': { title:'kiwen lon palisa', instructions:'o tawa e kiwen sike tu wan tan palisa poka loje tawa palisa poka laso. tenpo wan la o tawa e kiwen wan. kiwen suli li ken ala lon sewi kiwen lili.' },
    'l4-codebreaker': { title:'o alasa e linja len', instructions:'o alasa e linja sitelen tu tu. sina pana e linja tawa ilo la ilo li pana e nanpa tu: sitelen seme li lon ma sama, sitelen seme li pona taso li lon ma ante. lon musi sin la sitelen jo tu tu li ante.' },
    'l4-equivalence': { title:'nanpa sama', instructions:'lon linja ale la kipisi {{(}}1/2{{)}}, nanpa pi sitelen . {{(}}0.5{{)}}, en nanpa % {{(}}50%{{)}} o sama. o luka e lipu tu lon kulupu sama la ona li ante ma.' },
    'l4-schedule-order': { title:'lipu tenpo', instructions:'o pana e pali tu tu lon nasin tenpo tan open tawa pini. o lukin e poki [[suno]] e poki [[tenpo]].' },

    'l5-river-crossing': { title:'tawa lon telo', instructions:'o tawa e [[jan]], [[pan]], [[waso]], [[soweli]] tawa poka ante. o tawa e tomo telo sewi anu anpa tawa ijo. o pana e ijo lon tomo anu tan tomo. tomo li jo e [[jan]] en jan ante wan taso. [[jan]] li weka la [[pan]] en [[waso]] li ken ala awen sama; [[waso]] en [[soweli]] li ken ala awen sama.' },
    'l5-sokoban-freight': { title:'tomo poki tawa', instructions:'o pana e poki tu tawa ma sitelen tu. sina ken tawa e poki kepeken pana taso. sina ken ala tawa e poki kepeken kama jo tan sinpin ona.' },
    'l5-sliding-grid': { title:'sitelen nanpa tawa', instructions:'o pona e sitelen nanpa 3 × 3. o luka e kipisi poka pi ma weka la kipisi li tawa.' },
    'l5-peg-line': { title:'linja kiwen lili', instructions:'pini la kiwen lili wan taso o awen. kiwen wan li tawa lon sewi kiwen poka wan tawa lupa weka; kiwen lon insa li weka.' },
    'l5-pantry-nonogram': { title:'sitelen poki moku', instructions:'o pali sin e sitelen 6 × 6. nanpa poka en nanpa sewi li toki e suli pi kulupu ma pimeja lon nasin sama.' },

    'l6-card-order': { title:'lipu musi lon nasin', instructions:'o pana e lipu luka lon nasin nanpa tan lili tawa suli. o luka e lipu wan. o luka e lipu ante la lipu tu li ante ma. sitelen nanpa taso li suli; kule lipu li suli ala.' },
    'l6-calculator': { title:'ilo nanpa', instructions:'o pini e pali nanpa tu wan ale. o pana e pali tawa ilo. o luka e [[Enter]]. nanpa li kama lon poki [[nanpa-linja-n]]. [[en]] li toki e pana; [[lape]] li toki e weka.' },
    'l6-country-crossword': { title:'nimi ma lon linja', instructions:'o sona e ma tu tu. o sitelen e nimi Toki Pona ona lon linja. poki ale li wile e sitelen jo wan; nimi pi sitelen ni o open kepeken sitelen kalama wile. lon ma pi linja tu la sitelen wan taso o pona tawa tu.' },
    'l6-base-match': { title:'nasin nanpa ante', instructions:'nanpa pi nasin 10 tu wan li lon. tawa nanpa ale la o anu e poki [[Noka]] anu [[Nasa]] li sama tawa ona. sina anu e poki wan lon tenpo wan. pini la ilo li toki e pona anu ike. ike la kulupu nanpa sin li kama.' },
    'l6-position-rings': { title:'sike ma', instructions:'o sike e sitelen tu tu. sona tu tu ale o lon. sike wan li jo e ma 8; tawa sike → li tawa ma wan.' },

    'l7-tone-sequence': { title:'kalama awen', instructions:'o kute e linja kalama luka. ni la o pana sin e linja sama lon supa kalama tu tu. suno lili li pana kin e nasin lukin.' },
    'l7-airflow-network': { title:'nasin kon', instructions:'o sike e nasin kon. [[kon]] o tawa tan lupa poka loje tawa lupa poka laso tu lon tenpo sama.' },
    'l7-pulse-sync': { title:'linja wawa lon tenpo sama', instructions:'o tawa e linja wawa tu wan. lon linja ale la wawa wan o lon ma sitelen. sina ante e linja wan la linja kama li tawa ma wan lon nasin ante.' },
    'l7-spectrum-order': { title:'kule lon nasin', instructions:'o pana e ilo kule luka lon nasin. sona ale o lon. o luka e ilo wan e ilo ante la ona li ante ma.' },
    'l7-power-balance': { title:'ilo wawa pimeja', instructions:'o pana e wawa suli sama tawa nanpa wile. o open anu pini e ilo wawa; nanpa poki ale pi ilo open o kama nanpa wile.' },

    'l8-deduction-order': { title:'tomo sona nasin', instructions:'o kepeken sona 7 ale. linja sitelen wan taso li ken pona. o luka e sitelen tu la ona li ante ma.' },
    'l8-dual-mirror': { title:'ilo lukin tu', instructions:'o sike e ilo lukin 7. linja suno tu o kama lon lupa ona lon tenpo sama. nasin pona li kepeken ilo lukin ale.' },
    'l8-truth-gates': { title:'lupa sona', instructions:'o anu e [[AND]], [[OR]], anu [[XOR]] tawa lupa tu wan. lon linja sona 8 ale la pini ilo o sama e pini wile.' },
    'l8-dependency-schedule': { title:'nasin pali', instructions:'o pana e pali 7 lon nasin tan open tawa pini. sona ale pi kama open en kama pini o lon lon tenpo sama.' },
    'l8-transit-vault': { title:'tomo nasin nanpa', instructions:'o open lon sewi poka loje, o tawa tawa anpa poka laso kepeken tawa 8 taso. o tawa lon poki sama ala. nanpa pi poki 9 ale lon nasin o kama nanpa wile.' },

    'l9-maze-survey': { title:'alasa lon nasin nasa', instructions:'o alasa e sitelen ma tu wan lon pini nasin weka. o kepeken e ona. sina kama poka la [[E/USE]] li lon, lon tenpo ni kin: sitelen li lon monsi lukin sina. jan [[Sphinx]] li toki taso lon tenpo pi sitelen tu wan pini.' },
    'l9-sphinx-riddles': { title:'wile sona pi jan [[Sphinx]]', instructions:'jan [[Sphinx]] li anu e wile sona tu wan tan ma musi 1–8. lon musi sin la wile sona en nasin pi pana sona li ante. o pana e sona pona tawa wile sona tu wan lon tawa wan. sina pakala lon wan la sina kama sin tawa wile sona nanpa 1.' },
    'l9-counterweight': { title:'kiwen awen', instructions:'o tawa e ijo tu wan lon ma sewi en ma anpa. o pana e ijo ale tawa supa ona kepeken sona supa. sina ken jo e ijo wan taso. sina ken kama jo sin e ijo lon supa.' },
    'l9-route-polarity': { title:'nasin suno luka', instructions:'o pona e suno nasin 6 tawa sitelen pona. palisa wan li ante e suno tu wan. sina pona e nasin wan la nasin ante li ken pakala. pona la lupa anpa sin li kama lon ma sewi.' },
    'l9-layer-alignment': { title:'ma tu wan lon linja', instructions:'o sike e sitelen ma tu wan. lon ma ale la lupa [[A]], [[B]], [[C]] o lon lon sama sitelen. ma ale li sike ona taso kepeken sike 1/4.' },

    'l10-market-till': { title:'lipu pana pi esun', objective:'o nanpa e pana tu wan lon nasin %. o pali e poki nanpa lili tu wan.', instructions:'poki tawa 16 li sama. poki wan li 1/16 pi pana ale. tomo [[pan]] li kama jo e poki 5. tomo [[suwi]] li kama jo e poki 7. poki awen li kama jo e poki 4. o nanpa e suli % pi pana tu wan. o pali e poki nanpa lili tu wan pi nanpa %.' },
    'l10-delivery-routing': { title:'lipu tawa poki', objective:'o kepeken ilo tawa wawa. o tawa e poki tu tan ma kama tawa tomo esun pona.', instructions:'o pana e poki suli tu lon ilo tawa. o tawa e ilo tawa tomo esun. o pana e poki ale tawa tomo esun ni: lipu ona li sama lon nimi poki, tenpo, en suno. ike la sina ken kama jo sin e poki.' },
    'l10-cold-chain': { title:'ilo lete tu wan', objective:'o awen e nanpa lete tu wan lon nanpa wile lon tenpo sama.', instructions:'o ante e ilo [[A]], ilo [[B]], ilo [[C]]. ante wan li ante e nanpa mute. lon tenpo sama la poki lete suli o −18.0, tomo lete o +4.0, linja ko lete o +0.5.' },
    'l10-cold-record': { title:'lipu nanpa [[neko]]', objective:'o ante e nanpa ilo tu wan tawa nasin [[neko]]. o pali e poki nanpa tu wan.', instructions:'ilo li pana e 0.0042, 0.00075, 125. o ante e nanpa ale tawa nasin [[neko]]. nanpa open ona o lon 1–9. ni la o pali e poki nanpa lili tu wan. ale li pona la ilo tawa sewi li open.' },
    'l10-textile-mixer': { title:'nanpa pi wan en kipisi', objective:'o nanpa e kulupu tu wan. o pali e poki nanpa pi wan en kipisi tu wan.', instructions:'lipu [[A]]: (1+1/2) en (1+1/4). lipu [[B]]: (2+3/4) en (2+3/4). lipu [[C]]: (3+1/2) en (4+3/4). o nanpa e ale tu wan. pini la o pali e poki nanpa tu wan. lon poki ale la wan suli en kipisi o lon.' },
    'l10-textile-routing': { title:'nasin len kule', objective:'o pana e len tu tawa ma pali pona lon tomo sewi.', instructions:'o tawa e len tu tawa ilo pali. len [[laso]] li tawa supa kule. len [[walo]] li tawa supa pini pona. ike la sina ken kama jo sin e len.' },
    'l10-inspection-audit': { title:'lukin pini pi lipu pana', objective:'o lukin e lipu pana [[pan]] e lipu pana [[suwi]]. o anu e lipu ale tawa ma pana anu ma awen ike.', instructions:'lipu tu ni li toki e moku sama pi pana sina lon tenpo pini. sina tawa e moku sin ala. lipu [[pan]] la sona lete li awen lon pona. lipu [[suwi]] la sona lete +8.5 li weka tan pona, li ike. o anu e lipu [[pan]] tawa ma pana. o anu e lipu [[suwi]] tawa ma awen ike.' },

    'l11-call-survey': { title:'palisa kalama tu wan', objective:'o awen e sona tan palisa [[A]], [[B]], [[C]]. ni la o kepeken sitelen ma.', instructions:'palisa [[A]], [[B]], [[C]] li lon ma alasa en ma soweli. o kama poka palisa ale. ni la [[E/USE]] li kama lon; o kepeken e ona tawa awen e sona.' },
    'l11-call-triangulation': { title:'alasa ma kepeken weka', objective:'o kepeken weka tan palisa tu wan. o alasa e ma awen waso lon pimeja.', instructions:'palisa ale li pana e weka tawa ma sama. weka ni li nanpa e tawa poka en tawa sewi/anpa lon sitelen ma. o anu e poki ma wan: weka ona tawa [[A]], [[B]], [[C]] o sama e nanpa lipu tu wan.' },
    'l11-roost-schedule': { title:'tenpo awen en moku', objective:'o pana sin e lipu tu tu lon nasin tenpo pona.', instructions:'lipu tu tu ni li tawa lon poka tenpo pimeja. o pana e ona tan tenpo open tawa tenpo pini. o kepeken nasin [[suno]] en [[tenpo]] sina sona.' },
    'l11-lineage-match': { title:'lipu mama', objective:'o sama e jan lili tu tu e kulupu mama tu tu kepeken sona ale.', instructions:'jan lili ale li pana e sitelen mama wan taso. sitelen wan taso li ken ala pana e mama ona. kulupu mama [[A–D]] ale li kepeken tenpo wan taso. sona tu tan lipu ante li toki e sitelen insa. o anu e mama tawa jan lili ale; pini la o luka e [[o alasa]].' },
    'l11-parent-bands': { title:'pana e sitelen mama', objective:'o pana e sitelen mama tu tawa supa awen pona.', instructions:'tomo lipu li pana e sitelen tu. [[loje]] li tawa supa poka loje. [[laso]] li tawa supa poka laso. ike la sina ken kama jo sin e sitelen.' },
    'l11-habitat-triage': { title:'pona sin e ma soweli', objective:'o kepeken sona ma. o alasa e ma [[akesi]] wan e ilo [[moli]] wan.', instructions:'o anu e ma [[A–D]] wan tawa [[akesi]], e ma [[A–D]] ante tawa ilo [[moli]]. [[akesi]]: kalama [[waso]] li lon ala; anpa li seli; nasin anpa sin li lon. ilo [[moli]]: sona ante li toki e ni: soweli li pali lon tenpo ni, taso nanpa pi ilo ma li awen sama. lon ni [[moli]] li toki e ilo pakala; ona li toki ala e soweli moli. pini la o luka e [[o alasa]].' },

    'l12-parity-core': { title:'ilo luka pi ante tu', objective:'o pona e linja lipu 10 kepeken ilo luka 10.', instructions:'ilo luka 10 li ante e suno nasin 10 lon kulupu. suno wan li ken kama tan ilo mute. ilo luka ale li jo e nasin tu: lon anu ala. sina luka e ilo sama tenpo tu la ona li kama tawa nasin open. o pali e sitelen suno wile. o luka e [[o alasa]]. kulupu ilo wan taso li pona.' },
    'l12-identity-order': { title:'nasin sitelen 8', objective:'o alasa e linja wan taso pi sitelen 8. sona ale o lon lon tenpo sama.', instructions:'sona wan taso li ken ala pini e linja. o ante e sitelen 8. sona ma 9 ale o lon lon tenpo sama. ni la o luka e [[o alasa]].' },
    'l12-master-code': { title:'linja len sitelen 6', objective:'o alasa e linja sitelen 6. ilo li pana e nanpa pi ma sama e nanpa pi ma ante.', instructions:'musi ni li anu e sitelen jo 6. sitelen ale li lon linja len tenpo wan taso. o pali e linja 6. o luka e [[o alasa]]. o kepeken nanpa tu: ma sama en ma ante. sina open sin e lipu la linja len li awen sama.' },
    'l12-relation-mirrors': { title:'ilo lukin linja tu wan', objective:'o tawa e linja suno [[A]], [[B]], [[C]] tawa lupa ona lon tenpo sama.', instructions:'ilo lukin 10 li lon nasin pi linja suno tu wan. o sike e ona. [[A]], [[B]], [[C]] ale o kama lon lupa sama nimi ona lon tenpo sama. nasin pona wan taso li kepeken ilo lukin ale.' },
    'l12-final-sudoku': { title:'[[Sudoku]] 9×9 kepeken [[nanpa-linja-n]]', objective:'o pini e [[Sudoku]] pi suli meso. ni li musi sona pini pi musi ale.', instructions:'lon linja poka ale, lon linja sewi ale, en lon poki 3×3 ale la nanpa 1–9 o lon tenpo wan taso. [[Sudoku]] ni li suli meso; nasin pona wan taso li lon. sitelen suli li [[nanpa-linja-n]]. nanpa [[Latin]] lili li sona namako. sina ken awen e nanpa lili lon poki. ilo li toki e pona taso lon tenpo pi luka [[o alasa]].' }
  };

  const EXACT_TP = {
    // Existing Toki Pona source strings can pass through unchanged.
    'o tawa insa.': 'o tawa insa.',
    'o lukin. o alasa e sitelen.': 'o lukin. o alasa e sitelen.',
    'o pana e sike lon supa.': 'o pana e sike lon supa.',
    'pona.': 'pona.',
    'o alasa e nasin.': 'o alasa e nasin.',
    'o alasa e sitelen.': 'o alasa e sitelen.',
    'o alasa e sitelen tu wan.': 'o alasa e sitelen tu wan.',
    'o lukin e nanpa.': 'o lukin e nanpa.',
    'o pali e poki nanpa.': 'o pali e poki nanpa.',
    'o lukin e ilo sona.': 'o lukin e ilo sona.',
    'wawa li lon.': 'wawa li lon.',
    'o ante e nanpa.': 'o ante e nanpa.',

    // Relational clues: symbolic layout is intentional so the Toki Pona is not a calque of English word order.
    'left + middle = 7': 'poka loje {{+}} meso {{=}} 7',
    'middle + right = 5': 'meso {{+}} poka laso {{=}} 5',
    'left + right = 6': 'poka loje {{+}} poka laso {{=}} 6',

    'suno is one step clockwise from the top.': 'tan sewi la [[suno]] li tawa ma wan lon nasin ↷.',
    'mun is three steps clockwise from suno.': 'tan [[suno]] la [[mun]] li tawa ma tu wan lon nasin ↷.',
    'ma is two steps anti-clockwise from mun.': 'tan [[mun]] la [[ma]] li tawa ma tu lon nasin ↶.',
    'toki is three steps clockwise from ma.': 'tan [[ma]] la [[toki]] li tawa ma tu wan lon nasin ↷.',

    'Black is at one end.': '[[pimeja]] li lon pini wan.',
    'White is farther right than blue.': 'tan [[laso]] la [[walo]] li lon poka laso.',
    'Yellow is directly between red and blue.': '[[loje]] → [[jelo]] → [[laso]] {{(}}poka taso{{)}}.',
    'Red is closer to black than blue is.': 'weka: [[pimeja]]↔[[loje]] < [[pimeja]]↔[[laso]].',
    'White is not next to yellow.': '[[walo]] en [[jelo]] li lon poka ala.',
    'Black is left of white.': 'tan [[walo]] la [[pimeja]] li lon poka loje.',

    'mun is somewhere left of suno.': 'tan [[suno]] la [[mun]] li lon poka loje.',
    'telo is immediately right of mun.': 'tan [[mun]] la [[telo]] li lon poka laso lon poka taso.',
    'kasi is immediately right of suno.': 'tan [[suno]] la [[kasi]] li lon poka laso lon poka taso.',
    'ma is at one end.': '[[ma]] li lon pini wan.',
    'suno is not at an end.': '[[suno]] li lon pini ala.',
    'ma is not next to telo.': '[[ma]] en [[telo]] li lon poka ala.',
    'ma is right of suno.': 'tan [[suno]] la [[ma]] li lon poka laso.',

    'telo happens before kasi.': '[[telo]] → … → [[kasi]].',
    'kasi is immediately before ilo.': '[[kasi]] → [[ilo]] {{(}}poka taso{{)}}.',
    'suno is exactly three positions after telo.': '[[telo]] → □ → □ → [[suno]].',
    'ma is immediately after suno.': '[[suno]] → [[ma]] {{(}}poka taso{{)}}.',
    'toki is after ma but before mun.': '[[ma]] → … → [[toki]] → … → [[mun]].',
    'mun is last.': '[[mun]] li pini.',
    'ilo is before suno.': '[[ilo]] → … → [[suno]].',

    'suno is somewhere between nasin and waso.': '[[nasin]] → … → [[suno]] → … → [[waso]].',
    'tenpo is exactly four slots to the right of kiwen.': 'tan [[kiwen]] la [[tenpo]] li lon poka laso lon ma tu tu.',
    'nasin is somewhere between telo and waso.': '[[telo]] → … → [[nasin]] → … → [[waso]].',
    'kiwen is somewhere between nasin and mani.': '[[nasin]] → … → [[kiwen]] → … → [[mani]].',
    'jan is somewhere between telo and tenpo.': '[[telo]] → … → [[jan]] → … → [[tenpo]].',
    'jan is somewhere left of nasin.': 'tan [[nasin]] la [[jan]] li lon poka loje.',
    'nasin is not at either end.': '[[nasin]] li lon pini ala.',
    'waso is exactly two slots to the right of suno.': 'tan [[suno]] la [[waso]] li lon poka laso lon ma tu.',
    'mani is somewhere between suno and waso.': '[[suno]] → … → [[mani]] → … → [[waso]].',

    'K and M came from parent pairs with the same middle trait.': 'kulupu mama pi jan lili [[K]] en kulupu mama pi jan lili [[M]]: sitelen meso ona li sama.',
    'P and S came from parent pairs with the same middle trait.': 'kulupu mama pi jan lili [[P]] en kulupu mama pi jan lili [[S]]: sitelen meso ona li sama.',
    'Every parent pair A–D is used exactly once.': 'kulupu mama [[A–D]] ale li kepeken tenpo wan taso.',

    'The west pedestal wants the relic made from stone.': 'supa poka loje li wile e ijo [[kiwen]].',
    'The centre pedestal wants the thing that can hold water.': 'supa meso li wile e ijo ni: ona li ken jo e [[telo]].',
    'The east pedestal wants the relic that can roll.': 'supa poka laso li wile e ijo li ken sike tawa.',

    'At the very beginning, you opened the way by carrying one object to a table. What was that object?': 'lon open musi la sina tawa e ijo wan tawa supa. ni li open e nasin. ijo seme?',
    'The coordinate map led you to a hidden cache. Its three-glyph panel had ma in the middle and the same material glyph at both ends. Which glyph was repeated?': 'sitelen ma li pana e nasin tawa poki len. sitelen tu wan ona li jo e [[ma]] lon meso, li jo e sitelen sama lon pini tu. sitelen seme li lon pini tu?',
    'In the Synchronization Core, you had to distinguish 03:09 from a date and a decimal. Which glyph identifies that reading as a time?': 'lon ilo tenpo sama la 03:09 li tenpo. ona li suno ala; ona li nanpa pi sitelen . ala. sitelen seme li toki e tenpo?',
    'In the Equivalence Gallery, 1/2, 0.5 and 50% belonged in one row because they had what relationship?': 'lon tomo nanpa sama la 1/2, 0.5, 50% li lon linja sama. tan seme? ona li seme?',
    'At the river crossing, who had to travel with the raft every time while carrying at most one passenger?': 'lon tawa telo la seme li tawa lon tomo telo tenpo ale, li ken jo e jan ante wan taso?',
    'In the Number Systems Lab, you matched decimal targets to Noka cartouches and one other non-decimal cartouche type. Which glyph named the other type?': 'lon tomo nasin nanpa la sina sama e nanpa pi nasin 10 e poki [[Noka]] e poki nasin ante. sitelen seme li nimi e nasin ante?',
    'In the Airflow Gallery, what had to be routed from the left inlet to both right-side vents at the same time?': 'lon tomo nasin kon la seme li tawa tan lupa poka loje tawa lupa poka laso tu lon tenpo sama?',
    'In the Deduction Chamber, one clue put a token immediately to the right of suno. Which token was it?': 'lon tomo sona nasin la tan [[suno]] la sona wan li pana e sitelen wan lon poka laso lon poka taso. sitelen seme?',

    // Level 10 grouped answer labels and evidence.
    'Bakery allocation': 'pana tawa tomo [[pan]]',
    'Sweet-goods allocation': 'pana tawa tomo [[suwi]]',
    'Reserve allocation': 'pana tawa poki awen',
    '5 of 16 equal lots': '5/16 pi poki sama',
    '7 of 16 equal lots': '7/16 pi poki sama',
    '4 of 16 equal lots': '4/16 pi poki sama',
    'Sensor A': 'ilo sona [[A]]',
    'Sensor B': 'ilo sona [[B]]',
    'Sensor C': 'ilo sona [[C]]',
    'raw reading 0.0042': 'nanpa ilo 0.0042',
    'raw reading 0.00075': 'nanpa ilo 0.00075',
    'raw reading 125': 'nanpa ilo 125',
    'Batch A': 'kulupu [[A]]',
    'Batch B': 'kulupu [[B]]',
    'Batch C': 'kulupu [[C]]',
    '1 1/2 + 1 1/4 measures': 'suli (1+1/2) en (1+1/4)',
    '2 3/4 + 2 3/4 measures': 'suli (2+3/4) en (2+3/4)',
    '3 1/2 + 4 3/4 measures': 'suli (3+1/2) en (4+3/4)',

    // Level 11 evidence.
    'akesi habitat': 'ma [[akesi]]',
    'moli sensor': 'ilo [[moli]]',
    'no bird call + warm substrate + fresh low ground track': 'kalama [[waso]] ala {{+}} anpa seli {{+}} nasin anpa sin',
    'current activity independently confirmed + environmental reading frozen': 'sona ante li toki e pali lon tenpo ni {{+}} nanpa ma li awen sama',
    'waso call confirmed': 'kalama [[waso]] li lon',
    'overnight roost schedule active': 'tenpo awen pimeja li pali',
    'probe changes with the night cycle': 'ilo ma li ante lon tenpo pimeja',
    'parent bands confirmed': 'sitelen mama li lon',
    'incubation pulse active': 'wawa pi poki mama li pali',
    'probe changes during feeding': 'ilo ma li ante lon tenpo moku',
    'no waso call': 'kalama [[waso]] li lon ala',
    'ground temperature +27.0': 'seli anpa +27.0',
    'fresh low ground track': 'nasin anpa sin',
    'animal call confirmed independently': 'sona ante li toki e kalama soweli',
    'feed mass changed twice': 'suli moku li ante tenpo tu',
    'environmental probe stuck at +12.0 for 6 h': 'ilo ma li awen lon +12.0 lon tenpo 6 [[h]]',

    "The Sphinx Court changes: a quick-exit ladder rises to the upper loft and a trapdoor opens to the lower chambers.": "tomo jan [[Sphinx]] li ante: palisa weka lili li tawa sewi; lupa weka lili li tawa anpa.",
    "Level 10 freight spine powered from the percentage allocation ledger.": "ma musi 10: lipu % li pana e wawa tawa nasin poki tawa.",
    "Level 10 cold chain stable: scientific recorder activated.": "ma musi 10: nasin lete li pona; ilo lipu [[neko]] li open.",
    "Level 10 scientific notation record complete: upper service lift activated.": "ma musi 10: lipu [[neko]] li pini; ilo tawa sewi li open.",
    "Level 10 dye-batch mixed-fraction reconciliation complete.": "ma musi 10: nanpa pi wan en kipisi pi kule len li pona.",
    "Level 11 call triangulation complete: canopy route opened.": "ma musi 11: sona ma tan kalama li pini; nasin tawa sewi li open.",
    "Level 11 roost schedule complete: incubator route opened.": "ma musi 11: nasin tenpo awen li pini; lupa tawa poki mama li open.",
    "Level 11 lineage registry complete: parent bands released.": "ma musi 11: lipu mama li pini; sitelen mama li kama.",
    "Level 11 habitat recovery complete: exit restored.": "ma musi 11: pona sin pi ma soweli li pini; lupa weka li open.",
    "Level 12 fracture parity core complete: upper and lower master-trial routes activated.": "ma musi 12: ilo pakala insa li pona; nasin sewi en nasin anpa li open.",
    "Level 12 identity permutation complete.": "ma musi 12: nasin sitelen 8 li pini.",
    "Level 12 totality cipher complete.": "ma musi 12: linja len li pini.",
    "Level 12 triple relation mirror array complete.": "ma musi 12: ilo lukin linja tu wan li pini.",
    "Level 12 final Sudoku complete: 120/120 glyphs recovered.": "ma musi 12: [[Sudoku]] pini li pini; sitelen 120/120 li kama.",
    "Labyrinth survey complete: 3/3. Return to the Sphinx Court.": "alasa nasin nasa li pini: 3/3. o kama sin tawa tomo jan [[Sphinx]].",
    "You re-enter the solved maze. Use Leave maze (X) from anywhere when you want to return outside.": "sina kama sin lon nasin nasa pini. sina wile tawa weka la o kepeken “o tawa weka” {{(}}[[X]]{{)}} lon ma seme.",
    "You enter the maze. The entrance seals behind you.": "sina tawa insa nasin nasa. lupa open li pini lon monsi sina.",
    "You leave the maze. Its entrance remains open for the rest of the level.": "sina tawa weka tan nasin nasa. lupa ona li awen open lon ma musi ni.",
    "You climb down into the Lower Concourse.": "sina tawa anpa tawa nasin anpa.",
    "You take the quick-exit ladder from the Sphinx Court into the Counterweight Loft.": "sina kepeken palisa weka lili tan tomo jan [[Sphinx]] tawa tomo sewi pi kiwen awen.",
    "You descend directly into the Sphinx Court.": "sina tawa anpa lon nasin lili tawa tomo jan [[Sphinx]].",
    "You take the quick-exit trapdoor beneath the Sphinx Court into the Counterweight Chamber.": "sina kepeken lupa weka lili tan tomo jan [[Sphinx]] tawa tomo kiwen awen.",
    "The counterweight ladder carries you directly to the upper loft.": "palisa pi kiwen awen li tawa e sina tawa tomo sewi.",
    "You descend the counterweight shortcut.": "sina tawa anpa lon nasin lili pi kiwen awen.",
    "You descend through the newly exposed vault trapdoor.": "sina tawa anpa lon lupa sin pi tomo awen.",
    "You descend through the marked Cold Store hatch.": "sina tawa anpa lon lupa sitelen tawa tomo lete.",
    "The chilled service lift carries you directly to the Textile / Dye Loft.": "ilo tawa sewi lete li tawa e sina tawa tomo len kule.",
    "The chilled service lift descends to the Cold Store.": "ilo tawa sewi lete li tawa anpa tawa tomo lete.",
    "You climb the lowered awning shortcut into the Textile / Dye Loft.": "sina tawa sewi lon nasin lili pi len sewi tawa tomo len kule.",
    "You descend the awning shortcut into the Central Market Arcade.": "sina tawa anpa lon nasin lili pi len sewi tawa tomo esun insa.",
    "You climb the marked ladder into the Aviary Walk.": "sina tawa sewi lon palisa sitelen tawa nasin waso.",
    "You descend through the open incubator hatch.": "sina tawa anpa lon lupa open tawa tomo poki mama.",
    "You descend the new shortcut into the isolated Recovery Ward.": "sina tawa anpa lon nasin lili sin tawa tomo pona sin.",
    "You descend through the FINAL hatch into the last Sudoku chamber.": "sina tawa anpa lon lupa [[FINAL]] tawa tomo [[Sudoku]] pini.",
    "You return to the maze entrance. The solved maze remains open.": "sina kama sin tawa open pi nasin nasa. nasin nasa pini li awen open.",

    // Common mechanism/UI text.
    'AND: both · OR: either · XOR: different': '[[AND]]: tu ale li lon · [[OR]]: wan anu tu li lon · [[XOR]]: wan taso li lon',
    'Undo last move': 'o weka e tawa pini',
    'Restart route': 'o open sin e nasin',
    'grid steps': 'tawa poki',
    'cross-record observations': 'sona tan lipu ante',
    'Final puzzle · every row, column and 3×3 box must contain 1–9 exactly once. Small Latin numerals are accessibility fallbacks; the large symbols are nanpa-linja-n digits.': 'musi pini · lon linja ale, linja sewi ale, en poki 3×3 ale la 1–9 o lon tenpo wan taso. nanpa [[Latin]] lili li sona namako; sitelen suli li [[nanpa-linja-n]].',
    'Clear cell': 'o weka e poki',
    'The rotation continues correctly. Press Try answer to confirm the observatory.': 'sike ni li pona. o luka e [[o alasa]] tawa pini e musi.',
    'Choose the next quarter-turn of the lit shape.': 'o anu e sike 1/4 kama pi sitelen suno.',
    'That post has no disc to move.': 'kiwen sike li lon palisa ni ala.',
    'A larger disc cannot sit on a smaller disc.': 'kiwen sike suli li ken ala lon sewi kiwen sike lili.',
    'That peg cannot jump into this hole.': 'kiwen ni li ken ala tawa lupa ni.',
    'Answer incomplete. Fill every required position, then press Try answer.': 'pana sona li pini ala. o pana e sitelen lon ma wile ale. ni la o luka e [[o alasa]].',
    'That answer did not work. Review the clues, adjust the mechanism, and try again.': 'pana sona li pona ala. o lukin sin e sona, o ante e ilo, o alasa sin.',
    'That answer did not work. Review the clues and try again.': 'pana sona li pona ala. o lukin sin e sona, o alasa sin.',
    'That answer did not work. No individual parts are confirmed yet; review the clues and try again.': 'pana sona li pona ala. ilo li toki ala e kipisi pona. o lukin sin e sona, o alasa sin.',
    "Glyph recovered.": "sitelen li kama.",
    "Your progress changed in another window. Reload this page to continue.": "musi awen sina li ante lon lipu ante. o open sin e lipu ni tawa musi.",
    "Delivery complete. The Cold Store hatch is OPEN in the Market Arcade and marked ↓ on the minimap.": "pana poki li pini. lon tomo esun la lupa ↓ tawa tomo lete li open; sitelen ma li pana e ona.",
    "Level 10 delivery route complete: clearly marked Cold Store hatch opened in the Market Arcade.": "ma musi 10: pana poki li pini. lupa sitelen ↓ tawa tomo lete li open lon tomo esun.",
    "Textile batch complete. The awning shortcut opens, and the Ledger Office, Dispatch Bay and Quarantine inspection shutters open together.": "pali len li pini. nasin lili pi len sewi li open. lupa tawa tomo lipu esun en lupa tawa tomo pana en lupa tawa tomo jaki li open.",
    "Level 10 textile batch complete: awning shortcut and inspection shutters opened.": "ma musi 10: pali len li pini; nasin lili en lupa pi tomo lukin pali li open.",
    "Inspection complete. The dispatch shutter is released.": "lukin pali li pini. lupa pana li open.",
    "Textile batch complete. FINAL OBJECTIVE: the Ledger Office is now open upstairs. Use the audit console marked ! to review the pan and suwi shipment records.": "pali len li pini. WILE PINI: tomo lipu lon sewi li open. o kepeken ilo lukin lipu pi sitelen {{!}}. o lukin e lipu pana [[pan]] e lipu pana [[suwi]].",
    "Level 10 textile batch complete: awning shortcut opened and final Ledger audit activated.": "ma musi 10: pali len li pini; nasin lili li open; lukin pini lon tomo lipu li pali.",
    "Level 10 dye-batch reconciliation complete: textile routing objects released beside the mixer.": "ma musi 10: nanpa telo kule li pini; len tu li kama lon poka ilo telo kule tawa pali tawa len.",
    "Final audit approved. pan is cleared for Dispatch; suwi is classified for Quarantine. The Dispatch Bay exit is now OPEN on the market floor.": "lukin pini li pona. lipu [[pan]] li tawa ma pana. lipu [[suwi]] li tawa ma awen ike. lupa weka lon ma pana li OPEN lon anpa.",
    "Level 10 final shipment audit complete: Dispatch exit opened.": "ma musi 10: lukin pini pi lipu pana li pini; lupa weka pi ma pana li open.",
    "Quarantine status: the suwi shipment record is classified unsafe after a +8.5 cold-history excursion.": "sona pi ma awen ike: lipu pana [[suwi]] li ike tan ante lete +8.5.",
    "Final audit approved. The exit terminal is active in this bay.": "lukin pini li pona. ilo weka li pali lon tomo ni.",
    "Dispatch remains sealed until the final Ledger Office audit is approved.": "ma pana li pini. o pini e lukin lipu lon tomo lipu lon open.",
    "FINAL OBJECTIVE: use the audit console marked ! in this office. Review the pan and suwi shipment records and classify each as Dispatch or Quarantine. You are not moving the goods again.": "WILE PINI: o kepeken ilo lukin lipu pi sitelen {{!}} lon tomo ni. o lukin e lipu pana [[pan]] e lipu pana [[suwi]]. o anu e lipu ale tawa ma pana anu ma awen ike. sina tawa e moku sin ala.",
    "Final audit complete. Dispatch Bay is now open on the market floor.": "lukin pini li pini. ma pana lon anpa li open.",
    "The final audit console activates only after the textile routing is complete.": "ilo lukin pini li pali taso lon tenpo ni: pali len li pini.",
    "Audit status: the unsafe suwi shipment record is classified for quarantine. This room is optional after completion.": "sona lukin: lipu pana [[suwi]] li tawa ma awen ike. musi li pini la sina wile ala tawa tomo ni.",
    "Quarantine remains sealed until the Ledger Office audit is complete.": "ma awen ike li pini. o pini e lukin lipu lon tomo lipu lon open.",
    "pan shipment record": "lipu pana [[pan]]",
    "suwi shipment record": "lipu pana [[suwi]]",
    "Earlier delivery: pan → bakery ✓": "pana pini: [[pan]] → tomo [[pan]] ✓",
    "Cold history: remained within safe limits": "sona lete: lete li awen lon pona",
    "Earlier delivery: suwi → sweet-goods ✓": "pana pini: [[suwi]] → tomo [[suwi]] ✓",
    "Cold history: +8.5 excursion — unsafe": "sona lete: +8.5 li weka tan nasin pona — ike",
    "Level 10 inspection complete: dispatch shutter released.": "ma musi 10: lukin pali li pini; lupa pana li open.",
    "Parent bands aligned. A direct ladder opens from the Nest Observatory to the Recovery Ward.": "sitelen mama li lon ma pona. palisa tawa li open tan tomo lukin mama tawa tomo pona sin.",
    "Level 11 parent-band placement complete: Recovery Ward shortcut opened.": "ma musi 11: sitelen mama li lon ma pona; nasin lili tawa tomo pona sin li open.",
    "The Sphinx yields. A quick-exit ladder to the upper loft and a trapdoor to the lower chambers open in the court.": "jan [[Sphinx]] li pona e nasin. palisa tawa sewi en lupa tawa anpa li open lon tomo ni.",
    "All three market allocations are correct. Conveyor and freight-cart power comes online across the market.": "pana esun tu wan ale li pona. wawa li kama tawa ilo linja en ilo tawa poki.",
    "Cold chain stable. The recorder console is now active; normalize its three values before the service lift can run.": "nasin lete li pona. ilo lipu li open. o ante e nanpa tu wan tawa nasin [[neko]] pona; ni la ilo tawa sewi li ken pali.",
    "Scientific record accepted. The chilled service lift now runs directly between the basement and textile loft.": "lipu nanpa [[neko]] li pona. ilo tawa sewi lete li pali tan anpa tawa tomo len sewi.",
    "All three mixed-fraction batch totals are reconciled. Place both cloth batches at their correct stations.": "nanpa pi wan en kipisi tu wan ale li pona. o pana e len tu tawa ma pali pona ona.",
    "Roost located. A marked canopy ladder ↑ opens in the Habitat Hub.": "ma awen waso li kama sona. palisa ↑ li open lon tomo ma soweli.",
    "Overnight cycle restored. The incubator hatch ↓ is now open on the Aviary Walk.": "nasin tenpo pimeja li pona sin. lupa ↓ tawa poki mama li open lon nasin waso.",
    "Lineage matched. The loje and laso parent bands are released in the Nest Observatory.": "mama en jan lili li sama pona. sitelen mama [[loje]] en [[laso]] li kama lon tomo lukin mama.",
    "Habitat triage complete. The sanctuary exit is restored.": "pali pona ma soweli li pini. lupa weka li open sin.",
    "Archive spine repaired. A marked upper ladder ↑ and lower hatch ↓ are now active in the Fracture Core.": "ilo pakala insa li pona sin. palisa ↑ en lupa ↓ li pali lon ilo ni.",
    "Identity permutation resolved. The Relation Observatory trial is now available upstairs.": "nasin sitelen 8 li pona. musi pi tomo lukin nasin li open lon sewi.",
    "Totality cipher resolved. All preliminary trials are complete: the FINAL hatch ↓ is open in this vault.": "linja len li pona. musi open ale li pini. lupa [[FINAL]] ↓ li open lon tomo ni.",
    "Totality cipher resolved. Complete the upper Relation Observatory to open the final hatch.": "linja len li pona. o pini e musi pi tomo lukin nasin lon sewi; ni la lupa pini li open.",
    "Triple mirror relation solved. All preliminary trials are complete: the FINAL hatch ↓ is open in the lower cipher vault.": "nasin ilo lukin tu wan li pona. musi open ale li pini. lupa [[FINAL]] ↓ li open lon tomo linja len anpa.",
    "Triple mirror relation solved. Complete the lower Totality Cipher before the final hatch can open.": "nasin ilo lukin tu wan li pona. o pini e musi linja len lon anpa; ni la lupa pini li open.",
    "Final Sudoku solved. All 120 glyphs are recovered. The game is complete.": "[[Sudoku]] pini li pona. sitelen pona 120 ale li kama. musi ale li pini.",
    "Unknown campaign puzzle.": "musi sona ni li sona ala tawa ilo.",
    "This puzzle is already complete.": "musi sona ni li pini lon tenpo pini.",
    "The Relation Observatory is waiting for the Identity permutation to be resolved first.": "o pini e nasin sitelen 8 lon open. ni la musi pi tomo lukin nasin li open.",
    "The final Sudoku is sealed until the Identity, Totality and Relation trials are all complete.": "[[Sudoku]] pini li len. o pini e musi tu wan ni lon open: nasin sitelen 8, linja len 6, en ilo lukin tu wan.",
    "Nothing within reach.": "ijo kepeken li lon poka ala.",
    "You take the sike.": "sina kama jo e [[sike]].",
    "Picked up the sike.": "sina kama jo e [[sike]].",
    "pona! The sike rests on the supa. The concourse gate opens immediately and the maze route is now active.": "pona! [[sike]] li lon [[supa]]. lupa nasin li open. nasin nasa li ken tawa.",
    "The sike is correctly placed, but the mechanism still expects the introductory glyph keys.": "[[sike]] li lon ma pona. taso ilo li wile e sitelen open.",
    "A heavy work table: supa.": "supa pali suli: [[supa]].",
    "The maze door is still sealed.": "lupa pi nasin nasa li awen pini.",
    "The exit is sealed. Three glyph sockets are waiting for the glyphs hidden in the maze.": "lupa weka li pini. ma sitelen tu wan li wile e sitelen len lon nasin nasa.",
    "The upper hatch is sealed. The maze mechanism controls it.": "lupa sewi li pini. ilo pi nasin nasa li lawa e ona.",
    "The maintenance hatch is locked.": "lupa tawa tomo pali li pini.",
    "The labyrinth survey is already complete.": "alasa pi nasin nasa li pini lon tenpo pini.",
    "Survey complete: 3/3. Return to the Sphinx Court at the centre of the labyrinth.": "alasa li pini: 3/3. o kama sin tawa tomo jan [[Sphinx]] lon meso nasin nasa.",
    "The counterweight relics are already balanced.": "ijo kiwen awen li sama suli lon tenpo pini.",
    "You can carry only one object at a time.": "sina ken jo e ijo tawa wan taso.",
    "That pedestal is occupied. Pick up its relic first.": "ijo li lon supa ni. o kama jo e ona lon open.",
    "The counterweights balance. A direct ladder to the upper loft drops into place.": "kiwen awen li sama. palisa tawa lili li open tawa tomo sewi.",
    "The freight controls have no power. Complete the Market allocation ledger first.": "wawa li lon ala ilo poki tawa. o pini e lipu pana esun lon open.",
    "That freight stop is not available yet.": "ma awen pi ilo poki tawa ni li open ala.",
    "The next freight route is not available yet.": "nasin tawa poki kama li open ala.",
    "The cart system is not powered yet.": "wawa li lon ala ilo tawa poki.",
    "Bring the delivery cart to Receiving before loading the bulk crate.": "o tawa e ilo poki tawa ma kama. ni la o pana e poki suli lon ona.",
    "The delivery cart already carries two crates.": "ilo poki tawa li jo e poki tu lon tenpo ni.",
    "This delivery stand is already correctly supplied.": "poki pona li lon ma pana ni lon tenpo pini.",
    "The textile batch is already complete.": "pali len li pini lon tenpo pini.",
    "The cloth batch is already correctly processed.": "len ni li pini pona lon tenpo pini.",
    "Your hands are full.": "sina jo e ijo tawa lon tenpo ni.",
    "This textile station is empty.": "ijo len li lon ma pali ni ala.",
    "The inspection is already complete.": "lukin pali li pini lon tenpo pini.",
    "The inspection placement is complete.": "pana ijo lukin li pini.",
    "The final dispatch shutter is open. Level 10 is complete.": "lupa pana pini li open. ma musi 10 li pini.",
    "Acoustic survey complete: 3/3. Use the triangulation console in the Habitat Hub.": "alasa kalama li pini: 3/3. o kepeken ilo ma lon tomo ma soweli.",
    "Level 11 acoustic survey complete: 3/3 call pylons recorded.": "ma musi 11: palisa kalama 3/3 li awen lon lipu.",
    "The parent-band placement is already complete.": "pana sitelen mama li pini lon tenpo pini.",
    "The parent bands are already aligned.": "sitelen mama li lon ma pona lon tenpo pini.",
    "The sanctuary systems are stable. Level 11 is complete.": "ilo ale pi ma awen li pona. ma musi 11 li pini.",
    "The final archive is stable. All 120 glyphs are recovered.": "tomo lipu pini li pona. sitelen pona 120 ale li kama.",
    "The next level is not available yet.": "ma musi kama li open ala lon tenpo ni.",
    "New campaign started.": "musi sin li open.",
    "Campaign ready.": "musi li ken open.",
    "Campaign complete: 120 / 120 glyphs recovered.": "musi ale li pini: sitelen 120 / 120 li kama.",
    "The game could not initialize.": "musi li ken ala open.",
    "That route is blocked.": "nasin ni li pini.",
    "target mass": "suli wile",
    "available glyphs": "sitelen ken",
    "Test code": "o alasa e linja",
    "jan must stay with these pairs:": "[[jan]] o awen poka kulupu ni:",
    "Load": "o pana lon",
    "Unload": "o pana weka",
    "That bank position is already occupied.": "ijo li lon ma ni lon poka telo.",
    "That peg cannot jump into this hole.": "kiwen ni li ken ala tawa lupa ni.",
    "calculator": "ilo nanpa",
    "Play pattern": "o kalama e linja",
    "exact total": "nanpa sama wile",
    "choose the reptile habitat": "o anu e ma [[akesi]]",
    "choose the failed sensor": "o anu e ilo [[moli]]"
  };

  const ROOM_NAMES_TP = {
    'Entry Chamber':'tomo open','Workshop':'tomo pali','Lower Concourse':'nasin anpa','Maze':'nasin nasa','Maze dead end A':'pini nasin [[A]]','Maze dead end B':'pini nasin [[B]]','Maze dead end C':'pini nasin [[C]]','Sealed maze chamber':'tomo len pi nasin nasa','Upper Gallery':'tomo sewi','Observation Room':'tomo lukin','Maintenance Level':'ma pali anpa',
    'Second Atrium':'tomo open nanpa tu','Number Workshop':'tomo pali nanpa','Lower Archive':'tomo lipu anpa','Cartography Room':'tomo sitelen ma','Notation Laboratory':'tomo sona sitelen','Foundation Vault':'tomo awen open',
    'Observation Chamber':'tomo lukin','Relay Gallery':'tomo nasin wawa','Navigation Floor':'ma nasin','Synchronization Core':'ilo tenpo sama','Instrument Workshop':'tomo ilo',
    'Pump Hall':'tomo telo','Stackworks':'tomo kiwen sike','Codebreaker Lab':'tomo linja len','Equivalence Gallery':'tomo nanpa sama','Chronology Hall':'tomo tenpo',
    'River Dock':'tomo telo tawa','Freight Bay':'tomo poki tawa','Sliding Gallery':'tomo sitelen tawa','Strategy Room':'tomo nasin sona','Pantry Observatory':'tomo lukin poki moku',
    'Card Archive':'tomo lipu musi','Calculation Bench':'supa nanpa','Country Index':'kulupu ma','Number Systems Lab':'tomo nasin nanpa','Position Vault':'tomo ma sike','Records Junction':'nasin lipu',
    'Resonance Hall':'tomo kalama','Airflow Gallery':'tomo nasin kon','Pulse Chamber':'tomo wawa tenpo','Spectrum Laboratory':'tomo kule','Blackout Substation':'tomo wawa pimeja','Sensor Junction':'nasin ilo sona',
    'Deduction Chamber':'tomo sona nasin','Dual Mirror Array':'tomo ilo lukin tu','Truth Gate Rack':'tomo lupa lon','Dependency Scheduler':'tomo nasin pali','Transit Vault':'tomo nasin nanpa','Constraint Junction':'nasin sona',
    'Survey Gallery':'tomo alasa','Vertical Labyrinth':'nasin nasa lon sewi lon anpa','Sphinx Court':'tomo jan [[Sphinx]]','Counterweight Chamber':'tomo kiwen awen','Counterweight Loft':'tomo sewi pi kiwen awen','Alignment Vault':'tomo ma sama','Transit Junction':'nasin tawa',
    'Receiving Bay':'ma kama poki','Central Market Arcade':'tomo esun insa','Cold Store':'tomo lete','Textile / Dye Loft':'tomo sewi pi len kule','Ledger Office':'tomo lipu nanpa','Dispatch Bay':'ma pana weka','Quarantine':'ma awen ike',
    'Field Station':'tomo alasa ma','Habitat Hub':'tomo ma soweli','Aviary Walk':'nasin waso','Nest Observatory':'tomo lukin mama','Incubator Service':'tomo poki mama','Lineage Registry':'lipu mama','Recovery Ward':'tomo pona sin',
    'Final Archive Vestibule':'open pi tomo lipu pini','Fracture Core':'ilo pakala insa','Identity Gallery':'tomo nasin sitelen','Relation Observatory':'tomo lukin nasin','Totality Cipher Vault':'tomo linja len','Final Sudoku Chamber':'tomo [[Sudoku]] pini'
  };

  const ROOM_HINTS_TP = {
    'Two introductory glyphs teach collection and reusable keys.':'sitelen open tu li pana e sona ni: sina alasa e sitelen; sitelen jo li ken kepeken sin.',
    'Put the ball on the table.':'o pana e sike lon supa.',
    'The physical mechanism has responded.':'ilo lon tomo li pali.',
    'The maze and upper route branch from here.':'nasin nasa en nasin sewi li open tan ni.',
    'Marker 1 is at a true dead end.':'sitelen 1 li lon pini nasin.',
    'Marker 2 is far from the first.':'sitelen 2 li weka tan sitelen 1.',
    'Marker 3 completes the maze set.':'sitelen 3 li pini e kulupu sitelen nasin.',
    'Power elsewhere unlocks this delayed-return chamber.':'wawa tan ma ante li open e tomo ni lon tenpo kama.',
    'Explore the branches and return to the marked entrance.':'o alasa e nasin mute. ni la o kama sin tawa open sitelen.',
    'Build the first abbreviated numeric cartouche.':'o pali e poki nanpa lili nanpa wan.',
    'The Level 1 terminal is here.':'ilo sona pi ma musi 1 li lon ni.',
    'Power is restored; return to the maze.':'wawa li pona. o kama sin tawa nasin nasa.',
    'Reverse the five digit glyphs.':'o ante e nasin pi sitelen nanpa luka.',
    'The first station uses the five Level 1 digit glyphs.':'ma pali nanpa wan li kepeken sitelen nanpa luka pi ma musi 1.',
    'A material/index puzzle controls cartography access.':'musi kiwen en nanpa li open e tomo sitelen ma.',
    'The archive holds another digit sequence and, later, the hidden cache.':'tomo lipu li jo e linja nanpa ante. lon tenpo kama la poki len li kama kin.',
    'A coordinate clue can reveal something elsewhere in this level.':'sona ma nanpa li ken open e ijo lon ma ante pi ma musi ni.',
    'Thousands, scientific notation, and full-form structure are introduced here.':'lon ni la sina kama sona e [[kulupu]], e nasin [[neko]], e nasin poki sitelen suli.',
    'Confirm the complete twenty-glyph foundation set.':'o lukin e kulupu open pi sitelen 20 ale.',
    'Three clock dials obey three simultaneous clues.':'sike tenpo tu wan o pona tawa sona tu wan lon tenpo sama.',
    'Rotate the relay pieces until one signal reaches the output.':'o sike e nasin wawa. wawa wan o kama tawa pini.',
    'Visit the beacons in order before reaching the exit.':'o tawa tawa ma [[A]], [[B]], [[C]] lon nasin. ni la o tawa tawa pini.',
    'Each lamp affects its neighbours.':'suno ilo wan li ante e suno poka ona.',
    'Balance the target using each available weight at most once.':'o kama sama tawa suli wile. kiwen suli wan li ken kepeken tenpo wan taso.',
    'Choose the contextual numeric cartouche that matches the time display.':'o anu e poki nanpa li sama tawa sitelen tenpo.',
    'Use the two vessels to measure the target amount exactly.':'o kepeken poki tu tawa telo suli wile taso.',
    'Move the stack without ever placing a larger disc on a smaller disc.':'o tawa e kulupu kiwen. kiwen suli o lon sewi kiwen lili ala.',
    'Test symbol codes and use the exact/misplaced feedback.':'o alasa e linja sitelen. ilo li toki e nanpa pi sitelen lon ma sama e nanpa pi sitelen pona lon ma ante.',
    'Align fraction, decimal and percentage cartouches that represent the same quantity.':'o pana e poki kipisi, poki nanpa pi sitelen ., en poki nanpa % lon linja sama tawa nanpa sama.',
    'Order events by both their date and time cartouches.':'o pana e pali lon nasin tenpo kepeken suno en tenpo.',
    'The boat carries you and one passenger; unsafe pairs cannot be left unattended.':'tomo telo li jo e sina en jan ante wan. kulupu ike li ken ala awen kepeken sina ala.',
    'Push the crates onto both marked bays.':'o pana e poki tawa ma sitelen tu.',
    'Slide numbered tiles into their ordered positions.':'o tawa e kipisi nanpa tawa ma pona ona.',
    'Each jump removes the peg that was crossed.':'tawa lon sewi kiwen la kiwen insa li weka.',
    'Use the row and column clues to reconstruct the pantry inventory pattern.':'o kepeken nanpa linja en nanpa sewi tawa sitelen sin e sitelen poki moku.',
    'Sort the five sitelen playing cards by rank.':'o pana e lipu musi luka lon nasin nanpa.',
    'Solve three renderer-backed calculations, including negative and decimal values.':'o pini e pali nanpa tu wan. nanpa pi poka {{−}} en nanpa pi sitelen . li lon.',
    'Solve the crossing country proper names with reusable glyph initials.':'o pali e nimi Toki Pona pi ma tu tu lon linja kama sama. poki ale li kepeken sitelen jo; nimi ona o open kepeken sitelen kalama wile.',
    'Match decimal values to binary Noka and hexadecimal Nasa cartouches.':'o sama e nanpa pi nasin 10 tawa poki [[Noka]] pi nasin tu anu poki [[Nasa]] pi nasin 16.',
    'Use the relative-position clues to align four eight-position rings.':'o kepeken sona ma tawa sike tu tu pi ma 8.',
    'Listen to the five-tone pattern and repeat it.':'o kute e kalama luka. o pana sin e ona.',
    'Rotate the ducts so the inlet reaches both outlets.':'o sike e nasin kon. kon o kama tawa lupa pini tu.',
    'Coupled lane controls shift one pulse lane and disturb the next.':'ante linja wan li tawa e linja wawa wan, li ante kin e linja kama.',
    'Arrange the five filters so all positional clues agree.':'o pana e ilo kule luka lon nasin li pona tawa sona ale.',
    'Choose a unique set of breaker loads matching the target.':'o anu e kulupu wawa wan taso li sama tawa nanpa wile.',
    'All seven ordering clues must agree at once.':'sona nasin 7 ale o lon lon tenpo sama.',
    'Both beams must reach their own exits simultaneously.':'linja suno tu o kama tawa lupa ona lon tenpo sama.',
    'Choose three gates that satisfy all eight test rows.':'o anu e lupa sona tu wan. lon linja 8 ale la pini ona o sama e pini wile.',
    'Every ordering dependency must hold at the same time.':'sona kama open ale o lon lon tenpo sama.',
    'Reach the exit in exactly eight moves and hit the exact sum without revisiting.':'o kama tawa pini kepeken tawa 8 taso. o kama e nanpa sama. o tawa sin lon ma sama ala.',
    'The marked entrance ladder stays visible on the minimap. Branches begin almost immediately; inspect three distant survey markers and find the maze relic.':'palisa open li awen lon sitelen ma. nasin mute li open lon poka. o lukin e sitelen alasa tu wan weka. o alasa e ijo nasin nasa.',
    'A ladder descends into the labyrinth. The final vault trapdoor will appear on this floor later.':'palisa li tawa anpa tawa nasin nasa. lon tenpo kama la lupa anpa pi tomo pini li kama lon ma ni.',
    'The Sphinx answers only after all three survey markers have been inspected. Solving it opens quick exits here.':'jan [[Sphinx]] li toki taso lon tenpo pi sitelen alasa tu wan pini. pona la nasin weka kepeken tenpo lili li open.',
    'Three relics from three floors belong on three different pedestals. Placed relics can be picked up again.':'ijo tu wan tan ma tu wan li tawa supa tu wan ante. sina ken kama jo sin e ijo lon supa.',
    'One relic begins here. Later, the counterweight system opens a direct vertical shortcut and the shaft-polarity console becomes useful.':'ijo wan li lon ni. lon tenpo kama la ilo kiwen awen li open e nasin lili tawa sewi tawa anpa; ilo nasin wawa li kama suli.',
    'Rotate the three floor plans until all three vertical shafts line up with the marked coordinates.':'o sike e sitelen ma tu wan. lupa tawa sewi tawa anpa [[A]], [[B]], [[C]] ale o kama lon lon sitelen.',
    'The powered delivery cart can hold two bulk crates. Load both Receiving crates, then send the cart to the Market Arcade.':'ilo tawa wawa li ken jo e poki suli tu. o pana e poki tu lon ona. o tawa e ona tawa tomo esun.',
    'Reconcile the three mixed-fraction dye batches, then carry each cloth batch to the correct station. Completion drops an awning shortcut to the market floor.':'o nanpa e kulupu len tu wan kepeken nanpa pi wan en kipisi. ni la o tawa e len tu tawa ma pali ona. pini la nasin lili li open tawa tomo esun.',
    'After the textile chain, two inspection samples appear here. Their records refer to the deliveries and cold history already used in this level.':'pini pi pali len la ijo lukin tu li kama lon ni. lipu ona li kepeken sona pana en sona lete pi ma musi ni.',
    'The final unsafe inspection sample belongs here. Wrong placements remain recoverable.':'ijo lukin ike li tawa ma ni. pana ike la sina ken kama jo sin e ijo.',
    'Three acoustic pylons are spread across the Field Station and Habitat Hub. Get close to each one and record it with E / USE.':'palisa kalama tu wan li lon ma alasa en ma soweli. o kama poka palisa ale. o kepeken [[E/USE]] tawa awen e sona ona.',
    'The hatch returns to the Aviary Walk. The connected registry contains four parent-pair records and four hatchling records.':'lupa li tawa sin tawa nasin waso. lipu mama li jo e kulupu mama tu tu e jan lili tu tu.',
    'Match hatchlings to parent pairs by the two preserved trait glyphs. Each pair is used once; completion releases the two physical parent bands in the Nest Observatory.':'o sama e jan lili e kulupu mama kepeken sitelen mama awen. kulupu ale li kepeken tenpo wan. pini la sitelen mama tu li kama lon tomo lukin mama.',
    'This isolated ward is reached only after the parent-band placement opens the canopy shortcut. Use the accumulated sanctuary records for the final triage.':'nasin tawa tomo ni li open taso lon pini pi pana sitelen mama. o kepeken lipu ale pi ma awen tawa musi pini.',
    'The final archive contains four master trials and one last Sudoku. The Fracture Core must be repaired first.':'tomo lipu pini li jo e musi suli tu tu e [[Sudoku]] pini. o pona e ilo pakala insa lon open.',
    'Airflow Gallery and Pulse Chamber can be solved in either order.':'tomo nasin kon en tomo wawa tenpo li ken pini lon nasin seme la pona.',
    'Dual Mirror Array and Truth Gate Rack are independent branches.':'tomo ilo lukin tu en tomo lupa lon li nasin ante; sina ken pini e wan open.',
    'The Calculation Bench and Country Index can be solved in either order.':'supa nanpa en kulupu ma li ken pini lon nasin seme la pona.',
    'The Freight Bay and Sliding Gallery can be solved in either order.':'tomo poki tawa en tomo sitelen tawa li ken pini lon nasin seme la pona.',
    'After the reservoir is solved, Stackworks and the Codebreaker Lab can be tackled in either order.':'pini pi musi telo la tomo kiwen sike en tomo linja len li ken pini lon nasin seme la pona.'
  };

  function normalizeLang(value) {
    return value === LANG_EN ? LANG_EN : LANG_TP;
  }

  function getLanguage() {
    try { return normalizeLang(window.localStorage?.getItem(STORAGE_KEY)); }
    catch (_) { return LANG_TP; }
  }

  function setLanguage(value) {
    const lang = normalizeLang(value);
    try { window.localStorage?.setItem(STORAGE_KEY, lang); } catch (_) {}
    return lang;
  }

  function ui(key, lang = getLanguage()) {
    const item = UI[key];
    if (!item) return key;
    return item[normalizeLang(lang)] ?? item.en ?? key;
  }

  function markupTermsFromTranslation(source, translated) {
    let out = source == null ? '' : String(source);
    const seen = new Set();
    const re = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = re.exec(String(translated ?? '')))) {
      const term = match[1];
      if (!term || seen.has(term) || out.includes(`[[${term}]]`)) continue;
      seen.add(term);
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`(^|[^A-Za-z0-9_-])(${escaped})(?=$|[^A-Za-z0-9_-])`, 'g'), `$1[[$2]]`);
    }
    return out;
  }

  function puzzle(id, field, fallback = '', lang = getLanguage()) {
    const tp = PUZZLES[id]?.[field] ?? '';
    if (normalizeLang(lang) === LANG_EN) return markupTermsFromTranslation(fallback || '', tp);
    return tp || fallback || '';
  }

  function roomName(source, lang = getLanguage()) {
    if (normalizeLang(lang) === LANG_EN) return source || '';
    return ROOM_NAMES_TP[source] || source || '';
  }

  function roomHint(source, lang = getLanguage()) {
    const tp = ROOM_HINTS_TP[source] || EXACT_TP[source] || '';
    if (normalizeLang(lang) === LANG_EN) return markupTermsFromTranslation(source || '', tp);
    return tp;
  }

  function exact(source, lang = getLanguage()) {
    const text = source == null ? '' : String(source);
    if (!text) return text;
    if (normalizeLang(lang) === LANG_EN) {
      const translated = EXACT_TP[text] ?? ROOM_HINTS_TP[text] ?? ROOM_NAMES_TP[text] ?? '';
      return markupTermsFromTranslation(text, translated);
    }
    if (EXACT_TP[text] != null) return EXACT_TP[text];
    if (ROOM_HINTS_TP[text] != null) return ROOM_HINTS_TP[text];
    if (ROOM_NAMES_TP[text] != null) return ROOM_NAMES_TP[text];

    let m;
    if ((m = text.match(/^station ([A-Z])$/i))) return `ma [[${m[1].toUpperCase()}]]`;
    if ((m = text.match(/^pair ([A-Z])$/i))) return `kulupu [[${m[1].toUpperCase()}]]`;
    if ((m = text.match(/^hatchling ([A-Z])$/i))) return `jan lili [[${m[1].toUpperCase()}]]`;
    if ((m = text.match(/^setting (\d+)$/i))) return `nasin ${m[1]}`;
    if ((m = text.match(/^target (.+)$/i))) return `nanpa wile ${m[1]}`;
    if ((m = text.match(/^moves:\s*(\d+)$/i))) return `tawa: ${m[1]}`;
    if ((m = text.match(/^quarter-turns:\s*(\d+)$/i))) return `sike 1\/4: ${m[1]}`;
    if ((m = text.match(/^Notes:\s*(ON|OFF)$/i))) return `sona lili: ${m[1].toUpperCase() === 'ON' ? 'lon' : 'ala'}`;
    if ((m = text.match(/^Position (\d+), (.+)\. Tap to change glyph\.$/i))) return `ma ${m[1]}: [[${m[2]}]]. o luka la sitelen li ante.`;
    if ((m = text.match(/^selected mass:\s*(.+)$/i))) return `suli anu: ${m[1]}`;
    if ((m = text.match(/^post (\d+)$/i))) return `palisa ${m[1]}`;
    if ((m = text.match(/^exact (\d+) · misplaced (\d+)$/i))) return `ma sama ${m[1]} · ma ante ${m[2]}`;
    if ((m = text.match(/^crossings:\s*(\d+)$/i))) return `tawa telo: ${m[1]}`;
    if ((m = text.match(/^swaps:\s*(\d+)$/i))) return `ante ma: ${m[1]}`;
    if ((m = text.match(/^problem (\d+) \/ (\d+)$/i))) return `pali nanpa ${m[1]} / ${m[2]}`;
    if ((m = text.match(/^choice (\d+) \/ (\d+)$/i))) return `anu ${m[1]} / ${m[2]}`;
    if ((m = text.match(/^tone (\d+)$/i))) return `kalama ${m[1]}`;
    if ((m = text.match(/^moves:\s*(\d+) · each arrow shifts this lane and the next lane in opposite directions$/i))) return `tawa: ${m[1]} · palisa wan li tawa e linja ni e linja kama lon nasin ante.`;
    if ((m = text.match(/^memory (\d+) \/ (\d+) · mistakes (\d+)$/i))) return `sona ${m[1]} / ${m[2]} · pakala ${m[3]}`;
    if ((m = text.match(/^flips (.*)$/i))) return `ilo ante: ${m[1]}`;
    if ((m = text.match(/^Targets:\s*(.*)$/i))) return `ma wile: ${m[1]}`;
    if ((m = text.match(/^payment (.+) \/ (.+)$/i))) return `mani pana ${m[1]} / ${m[2]}`;
    if ((m = text.match(/^No: (.+) would be left together without jan\.$/i))) return `ala: [[jan]] li weka la ${m[1]} li awen poka.`;
    if ((m = text.match(/^Cart cargo (\d+)\/2: (.+)\.$/i))) return `poki lon ilo tawa ${m[1]}/2: ${m[2]}.`;
    if (text === 'The delivery cart is empty (0/2).') return 'ilo tawa poki li jo e poki ala (0/2).';
    if ((m = text.match(/^The delivery cart arrives from (Receiving Bay|Market Arcade)\.$/i))) {
      const ma = m[1].toLowerCase() === 'receiving bay' ? 'ma kama poki' : 'tomo esun insa';
      return `ilo tawa poki li kama tan ${ma}.`;
    }
    if ((m = text.match(/^The delivery cart moves to (Receiving Bay|Market Arcade)\.$/i))) {
      const ma = m[1].toLowerCase() === 'receiving bay' ? 'ma kama poki' : 'tomo esun insa';
      return `ilo tawa poki li tawa ${ma}.`;
    }
    if ((m = text.match(/^Delivery cart called to (Receiving Bay|Market Arcade)\.$/i))) {
      const ma = m[1].toLowerCase() === 'receiving bay' ? 'ma kama poki' : 'tomo esun insa';
      return `ilo tawa poki li kama tawa ${ma}.`;
    }
    if ((m = text.match(/^Delivery cart moved to (Receiving Bay|Market Arcade)\.$/i))) {
      const ma = m[1].toLowerCase() === 'receiving bay' ? 'ma kama poki' : 'tomo esun insa';
      return `ilo tawa poki li tawa ${ma}.`;
    }
    if ((m = text.match(/^(pan|suwi) crate loaded onto the cart \((\d+)\/2\)\.$/i))) return `poki [[${m[1].toLowerCase()}]] li kama lon ilo tawa (${m[2]}/2).`;
    if ((m = text.match(/^(pan|suwi) crate loaded onto delivery cart\.$/i))) return `poki [[${m[1].toLowerCase()}]] li kama lon ilo tawa poki.`;
    if ((m = text.match(/^(bakery|sweet-goods) holds (pan|suwi); bring an available cart to recover it\.$/i))) {
      const ma = m[1].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `${ma} li jo e poki [[${m[2].toLowerCase()}]]. o kama e ilo tawa; ni la o kama jo sin e poki.`;
    }
    if ((m = text.match(/^(pan|suwi) crate returned from (bakery|sweet-goods) to the cart\.$/i))) {
      const ma = m[2].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `poki [[${m[1].toLowerCase()}]] li kama sin tan ${ma} tawa ilo tawa.`;
    }
    if ((m = text.match(/^(bakery|sweet-goods) expects (pan|suwi)\. Bring the delivery cart to the Market Arcade first\.$/i))) {
      const ma = m[1].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `${ma} li wile e poki [[${m[2].toLowerCase()}]]. o kama e ilo tawa tawa tomo esun insa lon open.`;
    }
    if ((m = text.match(/^(bakery|sweet-goods) expects (pan|suwi), but that crate is not on the cart\.$/i))) {
      const ma = m[1].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `${ma} li wile e poki [[${m[2].toLowerCase()}]], taso poki ni li lon ilo tawa ala.`;
    }
    if ((m = text.match(/^(pan|suwi) crate delivered to (bakery|sweet-goods) ✓$/i))) {
      const ma = m[2].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `poki [[${m[1].toLowerCase()}]] li kama pona tawa ${ma} ✓`;
    }
    if ((m = text.match(/^Delivery placement: (pan|suwi) → (bakery|sweet-stall)\.$/i))) {
      const ma = m[2].toLowerCase() === 'bakery' ? 'tomo pan' : 'tomo suwi';
      return `pana poki: [[${m[1].toLowerCase()}]] → ${ma}.`;
    }
    if ((m = text.match(/^You take the (laso|walo) cloth batch\.$/i))) return `sina kama jo e len [[${m[1].toLowerCase()}]].`;
    if ((m = text.match(/^You take the placed (laso|walo) cloth batch\.$/i))) return `sina kama jo sin e len [[${m[1].toLowerCase()}]].`;
    if ((m = text.match(/^(laso|walo) cloth placed at (dye-frame|finish-table)\.$/i))) {
      const ma = m[2].toLowerCase() === 'dye-frame' ? 'supa kule' : 'supa pini';
      return `len [[${m[1].toLowerCase()}]] li lon ${ma}.`;
    }
    if ((m = text.match(/^Textile placement: (laso|walo) → (dye-frame|finish-table)\.$/i))) {
      const ma = m[2].toLowerCase() === 'dye-frame' ? 'supa kule' : 'supa pini';
      return `pana len: [[${m[1].toLowerCase()}]] → ${ma}.`;
    }
    if ((m = text.match(/^(pan|suwi) sample taken — cold history remained within limits\.$/i))) return `sina kama jo e ijo lukin [[${m[1].toLowerCase()}]]. sona lete ona li awen pona.`;
    if ((m = text.match(/^(pan|suwi) sample taken — cold history ([+\-−]?\d+(?:\.\d+)?) excursion\.$/i))) return `sina kama jo e ijo lukin [[${m[1].toLowerCase()}]]. sona lete ona li pakala lon ${m[2]}.`;
    if ((m = text.match(/^You recover the (pan|suwi) inspection sample\.$/i))) return `sina kama jo sin e ijo lukin [[${m[1].toLowerCase()}]].`;
    if ((m = text.match(/^The (dispatch|quarantine) position is empty\.$/i))) {
      const ma = m[1].toLowerCase() === 'dispatch' ? 'ma pana' : 'ma awen ike';
      return `${ma} li jo e ijo ala.`;
    }
    if ((m = text.match(/^(pan|suwi) sample placed in (dispatch|quarantine)\.$/i))) {
      const ma = m[2].toLowerCase() === 'dispatch' ? 'ma pana' : 'ma awen ike';
      return `ijo lukin [[${m[1].toLowerCase()}]] li lon ${ma}.`;
    }
    if ((m = text.match(/^Inspection placement: (pan|suwi) → (dispatch|quarantine)\.$/i))) {
      const ma = m[2].toLowerCase() === 'dispatch' ? 'ma pana' : 'ma awen ike';
      return `pana ijo lukin: [[${m[1].toLowerCase()}]] → ${ma}.`;
    }
    if ((m = text.match(/^Level (\d+) complete\. Use Continue to Level (\d+)\.$/i))) return `ma musi ${m[1]} li pini. o tawa ma musi ${m[2]}.`;
    if ((m = text.match(/^Level (\d+) has returned to its starting point\.$/i))) return `ma musi ${m[1]} li kama sin tawa open ona.`;
    if ((m = text.match(/^Welcome back\. Your Level (\d+) progress has been restored\.$/i))) return `sina kama sin. musi awen pi ma musi ${m[1]} li kama sin.`;
    if ((m = text.match(/^Survey marker recorded:\s*(\d+)\/(\d+)\.$/i))) return `sitelen alasa li awen lon lipu: ${m[1]}/${m[2]}.`;
    if ((m = text.match(/^Call pylon ([A-Z]) recorded \((\d+)\/(\d+)\)\.$/i))) return `sona pi palisa kalama [[${m[1]}]] li awen lon lipu (${m[2]}/${m[3]}).`;
    if ((m = text.match(/^Call pylon ([A-Z]) is already recorded \((\d+)\/(\d+)\)\.$/i))) return `sona pi palisa kalama [[${m[1]}]] li awen lon lipu lon tenpo pini (${m[2]}/${m[3]}).`;
    if ((m = text.match(/^Recovered glyph: (.+) \((\d+)\/120\)(.*)$/i))) return `sitelen [[${m[1]}]] li kama (${m[2]}/120).`;
    if ((m = text.match(/^Level (\d+) is ready\.$/i))) return `ma musi ${m[1]} li open.`;
    if ((m = text.match(/^Entered (.+)\.$/i))) return `sina kama lon ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You climb into the (.+)\.$/i))) return `sina tawa sewi tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You descend into the (.+)\.$/i))) return `sina tawa anpa tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You climb back into the (.+)\.$/i))) return `sina tawa sewi sin tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You climb back to the (.+)\.$/i))) return `sina tawa sewi sin tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You descend to the (.+)\.$/i))) return `sina tawa anpa tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^You return to the (.+)\.$/i))) return `sina kama sin tawa ${ROOM_NAMES_TP[m[1]] || m[1]}.`;
    if ((m = text.match(/^(.+) is already in your collection\.$/i))) return `sitelen [[${m[1]}]] li lon kulupu sina lon tenpo pini.`;
    if ((m = text.match(/^(.+) band placed on the (left|right) perch\.$/i))) return `sitelen mama [[${m[1]}]] li lon supa ${m[2] === 'left' ? 'poka loje' : 'poka laso'}.`;
    if ((m = text.match(/^Recovered at (.+)\.$/i))) return `sitelen li kama lon ${ROOM_NAMES_TP[m[1]] || 'ma ni'}.`;
    if ((m = text.match(/^Earned by solving:\s*(.+)$/i))) return `sitelen li kama tan pini pi musi ni: ${m[1]}`;
    if (/^Earned by .+\.$/i.test(text)) return 'sitelen li kama tan pini pi pali ni.';
    if (/^Recorded all three Level 11 acoustic pylons\.$/i.test(text)) return 'sitelen li kama tan awen sona pi palisa kalama tu wan.';
    if (/^Puzzle completed\.$/i.test(text)) return 'musi sona li pini pona.';
    if (/^Solved .+\.$/i.test(text)) return 'musi sona li pini pona.';
    if (/^Deduced from the completed sentence:/i.test(text)) return 'sitelen li kama tan toki pini.';
    if (/^Completed inscription:/i.test(text)) return 'sitelen toki li pini.';
    return text;
  }

  const NANPA_DIGIT_GLYPH_WORDS = Object.freeze({
    '0':'ijo', '1':'wan', '2':'tu', '3':'seli', '4':'awen',
    '5':'luka', '6':'utala', '7':'mun', '8':'pipi', '9':'jo'
  });
  const TP_LITERAL_PUNCTUATION = new Set(['+','-','−','&','[',']','(',')','=','←','→']);

  function nanpaDigitGlyphs(digits) {
    return String(digits ?? '').split('').map(ch => NANPA_DIGIT_GLYPH_WORDS[ch]).filter(Boolean).join(' ');
  }

  function nanpaCartouche(core) {
    return `[nanpa1/2 :1/2 ${core} nanpa1/2]`;
  }

  // Source text for the existing nasin-nanpa font. These are explicit Nanpa-format
  // abbreviated numeric cartouches, not Latin stand-ins. Progress ratios are encoded
  // as one nanpa-linja-n fraction cartouche rather than two integers around a slash.
  function numericCartoucheSource(raw) {
    const token = String(raw ?? '').trim().replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ');
    let unsigned = token;
    let signCore = '';
    if (/^[+\-−]/.test(unsigned)) {
      const sign = unsigned[0];
      unsigned = unsigned.slice(1);
      signCore = sign === '+' ? 'en2/3 ' : 'ona2/3 ';
    }
    let m, core = '';
    if ((m = unsigned.match(/^(\d+)\+(\d+)\/(\d+)$/))) {
      // Compact mixed-number syntax is whitespace-sensitive in player-facing TP copy:
      // `1+1/2` is one mixed-fraction numeric unit, while a spaced arithmetic operator
      // between units is expressed separately (normally as Toki Pona `en`).
      core = `${nanpaDigitGlyphs(m[1])} kin2/3 ${nanpaDigitGlyphs(m[2])} o2/3 o2/3 ${nanpaDigitGlyphs(m[3])}`;
    } else if ((m = unsigned.match(/^(\d+) (\d+)\/(\d+)$/))) {
      core = `${nanpaDigitGlyphs(m[1])} kin2/3 ${nanpaDigitGlyphs(m[2])} o2/3 o2/3 ${nanpaDigitGlyphs(m[3])}`;
    } else if ((m = unsigned.match(/^(\d+)\/(\d+)$/))) {
      core = `${nanpaDigitGlyphs(m[1])} o2/3 o2/3 ${nanpaDigitGlyphs(m[2])}`;
    } else if ((m = unsigned.match(/^(\d+)\.(\d+)%$/))) {
      core = `${nanpaDigitGlyphs(m[1])} o2/3 ${nanpaDigitGlyphs(m[2])} kipisi2/3`;
    } else if ((m = unsigned.match(/^(\d+)%$/))) {
      core = `${nanpaDigitGlyphs(m[1])} kipisi2/3`;
    } else if ((m = unsigned.match(/^(\d+)\.(\d+)$/))) {
      core = `${nanpaDigitGlyphs(m[1])} o2/3 ${nanpaDigitGlyphs(m[2])}`;
    } else if (/^\d+$/.test(unsigned)) {
      core = nanpaDigitGlyphs(unsigned);
    }
    return core ? nanpaCartouche(`${signCore}${core}`.trim()) : '';
  }

  function appendLiteralProtectedText(parent, text) {
    let buffer = '';
    const flush = () => { if (buffer) { parent.append(document.createTextNode(buffer)); buffer=''; } };
    for (const ch of String(text ?? '')) {
      if (!TP_LITERAL_PUNCTUATION.has(ch)) { buffer += ch; continue; }
      flush();
      const literal = document.createElement('span');
      literal.className = 'tpLiteral';
      literal.textContent = ch;
      parent.append(literal);
    }
    flush();
  }

  function numericTokenHasSafeBoundaries(text, start, end) {
    const before = start > 0 ? text[start-1] : '';
    const after = end < text.length ? text[end] : '';
    const blocked = ch => !!ch && /[A-Za-z0-9_.:,+\-−]/.test(ch);
    return !blocked(before) && !blocked(after);
  }

  function appendTpText(parent, text) {
    const source = String(text ?? '');
    const re = /\d+\+\d+\s*\/\s*\d+|[+\-−]?\d+\s+\d+\s*\/\s*\d+|[+\-−]?\d+\s*\/\s*\d+|[+\-−]?\d+\.\d+%?|[+\-−]?\d+%|[+\-−]?\d+/g;
    let at = 0, match;
    while ((match = re.exec(source))) {
      const start = match.index, end = re.lastIndex;
      if (!numericTokenHasSafeBoundaries(source,start,end)) continue;
      if (start > at) appendLiteralProtectedText(parent, source.slice(at,start));
      const cartoucheSource = numericCartoucheSource(match[0]);
      if (!cartoucheSource) { appendLiteralProtectedText(parent, match[0]); at=end; continue; }
      const numeric = document.createElement('span');
      numeric.className = 'tpNumeric';
      // Keep nanpa-linja-n renderer source out of visible text. The game engine
      // upgrades this placeholder to a renderer-backed canvas. Until that finishes,
      // CSS exposes only the ordinary Latin fallback from data-latin.
      numeric.textContent = '';
      const latin = match[0].replace(/\s*\/\s*/g,'/').replace(/\s+/g,' ');
      if (numeric.setAttribute) {
        numeric.setAttribute('data-nanpa-source',cartoucheSource);
        numeric.setAttribute('data-latin',latin);
        numeric.setAttribute('aria-label',latin);
        numeric.setAttribute('title',latin);
      } else {
        numeric.dataNanpaSource = cartoucheSource;
        numeric.dataLatin = latin;
      }
      parent.append(numeric);
      at = end;
    }
    if (at < source.length) appendLiteralProtectedText(parent, source.slice(at));
  }

  function stripMarkup(text) {
    return String(text ?? '')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\{\{([^}]+)\}\}/g, '$1');
  }

  function render(el, localizedText, options = {}) {
    if (!el) return;
    const lang = normalizeLang(options.lang ?? getLanguage());
    const text = localizedText == null ? '' : String(localizedText);
    const tpSitelen = lang === LANG_TP && options.sitelen !== false;
    el.replaceChildren();
    el.classList.toggle('tpProse', tpSitelen);
    if (options.rich === false) {
      el.textContent = stripMarkup(text);
      return;
    }
    const re = /\[\[([^\]]+)\]\]|\{\{([^}]+)\}\}/g;
    let at = 0, match;
    const appendPlain = chunk => {
      if (!chunk) return;
      if (tpSitelen) appendTpText(el,chunk);
      else el.append(document.createTextNode(chunk));
    };
    while ((match = re.exec(text))) {
      if (match.index > at) appendPlain(text.slice(at, match.index));
      const span = document.createElement('span');
      span.className = match[1] != null ? 'tpTerm' : 'tpLiteral';
      span.textContent = match[1] != null ? match[1] : match[2];
      el.append(span);
      at = re.lastIndex;
    }
    if (at < text.length) appendPlain(text.slice(at));
  }

  function setExact(el, source, options = {}) {
    render(el, exact(source, options.lang), options);
  }

  function termLabel(source, lang = getLanguage()) {
    if (normalizeLang(lang) === LANG_EN) return source;
    const map = { black:'pimeja', red:'loje', yellow:'jelo', blue:'laso', white:'walo', upper:'sewi', maze:'nasin nasa', lower:'anpa', clean:'pona', bad:'ike', bakery:'tomo pan', 'sweet-stall':'tomo suwi', 'dye-frame':'supa kule', 'finish-table':'supa pini', dispatch:'ma pana', quarantine:'ma awen ike', receiving:'ma kama', market:'tomo esun' };
    return map[source] || source;
  }

  window.TokiPonaRoomsI18n = Object.freeze({
    STORAGE_KEY, LANG_TP, LANG_EN, UI, PUZZLES, EXACT_TP, ROOM_NAMES_TP, ROOM_HINTS_TP,
    getLanguage, setLanguage, ui, puzzle, exact, roomName, roomHint, render, setExact, stripMarkup, markupTermsFromTranslation, termLabel, numericCartoucheSource
  });
})();
