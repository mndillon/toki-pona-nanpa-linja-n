(function (root) {
  'use strict';

  const STANDARD_120 = [
    'a','akesi','ala','alasa','ale','anpa','ante','anu','awen','e','en','esun','ijo','ike','ilo','insa','jaki','jan','jelo','jo',
    'kala','kalama','kama','kasi','ken','kepeken','kili','kiwen','ko','kon','kule','kulupu','kute','la','lape','laso','lawa','len','lete','li',
    'lili','linja','lipu','loje','lon','luka','lukin','lupa','ma','mama','mani','meli','mi','mije','moku','moli','monsi','mu','mun','musi',
    'mute','nanpa','nasa','nasin','nena','ni','nimi','noka','o','olin','ona','open','pakala','pali','palisa','pan','pana','pi','pilin','pimeja',
    'pini','pipi','poka','poki','pona','pu','sama','seli','selo','seme','sewi','sijelo','sike','sin','sina','sinpin','sitelen','sona','soweli','suli',
    'suno','supa','suwi','tan','taso','tawa','telo','tenpo','toki','tomo','tu','unpa','uta','utala','walo','wan','waso','wawa','weka','wile'
  ];

  const COMMON_2026_BASELINE_GLYPHS = [
    'namako','kin','oko','kipisi','leko','monsuta','tonsi','jasima','kijetesantakalu','soko','meso','epiku',
    'kokosila','lanpan','n','misikeke','ku','pake','apeja','majuna','powe','linluwi','kiki','su'
  ];

  const foundationL1 = ['o','e','wan','tu','seli','awen','luka','nanpa','ona','ma'];
  const foundationL2 = ['ijo','utala','mun','pipi','jo','en','kulupu','kala','nena','kiwen'];
  const foundationL3 = ['tenpo','suno','toki','kasi','nasin','tawa','sitelen','sona','ilo','poka'];
  const foundationL4 = ['telo','poki','palisa','supa','kule','lukin','sama','ante','open','pini'];

  const blueprint = {
    id: 'toki-pona-glyph-quest',
    title: 'Toki Pona Glyph Quest',
    status: 'draft',
    standardGlyphs: STANDARD_120,
    baselineGlyphs: COMMON_2026_BASELINE_GLYPHS,
    baselineSymbols: [
      '[',']','(',')','{','}',':','.',',','U+3000',
      'cartouche-start','cartouche-end','cartouche-extension',
      'stacking-joiner','scaling-joiner','long-start','long-end','reverse-long-start','reverse-long-end',
      'middle-dot','colon','tally','left-corner','right-corner','ni-left','ni-up','ni-right','sewi-alt'
    ],
    rules: {
      canonicalGlyphsPerLevel: 10,
      canonicalGlyphTotal: 120,
      allowDraftPartialCampaign: true,
      bonusCanSatisfyMinimum: false,
      requiredPuzzleRewardsConsumable: false
    },
    runtime: {
      puzzlePresentation: 'fullscreen-until-complete-or-exit',
      glyphOwnership: 'permanent-reusable-key',
      saveSystem: 'indexeddb',
      levelIntro: 'nanpa-linja-n-abbreviated-nanpa-format'
    },
    foundationMilestone: {
      afterLevel: 'L02',
      collectibleGlyphs: foundationL1.concat(foundationL2),
      requiredInitials: ['A','E','I','J','K','L','M','N','O','P','S','T','U','W'],
      numericAbbreviatedCollectibleGlyphs: ['ijo','wan','tu','seli','awen','luka','utala','mun','pipi','jo','nanpa','en','ona','o','kulupu','kala'],
      numericAbbreviatedBaselineGlyphs: ['kin','kipisi'],
      coordinateFoundationGlyphs: ['ma','kiwen'],
      note: 'By the end of Level 2 the guaranteed inventory covers every Toki Pona initial and the collectible repertoire needed for ordinary abbreviated decimal nanpa-linja-n cartouches. kin and kipisi are baseline.'
    },
    levels: [
      {
        id: 'L01', ordinal: 1, title: 'nanpa open', canonicalGlyphs: foundationL1,
        startArea: 'entry',
        initialStates: {
          workshopDoorOpen:false, mazeEntranceUnlocked:false, mazeExitReleased:false,
          upperAccess:false, maintenanceAccess:false, powerOn:false,
          innerMazeDoorUnlocked:false, observationDoorUnlocked:false, exitUnlocked:false
        },
        areas: [
          { id:'entry', name:'Entry Chamber', floor:0, worldRef:'main', roomRef:'Entry Chamber' },
          { id:'workshop', name:'Workshop', floor:0, worldRef:'main', roomRef:'Workshop' },
          { id:'concourse', name:'Lower Concourse', floor:0, worldRef:'main', roomRef:'Lower Concourse' },
          { id:'mazeHub', name:'Maze', floor:0, worldRef:'maze', roomRef:'Maze', tags:['maze'] },
          { id:'mazeA', name:'Maze dead end A', floor:0, worldRef:'maze', roomRef:'Dead End A', tags:['maze','dead-end'] },
          { id:'mazeB', name:'Maze dead end B', floor:0, worldRef:'maze', roomRef:'Dead End B', tags:['maze','dead-end'] },
          { id:'mazeC', name:'Maze dead end C', floor:0, worldRef:'maze', roomRef:'Dead End C', tags:['maze','dead-end'] },
          { id:'mazeInner', name:'Sealed maze chamber', floor:0, worldRef:'maze', roomRef:'Inner Chamber', tags:['maze','delayed-return'] },
          { id:'upper', name:'Upper Gallery', floor:1, worldRef:'upper', roomRef:'Upper Gallery' },
          { id:'maintenance', name:'Maintenance Level', floor:-1, worldRef:'lower', roomRef:'Maintenance Level' },
          { id:'observation', name:'Observation Room', floor:1, worldRef:'upper', roomRef:'Observation Room' }
        ],
        connections: [
          { id:'l1-entry-workshop', from:'entry', to:'workshop', bidirectional:true },
          { id:'l1-workshop-concourse', from:'workshop', to:'concourse', bidirectional:true, kind:'door', requirements:{states:{workshopDoorOpen:true}} },
          { id:'l1-maze-enter', from:'concourse', to:'mazeHub', bidirectional:false, kind:'maze-door', requirements:{states:{mazeEntranceUnlocked:true}} },
          { id:'l1-maze-exit', from:'mazeHub', to:'concourse', bidirectional:false, kind:'maze-door-return', requirements:{states:{mazeExitReleased:true}} },
          { id:'l1-maze-a', from:'mazeHub', to:'mazeA', bidirectional:true },
          { id:'l1-maze-b', from:'mazeHub', to:'mazeB', bidirectional:true },
          { id:'l1-maze-c', from:'mazeHub', to:'mazeC', bidirectional:true },
          { id:'l1-maze-inner', from:'mazeHub', to:'mazeInner', bidirectional:true, requirements:{states:{innerMazeDoorUnlocked:true}} },
          { id:'l1-concourse-upper', from:'concourse', to:'upper', bidirectional:true, requirements:{states:{upperAccess:true}} },
          { id:'l1-upper-maintenance', from:'upper', to:'maintenance', bidirectional:true, requirements:{states:{maintenanceAccess:true}} },
          { id:'l1-upper-observation', from:'upper', to:'observation', bidirectional:true, requirements:{states:{observationDoorUnlocked:true}} }
        ],
        puzzles: [
          { id:'l1-intro-o', chain:'intro', type:'pickup', area:'entry', sourceClass:'canonical', rewards:{glyphs:['o']}, skipIfRewardsOwned:true, skipSafe:true, ui:{presentation:'world',title:'Recover o'} },
          { id:'l1-intro-e', chain:'intro', type:'pickup', area:'entry', sourceClass:'canonical', rewards:{glyphs:['e']}, skipIfRewardsOwned:true, skipSafe:true, ui:{presentation:'world',title:'Recover e'} },
          {
            id:'l1-ball-table', chain:'workshop', type:'world-action', area:'workshop', sourceClass:'canonical',
            requirements:{glyphs:['o','e']}, rewards:{glyphs:['wan','tu'],setStates:{workshopDoorOpen:true,mazeEntranceUnlocked:true}},
            skipIfRewardsOwned:true, skipSafe:true, alreadyOwnedEffects:{setStates:{workshopDoorOpen:true,mazeEntranceUnlocked:true}},
            ui:{presentation:'world',title:'o pana e sike lon supa',instructions:'Put the ball on the table. The mechanism releases two number glyphs.'}
          },
          { id:'l1-maze-seli', chain:'maze', type:'pickup', area:'mazeA', sourceClass:'canonical', rewards:{glyphs:['seli']}, skipIfRewardsOwned:true, skipSafe:true, ui:{presentation:'world',title:'Maze marker 1'} },
          { id:'l1-maze-awen', chain:'maze', type:'pickup', area:'mazeB', sourceClass:'canonical', rewards:{glyphs:['awen']}, skipIfRewardsOwned:true, skipSafe:true, ui:{presentation:'world',title:'Maze marker 2'} },
          { id:'l1-maze-luka', chain:'maze', type:'pickup', area:'mazeC', sourceClass:'canonical', rewards:{glyphs:['luka']}, skipIfRewardsOwned:true, skipSafe:true, ui:{presentation:'world',title:'Maze marker 3'} },
          {
            id:'l1-maze-code', chain:'maze', type:'glyph-key-code', area:'mazeHub', sourceClass:'canonical',
            requirements:{glyphs:['seli','awen','luka']}, inputSequence:['seli','luka','awen'],
            rewards:{glyphs:['nanpa'],setStates:{mazeExitReleased:true,upperAccess:true}}, skipIfRewardsOwned:true, skipSafe:true,
            alreadyOwnedEffects:{setStates:{mazeExitReleased:true,upperAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Maze return code',instructions:'The three maze markers give the order. Build marker 1 → 3 → 2.'}
          },
          {
            id:'l1-upper-number', chain:'number', type:'glyph-key-code', area:'upper', sourceClass:'canonical',
            requirements:{glyphs:['nanpa','wan','tu','seli']}, inputSequence:['nanpa',':','wan','tu','seli','nanpa'],
            rewards:{glyphs:['ona'],setStates:{maintenanceAccess:true}}, skipIfRewardsOwned:true, skipSafe:true,
            alreadyOwnedEffects:{setStates:{maintenanceAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'First numeric cartouche',instructions:'Construct the abbreviated nanpa-format cartouche for the digit sequence 123. The nanpa glyph is reusable.'}
          },
          {
            id:'l1-maintenance-sequence', chain:'power', type:'glyph-key-code', area:'maintenance', sourceClass:'required-state',
            requirements:{glyphs:['wan','tu','seli','awen','luka']}, inputSequence:['luka','awen','seli','tu','wan'],
            rewards:{setStates:{powerOn:true,innerMazeDoorUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Power sequence',instructions:'Reverse the five digit glyphs you learned: 5 → 4 → 3 → 2 → 1.'}
          },
          {
            id:'l1-inner-signed-number', chain:'return', type:'glyph-key-code', area:'mazeInner', sourceClass:'canonical',
            requirements:{glyphs:['nanpa','ona','awen','o','luka'],states:{powerOn:true}},
            inputSequence:['nanpa',':','ona','awen','o','luka','nanpa'],
            rewards:{glyphs:['ma'],setStates:{observationDoorUnlocked:true}}, skipIfRewardsOwned:true, skipSafe:true,
            alreadyOwnedEffects:{setStates:{observationDoorUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Sealed numeric chamber',instructions:'Construct the abbreviated nanpa-format cartouche for −4.5.'}
          },
          {
            id:'l1-terminal', chain:'finale', type:'terminal', area:'observation', sourceClass:'story', storyCritical:false, requiredForMinimum:false,
            requirements:{glyphs:['ma'],states:{powerOn:true}}, rewards:{setStates:{exitUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Level 1 terminal',instructions:'Optional archive terminal. Level progression no longer depends on confirming it.'}
          }
        ],
        completion:{ requirements:{states:{powerOn:true,observationDoorUnlocked:true}} },
        runtime:{ geometryMode:'engine-authored', expectedFloors:[-1,0,1] }
      },
      {
        id:'L02', ordinal:2, title:'nanpa tu', canonicalGlyphs:foundationL2,
        startArea:'l2Atrium',
        initialStates:{
          l2ArchiveAccess:false, l2MapAccess:false, l2CartographyAccess:false,
          cacheRevealed:false, l2LabAccess:false, l2VaultAccess:false, l2ExitUnlocked:false
        },
        areas:[
          {id:'l2Atrium',name:'Second Atrium',floor:0,worldRef:'l2main',roomRef:'Second Atrium'},
          {id:'l2Workshop',name:'Number Workshop',floor:0,worldRef:'l2main',roomRef:'Number Workshop'},
          {id:'l2Cartography',name:'Cartography Room',floor:0,worldRef:'l2main',roomRef:'Cartography Room'},
          {id:'l2Archive',name:'Lower Archive',floor:0,worldRef:'l2main',roomRef:'Lower Archive'},
          {id:'l2Lab',name:'Notation Laboratory',floor:0,worldRef:'l2main',roomRef:'Notation Laboratory'},
          {id:'l2Vault',name:'Foundation Vault',floor:0,worldRef:'l2main',roomRef:'Foundation Vault'}
        ],
        connections:[
          {id:'l2-atrium-workshop',from:'l2Atrium',to:'l2Workshop',bidirectional:true},
          {id:'l2-atrium-archive',from:'l2Atrium',to:'l2Archive',bidirectional:true,requirements:{states:{l2ArchiveAccess:true}}},
          {id:'l2-workshop-cartography',from:'l2Workshop',to:'l2Cartography',bidirectional:true,requirements:{states:{l2CartographyAccess:true}}},
          {id:'l2-archive-lab',from:'l2Archive',to:'l2Lab',bidirectional:true,requirements:{states:{l2LabAccess:true}}},
          {id:'l2-lab-vault',from:'l2Lab',to:'l2Vault',bidirectional:true,requirements:{states:{l2VaultAccess:true}}},
          {id:'l2-cartography-vault',from:'l2Cartography',to:'l2Vault',bidirectional:true,requirements:{states:{l2VaultAccess:true}}}
        ],
        puzzles:[
          {
            id:'l2-digit-order',chain:'digits',type:'glyph-key-code',area:'l2Atrium',sourceClass:'canonical',
            requirements:{glyphs:['wan','tu','seli','awen','luka']},inputSequence:['wan','tu','seli','awen','luka'],
            rewards:{glyphs:['ijo','utala'],setStates:{l2ArchiveAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l2ArchiveAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Missing edge digits',instructions:'Place the five Level 1 digit glyphs in ascending order. The machine reveals the two edge digits.'}
          },
          {
            id:'l2-country-kana',chain:'bonus-country',type:'country-cartouche',area:'l2Atrium',sourceClass:'bonus',requiredForMinimum:false,
            rewards:{glyphs:['suno']},skipIfRewardsOwned:true,skipSafe:true,
            ui:{presentation:'fullscreen',canExit:true,title:'ma seme?',instructions:'Identify the country, then spell its Toki Pona name using any owned glyph whose word begins with each required letter.',payload:{country:'Ghana',answer:'KANA',clueTp:'ma ni li lon poka suno weka Apika. ona li jo e poka telo suli.',clueEn:'This country is in western Africa. It has a coast on a large body of water.'}}
          },
          {
            id:'l2-archive-sequence',chain:'digits',type:'glyph-key-code',area:'l2Archive',sourceClass:'canonical',
            requirements:{glyphs:['ijo','utala','wan','tu']},inputSequence:['ijo','wan','tu','utala'],
            rewards:{glyphs:['mun','pipi'],setStates:{l2MapAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l2MapAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Archive sequence',instructions:'Use the clue 0 → 1 → 2 → 6 to build the four-glyph sequence.'}
          },
          {
            id:'l2-workshop-stones',chain:'material',type:'glyph-key-code',area:'l2Workshop',sourceClass:'canonical',
            requirements:{glyphs:['ma','awen','tu','wan']},inputSequence:['ma','wan','tu','awen'],
            rewards:{glyphs:['jo','kiwen'],setStates:{l2CartographyAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l2CartographyAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Stone index',instructions:'The placards read MA, then the odd positions 1, 2, 4. Enter that sequence to release the stone key.'}
          },
          {
            id:'l2-map-cache',chain:'map',type:'coordinate-map',area:'l2Cartography',sourceClass:'required-state',
            requirements:{glyphs:['ma','kiwen','nanpa','seli','jo'],states:{l2MapAccess:true}},
            rewards:{setStates:{cacheRevealed:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Coordinate map',instructions:'Mark the grid cell shown by the abbreviated ma coordinate.',objective:'Solve the coordinate map in Cartography.',payload:{source:'ma:(3,9)',targetX:3,targetY:9,gridWidth:10,gridHeight:10}}
          },
          {
            id:'l2-hidden-cache',chain:'map',type:'glyph-key-code',area:'l2Archive',sourceClass:'canonical',
            requirements:{glyphs:['kiwen','ma'],states:{cacheRevealed:true}},inputSequence:['kiwen','ma','kiwen'],
            rewards:{glyphs:['en'],setStates:{l2LabAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l2LabAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Revealed cache',instructions:'The cache displays three sitelen pona glyphs. Enter the same glyphs below in the same order.',objective:'Return to the Lower Archive and inspect the revealed cache.',payload:{displaySequence:['kiwen','ma','kiwen']}}
          },
          {
            id:'l2-thousands',chain:'notation',type:'glyph-key-code',area:'l2Lab',sourceClass:'canonical',
            requirements:{glyphs:['wan','tu','seli','awen']},inputSequence:['wan','tu','seli','awen'],
            rewards:{glyphs:['kulupu']},skipIfRewardsOwned:true,skipSafe:true,
            ui:{presentation:'fullscreen',canExit:true,title:'Thousands grouping',instructions:'Arrange 1, 2, 3, 4 in order. The grouping mechanism reveals the thousands marker.'}
          },
          {
            id:'l2-scientific',chain:'notation',type:'glyph-key-code',area:'l2Lab',sourceClass:'canonical',
            requirements:{glyphs:['nanpa','wan','o','luka','seli','kulupu']},inputSequence:['nanpa',':','wan','o','luka','seli','nanpa'],
            rewards:{glyphs:['kala']},skipIfRewardsOwned:true,skipSafe:true,
            ui:{presentation:'fullscreen',canExit:true,title:'Notation laboratory',instructions:'Build the abbreviated numeric shell shown by the lab clue: 1.53. The solved apparatus reveals the scientific marker.'}
          },
          {
            id:'l2-full-form-bridge',chain:'notation',type:'glyph-key-code',area:'l2Lab',sourceClass:'canonical',
            requirements:{glyphs:['e','en','nanpa','kala']},inputSequence:['e','en','e','nanpa'],
            rewards:{glyphs:['nena'],setStates:{l2VaultAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l2VaultAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Full-form bridge',instructions:'The full-form diagram labels four surviving positions E → EN → E → NANPA. Reconstruct them.'}
          },
          {
            id:'l2-vault-terminal',chain:'finale',type:'terminal',area:'l2Vault',sourceClass:'story',storyCritical:false,requiredForMinimum:false,
            requirements:{glyphs:['ijo','utala','mun','pipi','jo','en','kulupu','kala','nena','kiwen']},
            rewards:{setStates:{l2ExitUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Foundation complete',instructions:'Optional foundation terminal. The level is already complete once all required glyphs and mandatory world-state objectives are satisfied.'}
          }
        ],
        completion:{requirements:{states:{cacheRevealed:true,l2LabAccess:true,l2VaultAccess:true}}},
        runtime:{geometryMode:'engine-authored',expectedFloors:[0]}
      },
      {
        id:'L03', ordinal:3, title:'nanpa seli', canonicalGlyphs:foundationL3,
        startArea:'l3Chronology',
        initialStates:{
          l3RelayAccess:false, l3NavigationAccess:false, l3ObservationAccess:false,
          l3WorkshopAccess:false, l3CoreAccess:false, l3ExitUnlocked:false
        },
        areas:[
          {id:'l3Chronology',name:'Chronology Hall',floor:0,worldRef:'l3main',roomRef:'Chronology Hall'},
          {id:'l3Relay',name:'Relay Gallery',floor:0,worldRef:'l3main',roomRef:'Relay Gallery'},
          {id:'l3Navigation',name:'Navigation Floor',floor:0,worldRef:'l3main',roomRef:'Navigation Floor'},
          {id:'l3Observation',name:'Observation Chamber',floor:0,worldRef:'l3main',roomRef:'Observation Chamber'},
          {id:'l3Workshop',name:'Instrument Workshop',floor:0,worldRef:'l3main',roomRef:'Instrument Workshop'},
          {id:'l3Core',name:'Synchronization Core',floor:0,worldRef:'l3main',roomRef:'Synchronization Core'}
        ],
        connections:[
          {id:'l3-chronology-relay',from:'l3Chronology',to:'l3Relay',bidirectional:true,requirements:{states:{l3RelayAccess:true}}},
          {id:'l3-relay-navigation',from:'l3Relay',to:'l3Navigation',bidirectional:true,requirements:{states:{l3NavigationAccess:true}}},
          {id:'l3-navigation-observation',from:'l3Navigation',to:'l3Observation',bidirectional:true,requirements:{states:{l3ObservationAccess:true}}},
          {id:'l3-observation-workshop',from:'l3Observation',to:'l3Workshop',bidirectional:true,requirements:{states:{l3WorkshopAccess:true}}},
          {id:'l3-workshop-core',from:'l3Workshop',to:'l3Core',bidirectional:true,requirements:{states:{l3CoreAccess:true}}}
        ],
        puzzles:[
          {
            id:'l3-clock-alignment',chain:'time',type:'dial-bank',area:'l3Chronology',sourceClass:'canonical',
            rewards:{glyphs:['tenpo','suno'],setStates:{l3RelayAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l3RelayAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Clock alignment',instructions:'Set the three clock dials so all three clues are true. This is a deduction puzzle; the dials can be changed independently.',payload:{startValues:[0,0,0],targetValues:[4,3,2],clues:['left + middle = 7','middle + right = 5','left + right = 6']}}
          },
          {
            id:'l3-relay-routing',chain:'signal',type:'route-board',area:'l3Relay',sourceClass:'canonical',
            requirements:{states:{l3RelayAccess:true}},
            rewards:{glyphs:['toki','kasi'],setStates:{l3NavigationAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l3NavigationAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Relay routing',instructions:'Rotate the relay pieces to make one continuous signal path from the left input to the right output.',payload:{width:4,height:4,sourceRow:1,sinkRow:2,tiles:[{x:0,y:1,type:'straight',rotation:1},{x:1,y:1,type:'corner',rotation:3},{x:1,y:2,type:'straight',rotation:0},{x:1,y:3,type:'corner',rotation:1},{x:2,y:3,type:'straight',rotation:1},{x:3,y:3,type:'corner',rotation:0},{x:3,y:2,type:'corner',rotation:2}]}}
          },
          {
            id:'l3-path-circuit',chain:'navigation',type:'path-grid',area:'l3Navigation',sourceClass:'canonical',
            requirements:{states:{l3NavigationAccess:true}},
            rewards:{glyphs:['nasin','tawa'],setStates:{l3ObservationAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l3ObservationAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Beacon route',instructions:'Move the marker through checkpoints A, B, C in that order, then reach the exit. Dark cells are blocked.',payload:{width:5,height:5,start:[0,4],exit:[4,0],checkpoints:[[0,2],[2,1],[4,2]],blocks:[[1,4],[2,4],[3,4],[1,3],[3,3],[1,1],[3,1]]}}
          },
          {
            id:'l3-lights-pattern',chain:'observation',type:'lights-out',area:'l3Observation',sourceClass:'canonical',
            requirements:{states:{l3ObservationAccess:true}},
            rewards:{glyphs:['sitelen','sona'],setStates:{l3WorkshopAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l3WorkshopAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Observation lights',instructions:'Make all nine lamps glow. Tapping a lamp also changes its orthogonal neighbours.',payload:{size:3,initial:[0,1,1,1,0,1,1,1,0],target:1}}
          },
          {
            id:'l3-balance-machine',chain:'instrument',type:'balance-scale',area:'l3Workshop',sourceClass:'canonical',
            requirements:{states:{l3WorkshopAccess:true}},
            rewards:{glyphs:['ilo','poka'],setStates:{l3CoreAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l3CoreAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Balance machine',instructions:'Select a combination of the four available weights that exactly balances the target mass. Each weight can be used once.',payload:{weights:[1,2,4,8],target:11}}
          },
          {
            id:'l3-context-match',chain:'finale',type:'context-match',area:'l3Core',sourceClass:'required-state',
            requirements:{glyphs:['tenpo','suno','toki','kasi'],states:{l3CoreAccess:true}},
            rewards:{setStates:{l3ExitUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Synchronization core',instructions:'The wall display is explicitly a time: 03:09. Choose the rendered cartouche that belongs on the time circuit.',payload:{choices:[{source:'03:09'},{source:'--03-09'},{source:'3.09'}],correctIndex:0}}
          }
        ],
        completion:{requirements:{states:{l3ExitUnlocked:true}}},
        runtime:{geometryMode:'engine-authored',expectedFloors:[0]}
      },
      {
        id:'L04', ordinal:4, title:'pali pi sama ante', canonicalGlyphs:foundationL4,
        startArea:'l4Pump',
        initialStates:{
          l4BranchAccess:false, l4StackDone:false, l4CodeDone:false,
          l4RatioDone:false, l4ExitUnlocked:false
        },
        areas:[
          {id:'l4Pump',name:'Pump Hall',floor:0,worldRef:'l4main',roomRef:'Pump Hall'},
          {id:'l4Junction',name:'Machine Junction',floor:0,worldRef:'l4main',roomRef:'Machine Junction'},
          {id:'l4Stack',name:'Stackworks',floor:0,worldRef:'l4main',roomRef:'Stackworks'},
          {id:'l4Code',name:'Codebreaker Lab',floor:0,worldRef:'l4main',roomRef:'Codebreaker Lab'},
          {id:'l4Ratio',name:'Equivalence Gallery',floor:0,worldRef:'l4main',roomRef:'Equivalence Gallery'},
          {id:'l4Schedule',name:'Schedule Archive',floor:0,worldRef:'l4main',roomRef:'Schedule Archive'}
        ],
        connections:[
          {id:'l4-pump-junction',from:'l4Pump',to:'l4Junction',bidirectional:true,requirements:{states:{l4BranchAccess:true}}},
          {id:'l4-junction-stack',from:'l4Junction',to:'l4Stack',bidirectional:true,requirements:{states:{l4BranchAccess:true}}},
          {id:'l4-pump-code',from:'l4Pump',to:'l4Code',bidirectional:true,requirements:{states:{l4BranchAccess:true}}},
          {id:'l4-junction-ratio',from:'l4Junction',to:'l4Ratio',bidirectional:true,requirements:{states:{l4StackDone:true,l4CodeDone:true}}},
          {id:'l4-ratio-schedule',from:'l4Ratio',to:'l4Schedule',bidirectional:true,requirements:{states:{l4RatioDone:true}}}
        ],
        puzzles:[
          {
            id:'l4-jug-transfer',chain:'reservoir',type:'jug-transfer',area:'l4Pump',sourceClass:'canonical',
            rewards:{glyphs:['telo','poki'],setStates:{l4BranchAccess:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l4BranchAccess:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Reservoir measure',instructions:'Measure exactly 4 units of water. You have a 3-unit vessel and a 5-unit vessel; fill, empty, or pour between them.',payload:{capacities:[3,5],target:4}}
          },
          {
            id:'l4-hanoi-stack',chain:'stack',type:'hanoi-stack',area:'l4Stack',sourceClass:'canonical',
            requirements:{states:{l4BranchAccess:true}},
            rewards:{glyphs:['palisa','supa'],setStates:{l4StackDone:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l4StackDone:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Stackworks',instructions:'Move the three discs from the left post to the right post. Move one disc at a time; a larger disc may never sit on a smaller one.',payload:{discCount:3,startRod:0,targetRod:2}}
          },
          {
            id:'l4-codebreaker',chain:'code',type:'codebreaker',area:'l4Code',sourceClass:'canonical',
            requirements:{states:{l4BranchAccess:true}},
            rewards:{glyphs:['kule','lukin'],setStates:{l4CodeDone:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l4CodeDone:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Signal codebreaker',instructions:'Find the four-symbol code. Each test reports how many symbols are in the exact position and how many are correct but in the wrong position.',payload:{symbols:['◆','●','▲','■'],secret:[2,0,3,1],maxHistory:5}}
          },
          {
            id:'l4-equivalence',chain:'ratio',type:'equivalence-grid',area:'l4Ratio',sourceClass:'canonical',
            requirements:{states:{l4StackDone:true,l4CodeDone:true}},
            rewards:{glyphs:['sama','ante'],setStates:{l4RatioDone:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l4RatioDone:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Equivalent quantities',instructions:'Make each row show the same value as a fraction, decimal, and percentage. Tap two cards in the same movable column to swap them.',payload:{
              fractions:[{source:'1/2',value:0.5},{source:'3/4',value:0.75},{source:'1/4',value:0.25}],
              decimals:[{source:'0.25',value:0.25},{source:'0.5',value:0.5},{source:'0.75',value:0.75}],
              percents:[{source:'75%',value:0.75},{source:'25%',value:0.25},{source:'50%',value:0.5}],
              decimalOrder:[0,1,2],percentOrder:[0,1,2]
            }}
          },
          {
            id:'l4-schedule-order',chain:'schedule',type:'schedule-order',area:'l4Schedule',sourceClass:'canonical',
            requirements:{states:{l4RatioDone:true}},
            rewards:{glyphs:['open','pini'],setStates:{l4ExitUnlocked:true}},skipIfRewardsOwned:true,skipSafe:true,
            alreadyOwnedEffects:{setStates:{l4ExitUnlocked:true}},
            ui:{presentation:'fullscreen',canExit:true,title:'Schedule archive',instructions:'Put the four events in chronological order, earliest at the top. Read both the suno date cartouche and the tenpo time cartouche.',payload:{
              events:[
                {id:'A',sort:'2026-04-03T09:15',dateSource:'2026-04-03',timeSource:'09:15'},
                {id:'B',sort:'2026-04-03T14:30',dateSource:'2026-04-03',timeSource:'14:30'},
                {id:'C',sort:'2026-04-05T08:00',dateSource:'2026-04-05',timeSource:'08:00'},
                {id:'D',sort:'2026-04-10T17:45',dateSource:'2026-04-10',timeSource:'17:45'}
              ],
              initialOrder:[2,0,3,1],targetOrder:[0,1,2,3]
            }}
          }
        ],
        completion:{requirements:{states:{l4ExitUnlocked:true}}},
        runtime:{geometryMode:'engine-authored',expectedFloors:[0]}
      }
    ]
  };

  const ctor = root.TokiPonaCampaignConstructor;
  root.TOKI_PONA_CAMPAIGN_BLUEPRINT = blueprint;
  root.TOKI_PONA_CAMPAIGN = ctor ? ctor.constructCampaign(blueprint) : blueprint;
  if (typeof module === 'object' && module.exports) module.exports = { blueprint, campaign:root.TOKI_PONA_CAMPAIGN };
})(typeof globalThis !== 'undefined' ? globalThis : this);
