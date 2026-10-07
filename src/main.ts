import Phaser from 'phaser';
import { generateGraphics, audioSys } from './systems';
import { UIScene } from './UIScene';
import { GameScene } from './GameScene';

// --- BOOT SCENE ---
class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    
    preload() {
        // Load the custom uploaded PNG artwork for vehicles
        // Assuming these are placed in an 'assets' folder in your public/root directory
        this.load.image('car_player', 'assets/cars/player_car.png');
        this.load.image('car_traffic1', 'assets/cars/traffic_car_1.png');
        this.load.image('car_traffic2', 'assets/cars/traffic_car_2.png');
    }

    create() {
        generateGraphics(this);
        this.scene.start('TitleScene');
    }
}

// --- TITLE SCENE ---
class TitleScene extends Phaser.Scene {
    private bgTraffic!: Phaser.GameObjects.Group;

    constructor() { super('TitleScene'); }
    
    create() {
        if (this.scene.isActive('UIScene')) {
            this.scene.stop('UIScene');
        }

        this.add.rectangle(0, 0, 800, 600, 0x0f141e).setOrigin(0);
        
        const g = this.add.graphics();
        g.fillStyle(0x05080c); 
        for(let i=0; i<800; i+=Math.random()*40 + 30) {
            const h = Math.random() * 200 + 100;
            g.fillRect(i, 600 - h, 50 + Math.random()*20, h);
            if (Math.random() > 0.5) {
                g.fillStyle(0xddaa55, 0.4);
                g.fillRect(i + 10, 600 - h + 20, 10, 10);
                g.fillStyle(0x05080c);
            }
        }
        g.fillStyle(0x020305); g.fillRect(0, 500, 800, 100);

        this.bgTraffic = this.add.group();
        this.time.addEvent({
            delay: 800,
            loop: true,
            callback: () => {
                const isRight = Math.random() > 0.5;
                const y = isRight ? 530 : 570;
                const color = isRight ? 0xff0000 : 0xffffaa; 
                const rect = this.add.rectangle(isRight ? -10 : 810, y, 15, 6, color, 0.8);
                this.bgTraffic.add(rect);
                this.physics.add.existing(rect);
                (rect.body as Phaser.Physics.Arcade.Body).setVelocityX(isRight ? 200 : -200);
            }
        });

        this.add.text(400, 160, 'REWIND:\nLAST DELIVERY', { 
            fontSize: '64px', color: '#ffcc00', fontStyle: 'bold', align: 'center', stroke: '#000', strokeThickness: 8 
        }).setOrigin(0.5);
        
        this.add.text(400, 270, '"One mistake. One rewind. One last delivery."', { 
            fontSize: '22px', color: '#cccccc', fontStyle: 'italic', stroke: '#000', strokeThickness: 4 
        }).setOrigin(0.5);

        const ctrlBg = this.add.rectangle(400, 400, 350, 120, 0x000000, 0.6).setStrokeStyle(2, 0x444444);
        this.add.text(400, 400, 'WASD / ARROWS : Move & Drive\nE : Interact / Enter Car\nHold R : Rewind Time', { 
            fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 12 
        }).setOrigin(0.5);

        const startText = this.add.text(400, 520, '[ PRESS ENTER TO START ]', { fontSize: '26px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.tweens.add({ targets: startText, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 });

        this.input.keyboard!.once('keydown-ENTER', () => {
            audioSys.init(); 
            this.scene.start('GameScene');
        });
    }

    update() {
        this.bgTraffic.getChildren().forEach(child => {
            const rect = child as Phaser.GameObjects.Rectangle;
            if (rect.x > 850 || rect.x < -50) rect.destroy();
        });
    }
}

// --- CONFIGURATION ---
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false, gravity: { x: 0, y: 0 } }
    },
    scene: [BootScene, TitleScene, GameScene, UIScene]
};

new Phaser.Game(config);