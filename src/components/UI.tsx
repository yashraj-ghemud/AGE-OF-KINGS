import { useGameStore, CAMPAIGN_NODES, mutableGameState } from '../store/gameStore';
import { Sword, Shield, Target, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

export function UI() {
  const {
    screen,
    campaignNodeId,
    playerHealth,
    playerMaxHealth,
    currentWeapon,
    enemiesCount,
    friendliesCount,
    attackMode,
    captureState,
    isRescueSpawned,
    paused,
    setPaused,
    setScreen,
    initLevel
  } = useGameStore();

  const [pointerLockFailed, setPointerLockFailed] = useState(false);

  useEffect(() => {
    if (screen !== 'playing') return;

    const interval = setInterval(() => {
      const locked = !!document.pointerLockElement;
      if (locked && paused) {
        setPaused(false);
      } else if (!locked && !pointerLockFailed && !paused) {
        setPaused(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [screen, paused, pointerLockFailed, setPaused]);

  const handleResume = async () => {
    try {
      if (document.body.requestPointerLock) {
        // Some browsers return a promise
        const promise = document.body.requestPointerLock();
        if (promise) {
          await promise;
        }
        setTimeout(() => {
          if (!document.pointerLockElement) {
            setPointerLockFailed(true);
            setPaused(false);
          }
        }, 500);
      } else {
        setPointerLockFailed(true);
        setPaused(false);
      }
    } catch (e) {
      console.error("Pointer lock failed", e);
      setPointerLockFailed(true);
      setPaused(false);
    }
  };

  if (screen === 'menu') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white z-10">
        <h1 className="text-6xl font-serif font-bold mb-8 text-yellow-500 tracking-widest uppercase">Age of Kings</h1>
        <p className="text-xl mb-12 text-zinc-400 max-w-lg text-center">
          Explore the open world, find enemy castles, and defeat their kings.
        </p>
        <button
          onClick={() => setScreen('campaign')}
          className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-2xl rounded shadow-lg transition-transform hover:scale-105"
        >
          Start Campaign
        </button>
      </div>
    );
  }

  if (screen === 'campaign') {
    const node = CAMPAIGN_NODES[campaignNodeId] || CAMPAIGN_NODES['start'];
    
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-white z-10 p-8">
        <div className="max-w-4xl w-full bg-zinc-800 rounded-xl shadow-2xl overflow-hidden border border-zinc-700">
          <div className="bg-zinc-950 p-8 border-b border-zinc-700">
            <div className="flex items-center gap-4 mb-4">
              {node.type === 'invasion' && <Sword className="text-red-500 w-10 h-10" />}
              {node.type === 'defense' && <ShieldAlert className="text-blue-500 w-10 h-10" />}
              {node.type === 'diplomacy' && <Users className="text-green-500 w-10 h-10" />}
              <h2 className="text-4xl font-serif font-bold text-yellow-500">{node.title}</h2>
            </div>
            <p className="text-xl text-zinc-300 leading-relaxed">{node.description}</p>
          </div>
          
          <div className="p-8 bg-zinc-800/50 flex justify-center">
            <button
              onClick={() => initLevel(node.id)}
              className="px-12 py-6 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-3xl rounded-lg shadow-lg transition-transform hover:scale-105"
            >
              Start Battle
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'won' || screen === 'lost') {
    const isWin = screen === 'won';
    const node = CAMPAIGN_NODES[campaignNodeId] || CAMPAIGN_NODES['start'];
    const isFinal = node.choices.length === 0;

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 backdrop-blur-sm p-8">
        <h2 className={`text-6xl font-serif font-bold mb-4 ${isWin ? 'text-yellow-500' : 'text-red-500'}`}>
          {isWin ? 'Victory!' : 'Defeat'}
        </h2>
        <p className="text-xl mb-12 text-zinc-300">
          {isWin 
            ? (isFinal ? 'You have conquered the world and reunited the kingdom.' : 'The battle is won, but the war continues. Choose your next path:')
            : 'Your king has fallen in battle.'}
        </p>
        
        {isWin && !isFinal && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl w-full mb-12">
            {node.choices.map((choice, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setScreen('campaign');
                  useGameStore.getState().setCampaignNodeId(choice.nextNodeId);
                }}
                className="flex flex-col items-start p-6 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-600 hover:border-yellow-500 transition-all text-left group"
              >
                <span className="text-lg font-medium text-white group-hover:text-yellow-400 mb-2">{choice.text}</span>
                <span className="text-sm text-zinc-400">Proceed to next region</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => {
              setScreen('menu');
              useGameStore.getState().setCampaignNodeId('start');
            }}
            className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-white font-medium"
          >
            Main Menu
          </button>
          {!isWin && (
            <button
              onClick={() => initLevel(campaignNodeId)}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Playing HUD
  return (
    <>
      {paused && screen === 'playing' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={handleResume}>
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Game Paused</h2>
            <p className="text-zinc-300 mb-8">Click anywhere to resume and lock mouse</p>
            <button className="px-6 py-3 bg-yellow-600 text-black font-bold rounded hover:bg-yellow-500">
              Resume Game
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          {/* Player Stats */}
          <div className="bg-black/50 backdrop-blur p-4 rounded-lg border border-white/10 w-64">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-yellow-500 font-serif font-bold text-xl">King (You)</h3>
              {captureState !== 'free' && (
                <span className="text-xs font-bold uppercase px-2 py-1 bg-red-600 text-white rounded animate-pulse">
                  {captureState}
                </span>
              )}
            </div>
            <div className="h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${Math.max(0, (playerHealth / playerMaxHealth) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-zinc-400 mt-1 text-right">{Math.ceil(playerHealth)} / {playerMaxHealth}</div>
          </div>

          {/* Battle Stats */}
          <div className="flex gap-4">
            <div className="bg-blue-900/50 backdrop-blur px-6 py-3 rounded-lg border border-blue-500/30 text-center relative">
              {attackMode && (
                <div className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-red-400 animate-bounce">
                  ATTACKING
                </div>
              )}
              {!attackMode && mutableGameState.playerState?.formation === 'protect' && (
                <div className="absolute -top-3 -right-3 bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-yellow-400 animate-pulse">
                  PROTECTING
                </div>
              )}
              <div className="text-blue-300 text-sm uppercase tracking-wider font-bold">Your Army</div>
              <div className="text-3xl font-bold text-white">{friendliesCount}</div>
            </div>
            <div className="bg-red-900/50 backdrop-blur px-6 py-3 rounded-lg border border-red-500/30 text-center">
              <div className="text-red-300 text-sm uppercase tracking-wider font-bold">Enemy Army</div>
              <div className="text-3xl font-bold text-white">{enemiesCount}</div>
            </div>
          </div>
        </div>

        {/* Center Screen Messages */}
        {captureState === 'jailed' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-black/80 p-8 rounded-xl border-2 border-red-500 text-center animate-pulse">
              <h2 className="text-4xl font-bold text-red-500 mb-4 uppercase tracking-widest">You are Jailed!</h2>
              {!isRescueSpawned ? (
                <p className="text-xl text-white">Press <kbd className="bg-zinc-800 px-2 py-1 rounded border border-zinc-700 mx-1">Alt</kbd> to call your army for rescue.</p>
              ) : (
                <p className="text-xl text-green-400 font-bold">Rescue party is on the way!</p>
              )}
            </div>
          </div>
        )}

        {/* Bottom Bar - Weapons & Controls */}
        <div className="flex justify-between items-end">
          <div className="bg-black/50 backdrop-blur p-4 rounded-lg border border-white/10">
            <div className="text-xs text-zinc-400 mb-2 uppercase tracking-wider font-bold">Controls</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-zinc-300">
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">W A S D</kbd> Move</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Click</kbd> Attack</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">1 2 3</kbd> Switch Weapon</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">F</kbd> Toggle Rally Point</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">G</kbd> Spawn Unit</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Ctrl</kbd> Attack Mode</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Shift</kbd> Protect King</div>
              <div><kbd className="bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Alt</kbd> Call Backup</div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            {/* Abilities */}
            <div className="flex gap-4">
              <AbilitySlot keyName="Q" name="Rally" cd={0} maxCd={1} color="bg-yellow-600" />
              <AbilitySlot keyName="E" name="Charge" cd={0} maxCd={1} color="bg-blue-600" />
              <AbilitySlot keyName="R" name="Slam" cd={0} maxCd={1} color="bg-red-600" />
            </div>

            {/* Weapons */}
            <div className="flex gap-2">
              <WeaponSlot num="1" type="sword" active={currentWeapon === 'sword'} icon={<Sword size={24} />} />
              <WeaponSlot num="2" type="spear" active={currentWeapon === 'spear'} icon={<Shield size={24} />} />
              <WeaponSlot num="3" type="bow" active={currentWeapon === 'bow'} icon={<Target size={24} />} />
            </div>
          </div>
        </div>
        
        {/* Crosshair */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full" />
      </div>
    </>
  );
}

function WeaponSlot({ num, active, icon }: { num: string, type: string, active: boolean, icon: React.ReactNode }) {
  return (
    <div className={`relative w-16 h-16 rounded-lg flex items-center justify-center border-2 transition-all ${
      active ? 'bg-yellow-600/20 border-yellow-500 text-yellow-500 scale-110' : 'bg-black/50 border-white/10 text-zinc-500'
    }`}>
      <div className="absolute top-1 left-1.5 text-xs font-bold opacity-50">{num}</div>
      {icon}
    </div>
  );
}

function AbilitySlot({ keyName, name, cd, maxCd, color }: { keyName: string, name: string, cd: number, maxCd: number, color: string }) {
  const percent = cd > 0 ? (cd / maxCd) * 100 : 0;
  const isReady = cd <= 0;

  return (
    <div className={`relative w-16 h-16 rounded-lg flex flex-col items-center justify-center border-2 overflow-hidden transition-all ${
      isReady ? `${color} border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.5)]` : 'bg-zinc-800 border-zinc-700 text-zinc-500'
    }`}>
      {/* Cooldown overlay */}
      {!isReady && (
        <div
          className="absolute bottom-0 left-0 w-full bg-black/60 transition-all duration-100"
          style={{ height: `${percent}%` }}
        />
      )}
      <div className="absolute top-1 left-1.5 text-xs font-bold z-10">{keyName}</div>
      <div className="text-xs font-bold z-10 mt-2">{name}</div>
      {!isReady && <div className="absolute inset-0 flex items-center justify-center text-xl font-bold z-20 text-white drop-shadow-md">{Math.ceil(cd)}</div>}
    </div>
  );
}
