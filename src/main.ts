import { loadSaveData, writeSaveData } from './storage';
import { SwearAudioManager } from './audio';
import { CommuterRageGame } from './game';
import { ReceiptStats } from './receipt';

async function bootstrap() {
  const saveData = loadSaveData();
  saveData.censorMode = 'uncensored';
  const audio = new SwearAudioManager();
  await audio.init();
  audio.setCensorMode('uncensored');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const startOverlay = document.getElementById('start-overlay')!;
  const overlayTitle = document.getElementById('overlay-title')!;
  const overlaySub = document.getElementById('overlay-sub')!;
  const btnStartRun = document.getElementById('btn-start-run')!;
  const btnMute = document.getElementById('btn-mute')!;
  const hudScore = document.getElementById('hud-score')!;
  const hudBest = document.getElementById('hud-best')!;

  const game = new CommuterRageGame(canvas, audio, saveData, {
    onHudUpdate: (hud) => {
      hudScore.textContent = `${hud.score.toLocaleString()}`;
      hudBest.textContent = `${hud.highScore.toLocaleString()}`;
    },
    onGameOver: (stats: ReceiptStats) => {
      writeSaveData(saveData);
      overlayTitle.textContent = 'GAME OVER';
      overlaySub.textContent = `SCORE: ${stats.score.toLocaleString()}  •  SWEARS: ${stats.totalSwears}`;
      btnStartRun.textContent = 'PLAY AGAIN';
      startOverlay.classList.remove('hidden');
    },
  });

  // Unlock Mobile Web Audio API on first user touch/click anywhere
  const unlockAudioOnce = () => {
    audio.unlockAudioOnGesture();
  };
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
  window.addEventListener('touchstart', unlockAudioOnce, { passive: true });

  // Mute Button
  btnMute.addEventListener('click', (e) => {
    e.stopPropagation();
    const nextMute = !audio.isMuted();
    audio.setMuted(nextMute);
    btnMute.innerHTML = nextMute ? '&#128263;' : '&#128266;';
  });

  // Start / Restart Run
  function launchRun() {
    audio.unlockAudioOnGesture();
    startOverlay.classList.add('hidden');
    game.startNewRun();
  }

  btnStartRun.addEventListener('click', (e) => {
    e.stopPropagation();
    launchRun();
  });

  startOverlay.addEventListener('pointerdown', (e) => {
    if (e.target === btnStartRun) return;
    e.preventDefault();
    launchRun();
  });

  // Keyboard Controls
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) {
        if (!startOverlay.classList.contains('hidden')) {
          launchRun();
        } else {
          game.pressJump();
        }
      }
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      game.setSlide(true);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      game.releaseJump();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      game.setSlide(false);
    }
  });

  // Canvas Touch / Swipe & Pointer Controls (Tap to Jump, Swipe Down on ground to Slide!)
  let touchStartY: number | null = null;
  let isSwipingSlide = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    audio.unlockAudioOnGesture();
    touchStartY = e.clientY;
    isSwipingSlide = false;
    if (game.isActiveRun()) {
      game.pressJump();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (touchStartY === null || !game.isActiveRun()) return;
    const dy = e.clientY - touchStartY;
    if (dy > 32 && !isSwipingSlide) {
      isSwipingSlide = true;
      game.releaseJump();
      game.setSlide(true);
    }
  });

  const endCanvasPointer = () => {
    touchStartY = null;
    if (game.isActiveRun()) {
      game.releaseJump();
      if (isSwipingSlide) {
        isSwipingSlide = false;
        game.setSlide(false);
      }
    }
  };

  canvas.addEventListener('pointerup', endCanvasPointer);
  canvas.addEventListener('pointercancel', endCanvasPointer);
}

bootstrap();
