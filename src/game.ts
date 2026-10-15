import {
  ActiveObstacle,
  CollectibleCoffee,
  Particle,
  SaveData,
  SkinConfig,
  SwearBubble,
  SwearLogItem,
  ZoneId,
} from './types';
import { OBSTACLE_TEMPLATES, SKINS } from './constants';
import { SwearAudioManager } from './audio';
import { ComicRenderer, PlayerRenderState } from './renderer';
import { ReceiptStats } from './receipt';

export interface GameHUDCallbacks {
  onHudUpdate: (hud: {
    score: number;
    highScore: number;
    swearsCount: number;
    totalFine: number;
    combo: number;
    coffeeBeans: number;
    zone: ZoneId;
    bloodPressure: string;
  }) => void;
  onGameOver: (stats: ReceiptStats) => void;
}

export class CommuterRageGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: ComicRenderer;
  private audio: SwearAudioManager;
  private callbacks: GameHUDCallbacks;
  private saveData: SaveData;

  private isRunning: boolean = false;
  private isGameOver: boolean = false;
  private lastFrameTime: number = 0;

  // World & Camera
  private width: number = 960;
  private height: number = 540;
  private groundY: number = 435;
  private scrollX: number = 0;
  private speed: number = 430;
  private baseSpeed: number = 430;
  private maxSpeed: number = 920;
  private shakeTime: number = 0;
  private shakeIntensity: number = 0;

  // Player Physics
  private playerX: number = 145;
  private playerY: number = 355;
  private playerVy: number = 0;
  private readonly normalWidth: number = 44;
  private readonly normalHeight: number = 78;
  private readonly slideHeight: number = 44;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideHold: boolean = false;
  private jumpsUsed: number = 0;
  private maxJumps: number = 2;
  private jumpKeyHeld: boolean = false;
  private jumpHoldTimer: number = 0;
  private runCycle: number = 0;

  // Swear & Combo Mechanics
  private isSwearing: boolean = false;
  private swearAnimTimer: number = 0;
  private swearsCount: number = 0;
  private totalFine: number = 0;
  private combo: number = 0;
  private peakCombo: number = 0;
  private swearLog: SwearLogItem[] = [];

  // Score & Progression
  private score: number = 0;
  private runCoffeeCollected: number = 0;
  private currentZone: ZoneId = 'suburb';

  // Entities
  private obstacles: ActiveObstacle[] = [];
  private coffees: CollectibleCoffee[] = [];
  private bubbles: SwearBubble[] = [];
  private particles: Particle[] = [];
  private nextEntityId: number = 1;
  private spawnDistanceRemaining: number = 320;

  constructor(
    canvas: HTMLCanvasElement,
    audio: SwearAudioManager,
    saveData: SaveData,
    callbacks: GameHUDCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new ComicRenderer(this.ctx);
    this.audio = audio;
    this.saveData = saveData;
    this.callbacks = callbacks;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.resetRunState();
    this.renderFrame(performance.now());
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const containerW = rect ? Math.max(280, rect.width) : window.innerWidth;
    const containerH = rect ? Math.max(260, rect.height) : window.innerHeight * 0.75;
    const aspect = containerW / containerH;

    // Keep a consistent logical height (~520px) and scale width by aspect ratio
    // so both mobile portrait (e.g. 9:16) and desktop landscape (16:9) look crisp and unstretched!
    this.height = 520;
    this.width = Math.max(460, Math.min(1150, Math.round(this.height * aspect)));

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const isMobilePortrait = this.width < 600;
    this.playerX = isMobilePortrait ? 68 : 145;
    // Leave extra room below the sidewalk on mobile for thumb touch buttons
    this.groundY = Math.floor(this.height * (isMobilePortrait ? 0.78 : 0.81));

    if (this.isGrounded && !this.isRunning) {
      this.playerY = this.groundY - this.getCurrentPlayerHeight();
    }
  }

  updateSaveDataRef(saveData: SaveData): void {
    this.saveData = saveData;
  }

  getSelectedSkin(): SkinConfig {
    return SKINS.find((s) => s.id === this.saveData.selectedSkin) || SKINS[0];
  }

  private getCurrentPlayerHeight(): number {
    return this.isSliding ? this.slideHeight : this.normalHeight;
  }

  resetRunState(): void {
    this.scrollX = 0;
    this.speed = this.baseSpeed;
    this.score = 0;
    this.swearsCount = 0;
    this.totalFine = 0;
    this.combo = 0;
    this.peakCombo = 0;
    this.runCoffeeCollected = 0;
    this.currentZone = 'suburb';
    this.swearLog = [];

    this.isGrounded = true;
    this.isSliding = false;
    this.jumpsUsed = 0;
    this.playerVy = 0;
    this.playerY = this.groundY - this.normalHeight;
    this.isSwearing = false;
    this.swearAnimTimer = 0;

    this.obstacles = [];
    this.coffees = [];
    this.bubbles = [];
    this.particles = [];
    this.spawnDistanceRemaining = 420;
    this.isGameOver = false;
  }

  startNewRun(): void {
    this.resetRunState();
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.emitHud();
  }

  isActiveRun(): boolean {
    return this.isRunning && !this.isGameOver;
  }

  // Input Actions
  pressJump(): void {
    if (!this.isRunning || this.isGameOver) {
      this.startNewRun();
      return;
    }

    if (this.isSliding) {
      this.setSlide(false);
    }

    if (this.jumpsUsed < this.maxJumps) {
      const isDouble = this.jumpsUsed > 0;
      this.playerVy = isDouble ? -660 : -730;
      this.isGrounded = false;
      this.jumpsUsed++;
      this.jumpKeyHeld = true;
      this.jumpHoldTimer = 0.18;
      this.audio.playJumpSound(isDouble);

      // Spawn jump dust particles (note: no swear yet! Swears strictly trigger on clearing an obstacle!)
      this.spawnParticles(
        this.playerX + this.normalWidth / 2,
        this.playerY + this.getCurrentPlayerHeight(),
        isDouble ? 8 : 5,
        isDouble ? '#38bdf8' : '#e2e8f0',
        'circle'
      );
    }
  }

  releaseJump(): void {
    this.jumpKeyHeld = false;
    if (this.playerVy < -280) {
      this.playerVy *= 0.58; // Crisp variable jump cutoff
    }
  }

  setSlide(sliding: boolean): void {
    this.slideHold = sliding;
    if (!this.isRunning || this.isGameOver) return;

    if (sliding && !this.isSliding && this.isGrounded) {
      this.isSliding = true;
      this.audio.playSlideSound();
      this.playerY = this.groundY - this.slideHeight;
    } else if (!sliding && this.isSliding) {
      this.isSliding = false;
      if (this.isGrounded) {
        this.playerY = this.groundY - this.normalHeight;
      }
    }
  }

  private update(dt: number): void {
    if (!this.isRunning || this.isGameOver) return;

    // 1. Zone & Speed Progression
    if (this.score < 1200) {
      this.currentZone = 'suburb';
    } else if (this.score < 2800) {
      this.currentZone = 'downtown';
    } else {
      this.currentZone = 'subway';
    }

    this.speed = Math.min(this.maxSpeed, this.baseSpeed + this.score * 0.085);

    const moveDist = this.speed * dt;
    this.scrollX += moveDist;
    this.score += moveDist * 0.08 * (1 + Math.min(this.combo, 10) * 0.1);
    this.runCycle += dt * (this.speed / 35);

    // 2. Player Vertical Physics
    if (this.jumpKeyHeld && this.jumpHoldTimer > 0) {
      this.playerVy -= 520 * dt;
      this.jumpHoldTimer -= dt;
    }

    const gravity = 2150;
    this.playerVy += gravity * dt;
    this.playerY += this.playerVy * dt;

    const currentH = this.getCurrentPlayerHeight();
    if (this.playerY + currentH >= this.groundY) {
      this.isGrounded = true;
      this.jumpsUsed = 0;
      this.playerVy = 0;
      if (this.slideHold && !this.isSliding) {
        this.isSliding = true;
        this.audio.playSlideSound();
      }
      this.playerY = this.groundY - this.getCurrentPlayerHeight();
    } else {
      this.isGrounded = false;
    }

    if (this.swearAnimTimer > 0) {
      this.swearAnimTimer -= dt;
      if (this.swearAnimTimer <= 0) {
        this.isSwearing = false;
      }
    }

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
    }

    // 3. Obstacle Spawning
    this.spawnDistanceRemaining -= moveDist;
    if (this.spawnDistanceRemaining <= 0) {
      this.spawnObstacleWave();
      const minGap = Math.max(250, 390 - this.score * 0.025);
      const maxGap = Math.max(380, 580 - this.score * 0.03);
      this.spawnDistanceRemaining = minGap + Math.random() * (maxGap - minGap);
    }

    // 4. Update Obstacles & Check Collisions / Obstacle Clear Swear Trigger!
    const playerRight = this.playerX + this.normalWidth - 8;
    const playerLeft = this.playerX + 8;
    const playerTop = this.playerY + 6;
    const playerBottom = this.playerY + currentH - 4;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= moveDist;
      obs.animPhase += dt * 40;

      const obsLeft = obs.x + 6;
      const obsRight = obs.x + obs.width - 6;
      const obsTop = obs.y + 6;
      const obsBottom = obs.y + obs.height - 6;

      // Check AABB Collision
      const overlapsX = playerRight > obsLeft && playerLeft < obsRight;
      const overlapsY = playerBottom > obsTop && playerTop < obsBottom;

      if (!obs.hit && overlapsX && overlapsY) {
        obs.hit = true;
        this.handlePlayerCrash(obs);
        return;
      }

      // STRICT SWEAR TRIGGER: When the player successfully clears/passes over (or ducks under) an obstacle!
      if (!obs.cleared && !obs.hit && obs.x + obs.width < this.playerX + 10) {
        obs.cleared = true;
        this.onObstacleClearedWithSwear(obs);
      }

      if (obs.x + obs.width < -120) {
        this.obstacles.splice(i, 1);
      }
    }

    // 5. Update Collectible Coffee Beans
    for (let i = this.coffees.length - 1; i >= 0; i--) {
      const c = this.coffees[i];
      c.x -= moveDist;

      if (!c.collected) {
        const dx = this.playerX + this.normalWidth / 2 - c.x;
        const dy = this.playerY + currentH / 2 - c.y;
        if (Math.hypot(dx, dy) < c.radius + 26) {
          c.collected = true;
          this.runCoffeeCollected++;
          this.saveData.coffeeBeans++;
          this.score += 50;
          this.audio.playCoffeePickup();
          this.spawnParticles(c.x, c.y, 10, '#facc15', 'star');
        }
      }

      if (c.x < -60 || c.collected) {
        this.coffees.splice(i, 1);
      }
    }

    // 6. Update Swear Speech Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt * 60;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.scale += (b.targetScale - b.scale) * 0.25;
      if (b.life >= b.maxLife) {
        this.bubbles.splice(i, 1);
      }
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 450 * dt;
      pt.rotation += pt.vRot * dt;
      pt.alpha = 1 - pt.life / pt.maxLife;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    this.emitHud();
  }

  /**
   * Called strictly when the player clears an obstacle!
   * Yells a swear word, spawns an explosive comic speech bubble, increments combo & HR fine!
   */
  private onObstacleClearedWithSwear(obs: ActiveObstacle): void {
    this.combo++;
    if (this.combo > this.peakCombo) {
      this.peakCombo = this.combo;
    }

    this.swearsCount++;
    this.saveData.totalSwearsLifetime++;
    this.isSwearing = true;
    this.swearAnimTimer = 0.48;

    // Trigger Audio & get chosen swear text
    const { wordEntry, displayText } = this.audio.triggerObstacleClearSwear(this.combo);

    const fineAdded = Math.round((obs.template.baseFine + wordEntry.fineAmount) * (1 + (this.combo - 1) * 0.25));
    this.totalFine += fineAdded;
    this.score += 100 * this.combo;

    // Log citation for the HR Swear Jar Receipt
    this.swearLog.push({
      timestamp: Date.now(),
      obstacleName: obs.template.name,
      wordUsed: displayText,
      fine: fineAdded,
      comboMultiplier: this.combo,
    });

    // Screen shake scales with combo
    this.shakeScreen(0.16, Math.min(9, 3 + this.combo * 0.7));

    // Spawn Explosive Comic Speech Bubble right above the commuter's head
    const bubbleColors = ['#facc15', '#fb923c', '#f87171'];
    const color = bubbleColors[Math.min(2, wordEntry.severity - 1)];
    const subText = `+$${fineAdded} HR FINE! (x${this.combo} COMBO)`;

    this.spawnSwearBubble(
      displayText,
      subText,
      this.playerX + 75,
      Math.max(65, this.playerY - 28),
      color,
      wordEntry.severity
    );

    // Burst of comic stars & rage droplets from the player
    this.spawnParticles(
      this.playerX + this.normalWidth / 2,
      this.playerY + 12,
      10 + Math.min(this.combo * 2, 14),
      color,
      'star'
    );
  }

  private handlePlayerCrash(obs: ActiveObstacle): void {
    this.isGameOver = true;
    this.isRunning = false;
    this.isSwearing = true;
    this.shakeScreen(0.45, 14);
    this.audio.playCrashMeltdownSound();

    const censor = this.audio.getCensorMode();
    const crashWord =
      censor === 'corporate'
        ? 'UNACCEPTABLE KPI!!'
        : censor === 'bleep'
        ? '@#$%&*!! BLEEP!!'
        : 'MOTHERF*CKING SH*T!!';

    this.spawnSwearBubble(
      crashWord,
      `TRIPPED ON ${obs.template.name.toUpperCase()}!`,
      this.playerX + 90,
      Math.max(70, this.playerY - 25),
      '#ef4444',
      3
    );

    this.spawnParticles(this.playerX + 20, this.playerY + 30, 26, '#ef4444', 'star');

    const finalScore = Math.floor(this.score);
    if (finalScore > this.saveData.highScore) {
      this.saveData.highScore = finalScore;
    }

    this.emitHud();

    // Render one final frame with the crash bubble & particles, then show Swear Jar Receipt
    setTimeout(() => {
      this.callbacks.onGameOver({
        score: finalScore,
        highScore: this.saveData.highScore,
        totalSwears: this.swearsCount,
        totalFine: this.totalFine,
        peakCombo: this.peakCombo,
        peakBloodPressure: this.getBloodPressureString(),
        coffeeCollected: this.runCoffeeCollected,
        killerObstacle: obs.template.name,
        swearLog: this.swearLog,
        commuterName: this.getSelectedSkin().name,
      });
    }, 550);
  }

  private spawnObstacleWave(): void {
    const zonePool = OBSTACLE_TEMPLATES.filter((t) => t.zone === this.currentZone || t.zone === 'all');
    const pool = zonePool.length > 0 ? zonePool : OBSTACLE_TEMPLATES;
    const template = pool[Math.floor(Math.random() * pool.length)];

    let obsY = this.groundY - template.height;
    if (template.isOverhead) {
      // Positioned so standing player hits it, sliding player ducks cleanly under it, or double-jumper leaps over it!
      obsY = this.groundY - this.slideHeight - template.height - 14;
    }

    this.obstacles.push({
      id: this.nextEntityId++,
      template,
      x: this.width + 60,
      y: obsY,
      width: template.width,
      height: template.height,
      cleared: false,
      hit: false,
      animPhase: 0,
    });

    // 55% chance to spawn an Espresso Cup above the obstacle to reward jumping!
    if (Math.random() < 0.55) {
      this.coffees.push({
        id: this.nextEntityId++,
        x: this.width + 60 + template.width / 2,
        y: template.isOverhead ? this.groundY - 24 : obsY - 58,
        radius: 14,
        collected: false,
        bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  private spawnSwearBubble(
    text: string,
    subText: string,
    x: number,
    y: number,
    color: string,
    severity: number
  ): void {
    const clampedX = Math.max(115, Math.min(this.width - 115, x));
    this.bubbles.push({
      id: this.nextEntityId++,
      text,
      subText,
      x: clampedX,
      y,
      vx: 25,
      vy: -55,
      scale: 0.2,
      targetScale: Math.min(1.35, 0.95 + this.combo * 0.05),
      rotation: (Math.random() - 0.5) * 0.22,
      life: 0,
      maxLife: 52,
      color,
      borderColor: '#09090b',
      severity,
    });
  }

  private spawnParticles(
    x: number,
    y: number,
    count: number,
    color: string,
    shape: 'circle' | 'star'
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 240;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 120,
        size: 4 + Math.random() * 6,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        shape,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  private shakeScreen(duration: number, intensity: number): void {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private getBloodPressureString(): string {
    const sys = 120 + Math.min(120, this.combo * 12);
    const dia = 80 + Math.min(80, this.combo * 8);
    return `${sys}/${dia} mmHg`;
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      score: Math.floor(this.score),
      highScore: Math.max(this.saveData.highScore, Math.floor(this.score)),
      swearsCount: this.swearsCount,
      totalFine: this.totalFine,
      combo: this.combo,
      coffeeBeans: this.saveData.coffeeBeans,
      zone: this.currentZone,
      bloodPressure: this.getBloodPressureString(),
    });
  }

  private renderFrame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000 || 0.016);
    this.lastFrameTime = now;

    if (this.isRunning && !this.isGameOver) {
      this.update(dt);
    }

    const ctx = this.ctx;
    ctx.save();

    if (this.shakeTime > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const dy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(dx, dy);
    }

    // 1. Background & Parallax Zone
    this.renderer.drawEnvironment(
      this.width,
      this.height,
      this.groundY,
      this.scrollX,
      this.currentZone
    );

    // 2. Collectibles
    for (const c of this.coffees) {
      this.renderer.drawCoffee(c, now);
    }

    // 3. Obstacles
    for (const obs of this.obstacles) {
      this.renderer.drawObstacle(obs);
    }

    // 4. Player Character
    const pState: PlayerRenderState = {
      x: this.playerX,
      y: this.playerY,
      width: this.normalWidth,
      height: this.getCurrentPlayerHeight(),
      vy: this.playerVy,
      isGrounded: this.isGrounded,
      isSliding: this.isSliding,
      isSwearing: this.isSwearing,
      swearTimer: this.swearAnimTimer,
      runCycle: this.runCycle,
      combo: this.combo,
      skin: this.getSelectedSkin(),
      crashed: this.isGameOver,
    };
    this.renderer.drawPlayer(pState);

    // 5. Particles & Comic Swear Bubbles
    this.renderer.drawParticles(this.particles);
    this.renderer.drawSwearBubbles(this.bubbles);

    ctx.restore();
    requestAnimationFrame(this.renderFrame);
  };
}
