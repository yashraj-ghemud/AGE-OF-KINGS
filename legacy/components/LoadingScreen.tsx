import { useProgress } from '@react-three/drei';
import { Sword, Shield, Flame, Crosshair } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LoadingScreen() {
  const { active, progress } = useProgress();
  const [show, setShow] = useState(true);
  const [loadingText, setLoadingText] = useState('Muster the Army...');
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (active) setHasStarted(true);
  }, [active]);

  useEffect(() => {
    if (progress < 30) setLoadingText('Forging Weapons...');
    else if (progress < 60) setLoadingText('Training Soldiers...');
    else if (progress < 90) setLoadingText('Building Castles...');
    else setLoadingText('Ready for Battle!');
  }, [progress]);

  useEffect(() => {
    // Hide if progress is 100, or if it's not active and either we never started (no assets) or we finished
    if (progress >= 100 || (!active && hasStarted) || (!active && progress === 0)) {
      const t = setTimeout(() => setShow(false), 1500);
      return () => clearTimeout(t);
    } else {
      setShow(true);
    }
  }, [active, progress, hasStarted]);

  if (!show) return null;

  // Use a visual progress that goes to 100 if we're hiding
  const visualProgress = (!active && progress === 0) ? 100 : progress;

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white transition-opacity duration-1000 ${(!show || visualProgress >= 100 && !active) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      <div className="relative flex items-center justify-center mb-16">
        {/* Background glow */}
        <div className="absolute inset-0 bg-red-900/20 blur-3xl rounded-full w-64 h-64 animate-pulse" />
        
        {/* Crossed Swords Animation */}
        <div className="relative z-10 flex items-center justify-center">
          <Sword 
            className={`w-32 h-32 text-zinc-600 absolute transition-all duration-700 ${visualProgress > 20 ? 'text-zinc-300 rotate-45' : 'translate-y-10 opacity-0'}`} 
          />
          <Sword 
            className={`w-32 h-32 text-zinc-600 absolute transition-all duration-700 delay-150 ${visualProgress > 40 ? 'text-zinc-300 -rotate-45 scale-x-[-1]' : 'translate-y-10 opacity-0'}`} 
          />
          <Shield 
            className={`w-40 h-40 text-yellow-600 absolute transition-all duration-700 delay-300 ${visualProgress > 60 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} 
          />
          <Flame 
            className={`w-20 h-20 text-orange-500 absolute transition-all duration-700 delay-500 ${visualProgress > 80 ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-0'}`} 
          />
        </div>
      </div>
      
      <h1 className="text-4xl font-serif font-bold text-yellow-600 mb-12 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(202,138,4,0.5)]">
        {visualProgress >= 100 ? 'Ready for Battle!' : loadingText}
      </h1>
      
      {/* Custom Combat Progress Indicator */}
      <div className="flex items-center gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="relative w-12 h-12 flex items-center justify-center">
            <div className={`absolute inset-0 border-2 rounded-sm transform rotate-45 transition-colors duration-500 ${visualProgress > i * 20 ? 'border-red-600 bg-red-900/30' : 'border-zinc-800 bg-zinc-900'}`} />
            <Crosshair className={`w-6 h-6 relative z-10 transition-colors duration-500 ${visualProgress > i * 20 ? 'text-red-500' : 'text-zinc-700'}`} />
          </div>
        ))}
      </div>
      
      <div className="mt-8 text-zinc-500 font-mono text-lg font-bold tracking-widest">
        {Math.round(visualProgress)}%
      </div>
    </div>
  );
}
