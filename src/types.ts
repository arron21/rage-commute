export type CensorMode = 'uncensored' | 'bleep' | 'corporate';

export type ZoneId = 'suburb' | 'downtown' | 'subway';

export interface SwearWordEntry {
  id: string;
  uncensored: string;
  bleeped: string;
  corporate: string;
  fineAmount: number;
  severity: 1 | 2 | 3;
}

export interface CustomAudioClip {
  id: string;
  name: string;
  label: string;
  blob: Blob;
  url: string;
  enabled: boolean;
  createdAt: number;
}

export interface SkinConfig {
  id: string;
  name: string;
  title: string;
  cost: number;
  description: string;
  suitColor: string;
  shirtColor: string;
  tieColor: string;
  skinTone: string;
  hairColor: string;
  accessory: 'briefcase' | 'mug' | 'vest' | 'segway';
  customSwearPrefix?: string;
}

export interface ObstacleTemplate {
  type: string;
  name: string;
  zone: ZoneId | 'all';
  width: number;
  height: number;
  isOverhead: boolean; // requires ducking or high jump
  fineReason: string;
  baseFine: number;
}

export interface ActiveObstacle {
  id: number;
  template: ObstacleTemplate;
  x: number;
  y: number;
  width: number;
  height: number;
  cleared: boolean;
  hit: boolean;
  animPhase: number;
}

export interface CollectibleCoffee {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  bobOffset: number;
}

export interface SwearBubble {
  id: number;
  text: string;
  subText: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  targetScale: number;
  rotation: number;
  life: number;
  maxLife: number;
  color: string;
  borderColor: string;
  severity: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'star' | 'vein' | 'sweat';
  rotation: number;
  vRot: number;
}

export interface SwearLogItem {
  timestamp: number;
  obstacleName: string;
  wordUsed: string;
  fine: number;
  comboMultiplier: number;
}

export interface SaveData {
  highScore: number;
  coffeeBeans: number;
  totalSwearsLifetime: number;
  unlockedSkins: string[];
  selectedSkin: string;
  censorMode: CensorMode;
}
