import {
  ActiveObstacle,
  CollectibleCoffee,
  Particle,
  SkinConfig,
  SwearBubble,
  ZoneId,
} from './types';

export interface PlayerRenderState {
  x: number;
  y: number;
  width: number;
  height: number;
  vy: number;
  isGrounded: boolean;
  isSliding: boolean;
  isSwearing: boolean;
  swearTimer: number;
  isRageDashing: boolean;
  runCycle: number;
  combo: number;
  skin: SkinConfig;
  crashed: boolean;
}

export class ComicRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawEnvironment(
    width: number,
    height: number,
    groundY: number,
    scrollX: number,
    zone: ZoneId,
    isRageDashing: boolean
  ): void {
    const ctx = this.ctx;

    // 1. Sky / Background Gradient per Zone
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    if (isRageDashing) {
      grad.addColorStop(0, '#450a0a');
      grad.addColorStop(0.5, '#991b1b');
      grad.addColorStop(1, '#f97316');
    } else if (zone === 'suburb') {
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.6, '#bae6fd');
      grad.addColorStop(1, '#fef08a');
    } else if (zone === 'downtown') {
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(0.5, '#fb7185');
      grad.addColorStop(1, '#fde047');
    } else {
      // Subway / Rush Hour Night
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#311042');
      grad.addColorStop(1, '#be123c');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, groundY);

    // Comic Halftone / Action Speed Lines when fast or Rage Dashing
    if (isRageDashing) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 14; i++) {
        const ly = ((i * 37 + scrollX * 0.8) % groundY);
        const lx = ((i * 193 - scrollX * 3.5) % width + width) % width;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 160, ly);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Far Parallax City / Suburb Silhouette
    this.drawFarParallax(width, groundY, scrollX * 0.2, zone);

    // 3. Mid Parallax Buildings / Houses / Subway Pillars
    this.drawMidParallax(width, groundY, scrollX * 0.5, zone);

    // 4. Ground / Sidewalk Strip
    const groundHeight = height - groundY;
    ctx.fillStyle = zone === 'subway' ? '#1e293b' : '#cbd5e1';
    ctx.fillRect(0, groundY, width, groundHeight);

    // Bold Comic Curb Top Border
    ctx.fillStyle = zone === 'subway' ? '#facc15' : '#94a3b8';
    ctx.fillRect(0, groundY, width, 14);

    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.moveTo(0, groundY + 14);
    ctx.lineTo(width, groundY + 14);
    ctx.stroke();

    // Sidewalk crack lines scrolling at 1.0x speed
    const tileW = 90;
    const offset = scrollX % tileW;
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;
    for (let x = -offset; x < width + tileW; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 14);
      ctx.lineTo(x - 24, height);
      ctx.stroke();
    }
  }

  private drawFarParallax(width: number, groundY: number, scroll: number, zone: ZoneId): void {
    const ctx = this.ctx;
    const span = 220;
    const startTile = Math.floor(scroll / span) - 1;
    const totalTiles = Math.ceil(width / span) + 3;

    ctx.save();
    ctx.fillStyle = zone === 'suburb' ? '#7dd3fc' : zone === 'downtown' ? '#f43f5e' : '#1e1b4b';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 3;

    for (let i = 0; i < totalTiles; i++) {
      const tileIdx = startTile + i;
      const x = tileIdx * span - scroll;
      const idx = ((tileIdx % 12) + 12) % 12;
      const h = 90 + (idx % 4) * 35;
      ctx.fillRect(x + 10, groundY - h, span - 20, h);
      ctx.strokeRect(x + 10, groundY - h, span - 20, h);
    }
    ctx.restore();
  }

  private drawMidParallax(width: number, groundY: number, scroll: number, zone: ZoneId): void {
    const ctx = this.ctx;
    const span = 180;
    const startTile = Math.floor(scroll / span) - 1;
    const totalTiles = Math.ceil(width / span) + 3;

    ctx.save();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#09090b';

    for (let i = 0; i < totalTiles; i++) {
      const tileIdx = startTile + i;
      const x = tileIdx * span - scroll;
      const idx = ((tileIdx % 12) + 12) % 12;
      if (zone === 'suburb') {
        // Cartoon suburban house + picket fence
        const houseH = 110 + (idx % 2) * 25;
        ctx.fillStyle = idx % 2 === 0 ? '#fef3c7' : '#dcfce7';
        ctx.fillRect(x + 20, groundY - houseH, 120, houseH);
        ctx.strokeRect(x + 20, groundY - houseH, 120, houseH);

        // Roof
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(x + 10, groundY - houseH);
        ctx.lineTo(x + 80, groundY - houseH - 45);
        ctx.lineTo(x + 150, groundY - houseH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Window
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(x + 62, groundY - houseH + 22, 36, 28);
        ctx.strokeRect(x + 62, groundY - houseH + 22, 36, 28);
      } else if (zone === 'downtown') {
        // Storefronts & Office Buildings
        const bldgH = 150 + (idx % 3) * 40;
        ctx.fillStyle = idx % 2 === 0 ? '#475569' : '#334155';
        ctx.fillRect(x + 12, groundY - bldgH, 150, bldgH);
        ctx.strokeRect(x + 12, groundY - bldgH, 150, bldgH);

        // Awning
        ctx.fillStyle = idx % 2 === 0 ? '#ef4444' : '#10b981';
        ctx.fillRect(x + 8, groundY - 52, 158, 18);
        ctx.strokeRect(x + 8, groundY - 52, 158, 18);
      } else {
        // Subway Tiles & Steel Girders
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 35, 0, 28, groundY);
        ctx.strokeRect(x + 35, 0, 28, groundY);

        // Warning sign on pillar
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x + 31, groundY - 120, 36, 24);
        ctx.strokeRect(x + 31, groundY - 120, 36, 24);
      }
    }
    ctx.restore();
  }

  drawPlayer(p: PlayerRenderState): void {
    const ctx = this.ctx;
    ctx.save();

    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    ctx.translate(cx, cy);

    // Slight forward lean while sprinting, or tilt back while yelling mid-air
    if (p.crashed) {
      ctx.rotate(-0.45);
    } else if (p.isSliding) {
      ctx.rotate(-0.55);
    } else if (p.isSwearing) {
      ctx.rotate(-0.12);
    } else {
      ctx.rotate(0.1);
    }

    // Rage Dash Fiery Aura
    if (p.isRageDashing) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.width * 0.95, p.height * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const legSwing = p.isGrounded && !p.isSliding ? Math.sin(p.runCycle * 0.35) * 18 : 14;

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#09090b';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Back Leg
    ctx.fillStyle = p.skin.suitColor;
    ctx.beginPath();
    ctx.roundRect(-10 - legSwing * 0.5, 12, 12, 24, 5);
    ctx.fill();
    ctx.stroke();

    // Front Leg
    ctx.beginPath();
    ctx.roundRect(-2 + legSwing * 0.5, 12, 12, 24, 5);
    ctx.fill();
    ctx.stroke();

    // Segway wheel if CEO skin
    if (p.skin.accessory === 'segway') {
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(0, 32, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 32, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Torso / Suit Jacket
    ctx.fillStyle = p.skin.suitColor;
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 34, 8);
    ctx.fill();
    ctx.stroke();

    // Shirt V-Neck
    ctx.fillStyle = p.skin.shirtColor;
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.lineTo(7, -16);
    ctx.lineTo(2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Flying Red Tie (whips wildly backwards!)
    ctx.fillStyle = p.skin.tieColor;
    const tieWave = Math.sin(p.runCycle * 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-28, -18 + tieWave);
    ctx.lineTo(-32, -10 + tieWave);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Head (turns redder as Rage Combo increases or when swearing!)
    const rageTint = p.isSwearing || p.combo >= 4 || p.isRageDashing;
    ctx.fillStyle = rageTint ? '#fca5a5' : p.skin.skinTone;
    ctx.beginPath();
    ctx.roundRect(-15, -44, 32, 30, 10);
    ctx.fill();
    ctx.stroke();

    // Hair
    ctx.fillStyle = p.skin.hairColor;
    ctx.beginPath();
    ctx.moveTo(-15, -36);
    ctx.lineTo(-20, -48);
    ctx.lineTo(-6, -44);
    ctx.lineTo(2, -50);
    ctx.lineTo(14, -44);
    ctx.lineTo(15, -36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Popping Forehead Anger Vein when swearing or high combo!
    if (p.isSwearing || p.combo >= 2 || p.isRageDashing) {
      ctx.save();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, -39);
      ctx.lineTo(-3, -34);
      ctx.lineTo(-8, -29);
      ctx.moveTo(-1, -39);
      ctx.lineTo(-3, -34);
      ctx.lineTo(2, -29);
      ctx.stroke();
      ctx.restore();
    }

    // Bulging Comic Eyes
    const eyeRadius = p.isSwearing || p.crashed ? 6.5 : 5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(4, -33, eyeRadius, 0, Math.PI * 2);
    ctx.arc(14, -33, eyeRadius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bloodshot Pupils
    ctx.fillStyle = p.isSwearing || p.isRageDashing ? '#dc2626' : '#09090b';
    ctx.beginPath();
    ctx.arc(5.5, -33, 2.2, 0, Math.PI * 2);
    ctx.arc(15, -33, 2.0, 0, Math.PI * 2);
    ctx.fill();

    // Angry Eyebrows
    ctx.beginPath();
    ctx.moveTo(-1, -40);
    ctx.lineTo(9, -36);
    ctx.moveTo(19, -40);
    ctx.lineTo(11, -36);
    ctx.stroke();

    // Mouth: Giant Wide-Open Screaming Mouth when swearing!
    if (p.isSwearing || p.isRageDashing || p.crashed) {
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(1, -26, 17, 12, 4);
      ctx.fill();
      ctx.stroke();

      // Upper teeth
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, -26, 13, 3.5);

      // Vibrating tongue
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(9, -16, 4.5, Math.PI, 0);
      ctx.fill();
    } else {
      // Gritted teeth grimace
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(3, -23, 12, 5);
      ctx.strokeRect(3, -23, 12, 5);
    }

    // Front Arm + Accessory (Briefcase or Coffee Mug)
    const armAngle = p.isSwearing ? -0.9 : Math.sin(p.runCycle * 0.35 + Math.PI) * 0.5;
    ctx.save();
    ctx.translate(4, -6);
    ctx.rotate(armAngle);
    ctx.fillStyle = p.skin.suitColor;
    ctx.beginPath();
    ctx.roundRect(-4, 0, 9, 20, 4);
    ctx.fill();
    ctx.stroke();

    if (p.skin.accessory === 'briefcase') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-10, 18, 22, 15);
      ctx.strokeRect(-10, 18, 22, 15);
    } else if (p.skin.accessory === 'mug') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, 16, 12, 14);
      ctx.strokeRect(-4, 16, 12, 14);
    }
    ctx.restore();

    ctx.restore();
  }

  drawObstacle(obs: ActiveObstacle): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#09090b';
    ctx.lineJoin = 'round';

    const w = obs.width;
    const h = obs.height;
    const t = obs.template.type;

    if (t === 'lego_pile') {
      // Colorful spiky Lego bricks
      const colors = ['#ef4444', '#eab308', '#3b82f6'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        const bx = i * 13;
        const by = i % 2 === 0 ? 12 : 4;
        ctx.fillRect(bx, by, 22, h - by);
        ctx.strokeRect(bx, by, 22, h - by);
        // Studs
        ctx.fillRect(bx + 4, by - 5, 5, 5);
        ctx.strokeRect(bx + 4, by - 5, 5, 5);
        ctx.fillRect(bx + 13, by - 5, 5, 5);
        ctx.strokeRect(bx + 13, by - 5, 5, 5);
      }
    } else if (t === 'rogue_roomba') {
      // Disc robot vacuum with taped kitchen knife!
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(0, h - 18, w, 18, 8);
      ctx.fill();
      ctx.stroke();

      // Angry red LED
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(14, h - 9, 4, 0, Math.PI * 2);
      ctx.fill();

      // Knife sticking up
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(w / 2 - 6, h - 18);
      ctx.lineTo(w / 2 - 14, 0);
      ctx.lineTo(w / 2 + 6, h - 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (t === 'wet_floor') {
      // Yellow Caution A-Frame Sign
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Exclamation mark
      ctx.fillStyle = '#09090b';
      ctx.font = '900 24px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', w / 2, h - 14);
    } else if (t === 'pigeon_flock' || t === 'low_branch' || t === 'boom_gate') {
      // Overhead hazard with high-visibility warning stripes!
      const bob = Math.sin(obs.animPhase * 0.15) * 5;
      ctx.translate(0, bob);

      ctx.fillStyle = t === 'pigeon_flock' ? '#94a3b8' : t === 'low_branch' ? '#15803d' : '#f97316';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 10);
      ctx.fill();
      ctx.stroke();

      // DUCK! Badge
      ctx.fillStyle = '#facc15';
      ctx.fillRect(6, h / 2 - 11, w - 12, 22);
      ctx.strokeRect(6, h / 2 - 11, w - 12, 22);
      ctx.fillStyle = '#09090b';
      ctx.font = '900 13px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DUCK / LEAP!', w / 2, h / 2 + 5);
    } else {
      // Generic Stylized Urban Hazard (Trash Can, Scooter, Turnstile, Hydrant, Coffee Cart)
      ctx.fillStyle =
        t === 'fire_hydrant'
          ? '#ef4444'
          : t === 'coffee_cart'
          ? '#b45309'
          : t === 'scooter'
          ? '#10b981'
          : '#64748b';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 6);
      ctx.fill();
      ctx.stroke();

      // Hazard stripe detail
      ctx.fillStyle = '#facc15';
      ctx.fillRect(4, 10, w - 8, 12);
      ctx.strokeRect(4, 10, w - 8, 12);
    }

    ctx.restore();
  }

  drawCoffee(c: CollectibleCoffee, time: number): void {
    if (c.collected) return;
    const ctx = this.ctx;
    const bob = Math.sin(time * 0.008 + c.bobOffset) * 5;

    ctx.save();
    ctx.translate(c.x, c.y + bob);

    // Glow
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, c.radius + 6, 0, Math.PI * 2);
    ctx.fill();

    // Espresso Cup
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#09090b';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-10, -12, 20, 24, 4);
    ctx.fill();
    ctx.stroke();

    // Coffee Sleeve
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-10, -4, 20, 10);
    ctx.strokeRect(-10, -4, 20, 10);

    // Lid
    ctx.fillStyle = '#09090b';
    ctx.fillRect(-12, -15, 24, 4);

    ctx.restore();
  }

  drawParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    for (const pt of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rotation);
      ctx.fillStyle = pt.color;
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 2;

      if (pt.shape === 'star') {
        this.drawStarPath(0, 0, 5, pt.size, pt.size * 0.45);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawSwearBubbles(bubbles: SwearBubble[]): void {
    const ctx = this.ctx;
    for (const b of bubbles) {
      ctx.save();
      const alpha = Math.min(1, (b.maxLife - b.life) / 12);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);
      ctx.scale(b.scale, b.scale);

      ctx.font = '900 26px "Bangers", "Impact", "Arial Black", sans-serif';
      const textWidth = Math.max(120, ctx.measureText(b.text).width + 36);
      const rx = textWidth * 0.62;
      const ry = 36;

      // Explosive Jagged Comic Starburst Bubble
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#09090b';
      ctx.lineWidth = 4.5;
      this.drawJaggedBurst(0, 0, rx, ry, 16);
      ctx.fill();
      ctx.stroke();

      // Main Swear Word Text
      ctx.fillStyle = '#09090b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.text, 2, 2);

      ctx.fillStyle = b.severity >= 3 ? '#ffffff' : '#09090b';
      ctx.fillText(b.text, 0, 0);

      // Subtext (e.g. "+$150 HR FINE! x3 COMBO")
      if (b.subText) {
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText(b.subText, 0, 22);
        ctx.fillText(b.subText, 0, 22);
      }

      ctx.restore();
    }
  }

  private drawJaggedBurst(cx: number, cy: number, rx: number, ry: number, points: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const angle = (i * Math.PI * 2) / total;
      const mult = i % 2 === 0 ? 1.15 : 0.82;
      const x = cx + Math.cos(angle) * rx * mult;
      const y = cy + Math.sin(angle) * ry * mult;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private drawStarPath(cx: number, cy: number, spikes: number, outerR: number, innerR: number): void {
    const ctx = this.ctx;
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }
}
