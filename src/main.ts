import { CensorMode } from './types';
import { SKINS } from './constants';
import { loadSaveData, writeSaveData } from './storage';
import { SwearAudioManager } from './audio';
import { CommuterRageGame } from './game';
import { renderReceiptToCanvas, ReceiptStats } from './receipt';

async function bootstrap() {
  const saveData = loadSaveData();
  const audio = new SwearAudioManager();
  await audio.init();
  audio.setCensorMode(saveData.censorMode);

  // DOM Elements
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const startOverlay = document.getElementById('start-overlay')!;
  const btnStartRun = document.getElementById('btn-start-run')!;
  const btnOpenSoundboardHero = document.getElementById('btn-open-soundboard-hero')!;

  // Topbar Controls
  const censorBtns = document.querySelectorAll<HTMLButtonElement>('.censor-btn');
  const btnSoundboard = document.getElementById('btn-soundboard')!;
  const customClipCountEl = document.getElementById('custom-clip-count')!;
  const btnSkins = document.getElementById('btn-skins')!;
  const skinCoffeeCountEl = document.getElementById('skin-coffee-count')!;
  const btnMute = document.getElementById('btn-mute')!;

  // HUD Elements
  const hudZone = document.getElementById('hud-zone')!;
  const hudBp = document.getElementById('hud-bp')!;
  const hudFine = document.getElementById('hud-fine')!;
  const hudCombo = document.getElementById('hud-combo')!;
  const hudSwears = document.getElementById('hud-swears')!;
  const hudScore = document.getElementById('hud-score')!;
  const hudBest = document.getElementById('hud-best')!;

  // Modals
  const modalSoundboard = document.getElementById('modal-soundboard')!;
  const closeSoundboard = document.getElementById('close-soundboard')!;
  const dropZone = document.getElementById('drop-zone')!;
  const audioFileInput = document.getElementById('audio-file-input') as HTMLInputElement;
  const micLabelInput = document.getElementById('mic-label-input') as HTMLInputElement;
  const btnRecordMic = document.getElementById('btn-record-mic')!;
  const customClipList = document.getElementById('custom-clip-list')!;
  const clipStatusNote = document.getElementById('clip-status-note')!;

  const modalSkins = document.getElementById('modal-skins')!;
  const closeSkins = document.getElementById('close-skins')!;
  const shopCoffeeBalance = document.getElementById('shop-coffee-balance')!;
  const skinGrid = document.getElementById('skin-grid')!;

  const modalReceipt = document.getElementById('modal-receipt')!;
  const closeReceipt = document.getElementById('close-receipt')!;
  const receiptCanvas = document.getElementById('receipt-canvas') as HTMLCanvasElement;
  const btnPlayAgain = document.getElementById('btn-play-again')!;
  const btnDownloadReceipt = document.getElementById('btn-download-receipt')!;

  // Touch Controls
  const touchJump = document.getElementById('touch-jump')!;
  const touchSlide = document.getElementById('touch-slide')!;

  // Initialize Game Instance
  const game = new CommuterRageGame(canvas, audio, saveData, {
    onHudUpdate: (hud) => {
      hudZone.textContent =
        hud.zone === 'suburb'
          ? '1. SUBURB CHAOS'
          : hud.zone === 'downtown'
          ? '2. DOWNTOWN RUSH'
          : '3. SUBWAY MADNESS';
      hudBp.textContent = hud.bloodPressure;
      hudFine.textContent = `$${hud.totalFine.toLocaleString()}`;
      hudCombo.textContent = `x${hud.combo}`;
      hudSwears.textContent = `${hud.swearsCount}`;
      hudScore.textContent = `${hud.score.toLocaleString()}`;
      hudBest.textContent = `${hud.highScore.toLocaleString()}`;
      skinCoffeeCountEl.textContent = `${hud.coffeeBeans}`;
    },
    onGameOver: (stats: ReceiptStats) => {
      writeSaveData(saveData);
      renderReceiptToCanvas(receiptCanvas, stats);
      modalReceipt.classList.remove('hidden');
    },
  });

  // Unlock Mobile Web Audio API on first user touch/click anywhere
  const unlockAudioOnce = () => {
    audio.unlockAudioOnGesture();
  };
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
  window.addEventListener('touchstart', unlockAudioOnce, { passive: true });

  // Sync Censor Buttons UI
  function syncCensorUI() {
    censorBtns.forEach((btn) => {
      const mode = btn.dataset.censor as CensorMode;
      btn.classList.toggle('active', mode === saveData.censorMode);
    });
  }
  syncCensorUI();

  censorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.censor as CensorMode;
      saveData.censorMode = mode;
      audio.setCensorMode(mode);
      writeSaveData(saveData);
      syncCensorUI();
    });
  });

  // Mute Button
  btnMute.addEventListener('click', () => {
    const nextMute = !audio.isMuted();
    audio.setMuted(nextMute);
    btnMute.innerHTML = nextMute ? '&#128263;' : '&#128266;';
  });

  // Start Run Actions
  function launchRun() {
    audio.unlockAudioOnGesture();
    startOverlay.classList.add('hidden');
    modalReceipt.classList.add('hidden');
    modalSoundboard.classList.add('hidden');
    modalSkins.classList.add('hidden');
    game.startNewRun();
  }

  btnStartRun.addEventListener('click', launchRun);
  btnPlayAgain.addEventListener('click', launchRun);
  closeReceipt.addEventListener('click', () => {
    modalReceipt.classList.add('hidden');
    startOverlay.classList.remove('hidden');
  });

  // Download Shareable Swear Jar Receipt Image
  btnDownloadReceipt.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `rage-commute-receipt-${Date.now()}.png`;
    link.href = receiptCanvas.toDataURL('image/png');
    link.click();
  });

  // Soundboard Drawer Logic
  function renderSoundboardList() {
    const clips = audio.getCustomClips();
    const staticClips = audio.getStaticFolderClips();
    const totalCount = clips.length + staticClips.length;
    customClipCountEl.textContent = `${totalCount}`;

    if (totalCount > 0) {
      clipStatusNote.textContent = `${totalCount} voice swear clip(s) active in Uncensored Mode!`;
    } else {
      clipStatusNote.textContent = 'Using built-in synth rage until custom clips are added';
    }

    customClipList.innerHTML = '';

    // 1. Render user-uploaded / recorded clips
    for (const clip of clips) {
      const row = document.createElement('div');
      row.className = 'clip-row';

      const info = document.createElement('div');
      info.className = 'clip-info';
      const label = document.createElement('span');
      label.className = 'clip-label';
      label.textContent = `"${clip.label}"`;
      const fname = document.createElement('span');
      fname.className = 'clip-filename';
      fname.textContent = `${clip.name} (Custom)`;
      info.append(label, fname);

      const actions = document.createElement('div');
      actions.className = 'clip-actions';

      const btnPlay = document.createElement('button');
      btnPlay.className = 'comic-btn btn-yellow btn-sm';
      btnPlay.textContent = '▶ TEST';
      btnPlay.addEventListener('click', () => audio.previewClip(clip));

      const btnDel = document.createElement('button');
      btnDel.className = 'comic-btn btn-red btn-sm';
      btnDel.textContent = '🗑';
      btnDel.addEventListener('click', async () => {
        await audio.removeClip(clip.id);
        renderSoundboardList();
      });

      actions.append(btnPlay, btnDel);
      row.append(info, actions);
      customClipList.appendChild(row);
    }

    // 2. Render built-in swear audio files from public/audio/swears/
    for (const sClip of staticClips) {
      const row = document.createElement('div');
      row.className = 'clip-row';

      const info = document.createElement('div');
      info.className = 'clip-info';
      const label = document.createElement('span');
      label.className = 'clip-label';
      label.textContent = `"${sClip.name}"`;
      const fname = document.createElement('span');
      fname.className = 'clip-filename';
      fname.textContent = `${sClip.url.split('/').pop()} (Built-in Voice Pack)`;
      info.append(label, fname);

      const actions = document.createElement('div');
      actions.className = 'clip-actions';

      const btnPlay = document.createElement('button');
      btnPlay.className = 'comic-btn btn-yellow btn-sm';
      btnPlay.textContent = '▶ TEST';
      btnPlay.addEventListener('click', () => audio.previewUrl(sClip.url));

      actions.append(btnPlay);
      row.append(info, actions);
      customClipList.appendChild(row);
    }
  }

  renderSoundboardList();

  function openSoundboard() {
    renderSoundboardList();
    modalSoundboard.classList.remove('hidden');
  }

  btnSoundboard.addEventListener('click', openSoundboard);
  btnOpenSoundboardHero.addEventListener('click', openSoundboard);
  closeSoundboard.addEventListener('click', () => modalSoundboard.classList.add('hidden'));

  // File Upload & Drag-and-Drop
  audioFileInput.addEventListener('change', async () => {
    if (audioFileInput.files && audioFileInput.files.length > 0) {
      await audio.addUploadedFiles(audioFileInput.files, micLabelInput.value.trim());
      audioFileInput.value = '';
      renderSoundboardList();
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await audio.addUploadedFiles(e.dataTransfer.files, micLabelInput.value.trim());
      renderSoundboardList();
    }
  });

  // Live Microphone Recording
  let isRecordingMic = false;
  btnRecordMic.addEventListener('click', async () => {
    if (!isRecordingMic) {
      const started = await audio.startRecording();
      if (started) {
        isRecordingMic = true;
        btnRecordMic.textContent = '⏹ STOP & SAVE SWEAR CLIP';
        btnRecordMic.classList.remove('btn-red');
        btnRecordMic.classList.add('btn-yellow');
      } else {
        alert('Could not access microphone. You can still upload .mp3/.wav/.ogg files directly!');
      }
    } else {
      isRecordingMic = false;
      btnRecordMic.textContent = '🔴 HOLD OR CLICK TO RECORD SWEAR';
      btnRecordMic.classList.remove('btn-yellow');
      btnRecordMic.classList.add('btn-red');
      await audio.stopRecording(micLabelInput.value);
      micLabelInput.value = '';
      renderSoundboardList();
    }
  });

  // Commuter Skins Shop Modal
  function renderSkinsModal() {
    shopCoffeeBalance.textContent = `${saveData.coffeeBeans}`;
    skinCoffeeCountEl.textContent = `${saveData.coffeeBeans}`;
    skinGrid.innerHTML = '';

    for (const skin of SKINS) {
      const unlocked = saveData.unlockedSkins.includes(skin.id);
      const selected = saveData.selectedSkin === skin.id;

      const card = document.createElement('div');
      card.className = `skin-card ${selected ? 'selected' : ''}`;

      const top = document.createElement('div');
      top.innerHTML = `
        <div class="skin-title">${skin.name}</div>
        <div class="skin-role">${skin.title}</div>
        <p class="skin-desc" style="margin-top:6px;">${skin.description}</p>
      `;

      const actionBtn = document.createElement('button');
      if (selected) {
        actionBtn.className = 'comic-btn btn-yellow';
        actionBtn.textContent = '✓ EQUIPPED';
      } else if (unlocked) {
        actionBtn.className = 'comic-btn btn-cyan';
        actionBtn.textContent = 'EQUIP PERSONA';
        actionBtn.addEventListener('click', () => {
          saveData.selectedSkin = skin.id;
          writeSaveData(saveData);
          game.updateSaveDataRef(saveData);
          renderSkinsModal();
        });
      } else {
        const canAfford = saveData.coffeeBeans >= skin.cost;
        actionBtn.className = `comic-btn ${canAfford ? 'btn-red' : 'btn-sm'}`;
        actionBtn.textContent = `UNLOCK (${skin.cost} ☕)`;
        actionBtn.addEventListener('click', () => {
          if (saveData.coffeeBeans >= skin.cost) {
            saveData.coffeeBeans -= skin.cost;
            saveData.unlockedSkins.push(skin.id);
            saveData.selectedSkin = skin.id;
            writeSaveData(saveData);
            game.updateSaveDataRef(saveData);
            renderSkinsModal();
          }
        });
      }

      card.append(top, actionBtn);
      skinGrid.appendChild(card);
    }
  }

  btnSkins.addEventListener('click', () => {
    renderSkinsModal();
    modalSkins.classList.remove('hidden');
  });
  closeSkins.addEventListener('click', () => modalSkins.classList.add('hidden'));

  // Keyboard Controls
  window.addEventListener('keydown', (e) => {
    // Ignore shortcuts if typing in custom swear label input
    if (document.activeElement === micLabelInput) return;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) {
        if (!modalReceipt.classList.contains('hidden')) {
          launchRun();
        } else if (!startOverlay.classList.contains('hidden')) {
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

  // Canvas Touch / Swipe & Pointer Controls (Tap to Jump, Swipe Down to Slide!)
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
    if (dy > 36 && !isSwipingSlide) {
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

  // Dedicated On-Screen Mobile Thumb Buttons (with multi-touch pointer capture)
  touchJump.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    audio.unlockAudioOnGesture();
    touchJump.setPointerCapture(e.pointerId);
    touchJump.classList.add('active-press');
    game.pressJump();
  });
  const endJumpBtn = (e: PointerEvent) => {
    e.preventDefault();
    touchJump.classList.remove('active-press');
    game.releaseJump();
  };
  touchJump.addEventListener('pointerup', endJumpBtn);
  touchJump.addEventListener('pointercancel', endJumpBtn);

  touchSlide.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    audio.unlockAudioOnGesture();
    touchSlide.setPointerCapture(e.pointerId);
    touchSlide.classList.add('active-press');
    game.setSlide(true);
  });
  const endSlideBtn = (e: PointerEvent) => {
    e.preventDefault();
    touchSlide.classList.remove('active-press');
    game.setSlide(false);
  };
  touchSlide.addEventListener('pointerup', endSlideBtn);
  touchSlide.addEventListener('pointercancel', endSlideBtn);
}

bootstrap();
