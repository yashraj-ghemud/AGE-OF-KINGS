import { Game } from './components/Game';
import { UI } from './components/UI';
import { LoadingScreen } from './components/LoadingScreen';
import { useEffect } from 'react';
import { SoundManager } from './utils/SoundManager';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    try {
      SoundManager.init();
    } catch (e) {
      console.error('SoundManager init failed:', e);
    }
    
    const handleInteraction = () => {
      try {
        SoundManager.playMusic();
      } catch (e) {
        console.error('SoundManager playMusic failed:', e);
      }
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      SoundManager.stopMusic();
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="relative w-full h-full bg-zinc-900 overflow-hidden font-sans">
        <LoadingScreen />
        <Game />
        <UI />
      </div>
    </ErrorBoundary>
  );
}
