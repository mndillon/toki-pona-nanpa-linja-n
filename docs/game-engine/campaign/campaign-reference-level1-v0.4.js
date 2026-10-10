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

  // Common Sitelen Pona 2026 glyphs outside the original 120 are baseline
  // capabilities. They are available from the start, can be reused in any puzzle,
  // and never count toward the 120-glyph collection quest.
  const COMMON_2026_BASELINE_GLYPHS = [
    'namako','kin','oko','kipisi','leko','monsuta','tonsi','jasima','kijetesantakalu','soko','meso','epiku',
    'kokosila','lanpan','n','misikeke','ku','pake','apeja','majuna','powe','linluwi','kiki','su'
  ];

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
      saveSystem: 'indexeddb'
    },
    levels: [{
      id: 'L01',
      ordinal: 1,
      title: 'First circuits',
      canonicalGlyphs: ['o','e','pana','li','lon','open','anpa','wawa','lupa','sewi'],
      startArea: 'entry',
      initialStates: {
        workshopDoorOpen: false,
        mazeEntranceUnlocked: false,
        mazeExitReleased: false,
        upperAccess: false,
        maintenanceAccess: false,
        powerOn: false,
        innerMazeDoorUnlocked: false,
        innerMazeClueRecovered: false,
        observationDoorUnlocked: false,
        exitUnlocked: false
      },
      areas: [
        { id:'entry', name:'Entry Chamber', floor:0, worldRef:'main', roomRef:'Entry Chamber' },
        { id:'workshop', name:'Workshop', floor:0, worldRef:'main', roomRef:'Workshop' },
        { id:'concourse', name:'Lower Concourse', floor:0, worldRef:'main', roomRef:'Lower Concourse' },
        { id:'mazeHub', name:'Maze Hub', floor:0, worldRef:'maze', roomRef:'Maze Hub', tags:['maze'] },
        { id:'mazeA', name:'Maze dead end A', floor:0, worldRef:'maze', roomRef:'Dead End A', tags:['maze','dead-end'] },
        { id:'mazeB', name:'Maze dead end B', floor:0, worldRef:'maze', roomRef:'Dead End B', tags:['maze','dead-end'] },
        { id:'mazeC', name:'Maze dead end C', floor:0, worldRef:'maze', roomRef:'Dead End C', tags:['maze','dead-end'] },
        { id:'mazeInner', name:'Sealed maze chamber', floor:0, worldRef:'maze', roomRef:'Inner Chamber', tags:['maze','delayed-return'] },
        { id:'upper', name:'Upper Gallery', floor:1, worldRef:'upper', roomRef:'Upper Gallery' },
        { id:'maintenance', name:'Maintenance Level', floor:-1, worldRef:'lower', roomRef:'Maintenance Level' },
        { id:'observation', name:'Observation Room', floor:1, worldRef:'upper', roomRef:'Observation Room' }
      ],
      connections: [
        { id:'entry-workshop', from:'entry', to:'workshop', bidirectional:true },
        { id:'workshop-concourse', from:'workshop', to:'concourse', bidirectional:true, kind:'door', requirements:{states:{workshopDoorOpen:true}} },
        // Entering the maze can trap the player until the code releases a separate return edge.
        { id:'maze-enter', from:'concourse', to:'mazeHub', bidirectional:false, kind:'maze-door', requirements:{states:{mazeEntranceUnlocked:true}} },
        { id:'maze-exit', from:'mazeHub', to:'concourse', bidirectional:false, kind:'maze-door-return', requirements:{states:{mazeExitReleased:true}} },
        { id:'maze-a', from:'mazeHub', to:'mazeA', bidirectional:true },
        { id:'maze-b', from:'mazeHub', to:'mazeB', bidirectional:true },
        { id:'maze-c', from:'mazeHub', to:'mazeC', bidirectional:true },
        { id:'maze-inner', from:'mazeHub', to:'mazeInner', bidirectional:true, kind:'locked-inner-door', requirements:{states:{innerMazeDoorUnlocked:true}} },
        { id:'concourse-upper', from:'concourse', to:'upper', bidirectional:true, kind:'lift', requirements:{states:{upperAccess:true}} },
        { id:'upper-maintenance', from:'upper', to:'maintenance', bidirectional:true, kind:'trapdoor', requirements:{states:{maintenanceAccess:true}} },
        { id:'upper-observation', from:'upper', to:'observation', bidirectional:true, kind:'powered-glyph-door', requirements:{glyphs:['sewi'], states:{powerOn:true,observationDoorUnlocked:true}} }
      ],
      puzzles: [
        {
          id:'intro-o', chain:'intro', type:'pickup', area:'entry', sourceClass:'canonical',
          rewards:{glyphs:['o']},
          skipIfRewardsOwned:true, skipSafe:true,
          ui:{presentation:'world',title:'Recover o'}
        },
        {
          id:'intro-e', chain:'intro', type:'pickup', area:'entry', sourceClass:'canonical',
          rewards:{glyphs:['e']},
          skipIfRewardsOwned:true, skipSafe:true,
          ui:{presentation:'world',title:'Recover e'}
        },
        {
          id:'ball-table', chain:'workshop', type:'world-action', area:'workshop', sourceClass:'canonical',
          requirements:{glyphs:['o','e']},
          rewards:{glyphs:['pana'],setStates:{workshopDoorOpen:true,mazeEntranceUnlocked:true}},
          skipIfRewardsOwned:true, skipSafe:true,
          alreadyOwnedEffects:{setStates:{workshopDoorOpen:true,mazeEntranceUnlocked:true}},
          ui:{presentation:'world',title:'o pana e sike lon supa',instructions:'Put the ball on the table.'}
        },
        {
          id:'maze-dead-a', chain:'maze', type:'pickup', area:'mazeA', sourceClass:'canonical',
          rewards:{glyphs:['li']}, skipIfRewardsOwned:true, skipSafe:true,
          ui:{presentation:'world',title:'Maze glyph A'}
        },
        {
          id:'maze-dead-b', chain:'maze', type:'pickup', area:'mazeB', sourceClass:'canonical',
          rewards:{glyphs:['lon']}, skipIfRewardsOwned:true, skipSafe:true,
          ui:{presentation:'world',title:'Maze glyph B'}
        },
        {
          id:'maze-dead-c', chain:'maze', type:'pickup', area:'mazeC', sourceClass:'canonical',
          rewards:{glyphs:['open']}, skipIfRewardsOwned:true, skipSafe:true,
          ui:{presentation:'world',title:'Maze glyph C'}
        },
        {
          id:'maze-exit-code', chain:'maze', type:'glyph-key-code', area:'mazeHub', sourceClass:'canonical',
          requirements:{glyphs:['li','lon','open']}, inputSequence:['li','lon','open'],
          rewards:{glyphs:['anpa'],setStates:{mazeExitReleased:true,upperAccess:true}},
          skipIfRewardsOwned:true, skipSafe:true,
          alreadyOwnedEffects:{setStates:{mazeExitReleased:true,upperAccess:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Maze door code',instructions:'Place the three recovered maze glyphs in marker order 1 → 2 → 3.'}
        },
        {
          id:'upper-wawa-sentence', chain:'upper', type:'sentence-fill', area:'upper', sourceClass:'canonical',
          requirements:{glyphs:['li','lon','anpa']}, inputSequence:['wawa','li','lon','anpa'],
          rewards:{glyphs:['wawa'],setStates:{maintenanceAccess:true}},
          skipIfRewardsOwned:true, skipSafe:true,
          alreadyOwnedEffects:{setStates:{maintenanceAccess:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Upper inscription',instructions:'Complete the sentence using owned glyph keys.'}
        },
        {
          id:'maintenance-power', chain:'power', type:'glyph-machine', area:'maintenance', sourceClass:'canonical',
          requirements:{glyphs:['wawa']}, inputSequence:['wawa'],
          rewards:{glyphs:['lupa'],setStates:{powerOn:true,innerMazeDoorUnlocked:true}},
          skipIfRewardsOwned:true, skipSafe:true,
          alreadyOwnedEffects:{setStates:{powerOn:true,innerMazeDoorUnlocked:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Restore power',instructions:'Use wawa as the machine key.'}
        },
        {
          id:'inner-maze-clue', chain:'return', type:'glyph-key-panel', area:'mazeInner', sourceClass:'required-state',
          requirements:{glyphs:['lupa'],states:{powerOn:true}}, inputSequence:['lupa'],
          rewards:{setStates:{innerMazeClueRecovered:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Sealed chamber',instructions:'Inspect the powered mechanism and recover the clue.'}
        },
        {
          id:'entry-sewi-sentence', chain:'return', type:'sentence-fill', area:'entry', sourceClass:'canonical',
          requirements:{glyphs:['o','open','e','lupa'],states:{innerMazeClueRecovered:true}}, inputSequence:['o','open','e','lupa','sewi'],
          rewards:{glyphs:['sewi'],setStates:{observationDoorUnlocked:true}},
          skipIfRewardsOwned:true, skipSafe:true,
          alreadyOwnedEffects:{setStates:{observationDoorUnlocked:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Entry inscription',instructions:'Complete the sentence using reusable glyph keys.'}
        },
        {
          id:'observation-terminal', chain:'finale', type:'terminal', area:'observation', sourceClass:'story', storyCritical:true,
          requirements:{glyphs:['sewi'],states:{powerOn:true,innerMazeClueRecovered:true}},
          rewards:{setStates:{exitUnlocked:true}},
          ui:{presentation:'fullscreen',canExit:true,title:'Observation terminal',instructions:'Confirm the restored system.'}
        }
      ],
      completion:{
        exitArea:'observation',
        requirements:{states:{exitUnlocked:true}}
      },
      runtime:{
        geometryMode:'engine-authored',
        expectedFloors:[-1,0,1],
        note:'Area/worldRef values map campaign topology onto the existing first-person renderer. Puzzle modules own the screen while active.'
      }
    }]
  };

  const ctor = root.TokiPonaCampaignConstructor;
  root.TOKI_PONA_CAMPAIGN_BLUEPRINT = blueprint;
  root.TOKI_PONA_CAMPAIGN = ctor ? ctor.constructCampaign(blueprint) : blueprint;
  if (typeof module === 'object' && module.exports) module.exports = { blueprint, campaign:root.TOKI_PONA_CAMPAIGN };
})(typeof globalThis !== 'undefined' ? globalThis : this);
