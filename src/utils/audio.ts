// Robust audio management with preloading
const audioPool: Record<string, HTMLAudioElement> = {
  success: new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3'),
  tick: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
  delete: new Audio('https://assets.mixkit.co/active_storage/sfx/256/256-preview.mp3'),
  cash: new Audio('https://assets.mixkit.co/active_storage/sfx/514/514-preview.mp3'),
  notification: new Audio('https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3'),
};

// Preload all sounds
Object.values(audioPool).forEach(audio => {
  audio.load();
});

let isMuted = false;

export const setAudioMuted = (muted: boolean) => {
  isMuted = muted;
};

const playFromPool = (name: string, volume: number = 0.5) => {
  if (isMuted) return;
  console.info(`[AUDIO] Attempting to play: ${name}`);
  const audio = audioPool[name];
  if (audio) {
    try {
      audio.volume = volume;
      audio.currentTime = 0; // Restart if already playing
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Audio ${name} playback failed:`, error);
        });
      }
    } catch (error) {
      console.error(`Error playing ${name}:`, error);
    }
  }
};

// SILENT BEEP to unlock browser audio on first interaction
const silentBeep = 'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAD//w==';

export const initAudio = () => {
  console.info('Unlocking audio engine...');
  const audio = new Audio(silentBeep);
  audio.play().catch(e => console.warn('Audio unlock failed:', e));
  
  // Also preload others
  Object.values(audioPool).forEach(a => a.load());
};

export const playSuccessSound = () => playFromPool('success', 0.5);
export const playTickSound = () => playFromPool('tick', 0.3);
export const playDeleteSound = () => playFromPool('delete', 0.6);
export const playRemoveItemSound = () => {}; // Disabled per user request
export const playCashSound = () => playFromPool('cash', 0.6);
export const playNotificationSound = () => playFromPool('notification', 0.3);
