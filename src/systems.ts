import Phaser from 'phaser';

export const COLORS = {
    bg: 0x3d2b1f, road: 0x242424, roadMark: 0xddddcc,
    player: 0x2d70b3, npc: 0x3a7a40,
    carPlayer: 0xb53131, carTraffic1: 0x888888, carTraffic2: 0x336655, carPolice: 0x113388,
    buildRes: 0xd4b895, buildInd: 0x606a75, buildMarket: 0xc98c5d,
    park: 0x3d6e35, tree: 0x264d20,
};

export function generateGraphics(scene: Phaser.Scene) {
    const g = scene.add.graphics();

    // SAFETY WRAPPER: Prevents overwriting loaded PNGs which causes fatal game crashes
    const safeGen = (key: string, w: number, h: number) => {
        if (!scene.textures.exists(key)) {
            g.generateTexture(key, w, h);
        }
        g.clear();
    };

    g.fillStyle(COLORS.player); g.fillCircle(8, 8, 8);
    g.fillStyle(0xffd1b3); g.fillCircle(8, 8, 4);
    safeGen('player', 16, 16);

    g.fillStyle(COLORS.npc); g.fillCircle(8, 8, 8);
    g.fillStyle(0xffd1b3); g.fillCircle(8, 8, 4);
    safeGen('npc', 16, 16);

    const drawCar = (key: string, color: number, isPolice: boolean) => {
        if (scene.textures.exists(key)) return; 
        g.fillStyle(color); g.fillRoundedRect(0, 0, 40, 20, 4);
        g.fillStyle(0x111111); g.fillRect(8, 2, 24, 16);
        g.fillStyle(color); g.fillRect(12, 4, 16, 12);
        g.fillStyle(0xffffaa); g.fillRect(36, 2, 4, 4); g.fillRect(36, 14, 4, 4);
        g.fillStyle(0xff0000); g.fillRect(0, 2, 2, 4); g.fillRect(0, 14, 2, 4); 
        if (isPolice) {
            g.fillStyle(0xff0000); g.fillRect(16, 2, 4, 3);
            g.fillStyle(0x0000ff); g.fillRect(20, 2, 4, 3);
        }
        g.generateTexture(key, 40, 20); g.clear();
    };
    drawCar('player_car', COLORS.carPlayer, false);
    drawCar('traffic_car_1', COLORS.carTraffic1, false);
    drawCar('traffic_car_2', COLORS.carTraffic2, false);
    drawCar('police_car', COLORS.carPolice, true);

    g.fillStyle(COLORS.buildRes); g.fillRect(0, 0, 80, 80);
    g.fillStyle(0x9a8468); g.fillRect(10, 10, 15, 15); 
    g.fillStyle(0x222222); g.fillCircle(60, 20, 10); 
    g.lineStyle(2, 0x000000, 0.4); g.strokeRect(0, 0, 80, 80);
    safeGen('build_res', 80, 80);

    g.fillStyle(COLORS.buildInd); g.fillRect(0, 0, 150, 100);
    g.lineStyle(4, 0x444444); g.strokeRect(10, 10, 130, 80); 
    safeGen('build_ind', 150, 100);

    g.fillStyle(COLORS.buildMarket); g.fillRect(0, 0, 60, 60);
    g.fillStyle(0xff5555); g.fillRect(0, 45, 60, 15); 
    g.lineStyle(2, 0x000000, 0.3); g.strokeRect(0, 0, 60, 60);
    safeGen('build_market', 60, 60);

    g.fillStyle(COLORS.tree); g.fillCircle(16, 16, 16);
    g.fillStyle(0x1a3815); g.fillCircle(12, 12, 8); 
    safeGen('tree', 32, 32);

    g.fillStyle(0x884400); g.fillRect(0, 0, 30, 20); 
    g.fillStyle(0xffaa00); g.fillRect(0, 0, 30, 10);
    safeGen('stall', 30, 20);

    g.fillStyle(0x111111); g.fillRoundedRect(0, 0, 18, 46, 4);
    g.fillStyle(0x330000); g.fillCircle(9, 10, 5);
    g.fillStyle(0x333300); g.fillCircle(9, 23, 5);
    g.fillStyle(0x003300); g.fillCircle(9, 36, 5);
    safeGen('tl_base', 18, 46);
    
    g.fillStyle(0xff0000); g.fillCircle(9, 10, 5); safeGen('tl_red', 18, 46);
    g.fillStyle(0xffff00); g.fillCircle(9, 23, 5); safeGen('tl_yellow', 18, 46);
    g.fillStyle(0x00ff00); g.fillCircle(9, 36, 5); safeGen('tl_green', 18, 46);

    g.fillStyle(0xff8800); g.fillRoundedRect(0, 0, 80, 20, 4);
    g.fillStyle(0x111111); for(let i=0; i<80; i+=12) g.fillRect(i, 0, 6, 20);
    safeGen('roadblock', 80, 20);
}

export class AudioSystem {
    private ctx: AudioContext | null = null;
    private engineOsc: OscillatorNode | null = null;
    private engineGain: GainNode | null = null;
    private lastRewindTime = 0;
    
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    private playTone(freq: number, type: OscillatorType, dur: number, vol: number) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    }

    startEngine() {
        if (!this.ctx) return;
        if (this.engineOsc) return;
        this.engineOsc = this.ctx.createOscillator();
        this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'triangle';
        this.engineOsc.frequency.setValueAtTime(60, this.ctx.currentTime);
        this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime); 
        this.engineOsc.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
    }

    updateEngine(speed: number, inCar: boolean) {
        if (!this.ctx || !this.engineOsc || !this.engineGain) return;
        if (!inCar) {
            this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
            return;
        }
        const targetFreq = 60 + (speed * 0.4);
        const targetVol = 0.05 + (speed / 400) * 0.1;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
        this.engineGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
    }

    playInteract() { this.playTone(600, 'sine', 0.1, 0.1); }
    playAccept() { this.playTone(400, 'square', 0.1, 0.1); setTimeout(() => this.playTone(600, 'square', 0.2, 0.1), 100); }
    playAlert() { this.playTone(200, 'sawtooth', 0.3, 0.2); setTimeout(() => this.playTone(150, 'sawtooth', 0.4, 0.2), 150); }
    playSiren() { this.playTone(800, 'square', 0.2, 0.05); setTimeout(() => this.playTone(600, 'square', 0.2, 0.05), 200); }
    
    playRewind(time: number) {
        if (time - this.lastRewindTime > 80) {
            this.playTone(150 + Math.random()*100, 'triangle', 0.1, 0.2);
            this.lastRewindTime = time;
        }
    }
}
export const audioSys = new AudioSystem();

export interface Snapshot {
    player: { x: number, y: number, rot: number, inCar: boolean };
    car: { x: number, y: number, rot: number, vx: number, vy: number };
    police: { active: boolean, x: number, y: number, rot: number };
    traffic: { x: number, y: number, rot: number }[];
    state: { mission: number, wanted: number, violation: boolean, light: number };
}

export class RewindSystem {
    private history: Snapshot[] = [];
    private maxFrames = 300; 

    record(snap: Snapshot) {
        this.history.push(snap);
        if (this.history.length > this.maxFrames) this.history.shift();
    }

    rewindStep(steps: number): Snapshot | null {
        let snap: Snapshot | null = null;
        for(let i=0; i<steps; i++) {
            if (this.history.length > 0) snap = this.history.pop() || null;
        }
        return snap;
    }

    hasHistory(): boolean { return this.history.length > 0; }
    clear() { this.history = []; }
}