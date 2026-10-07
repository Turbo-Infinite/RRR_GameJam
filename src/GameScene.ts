import Phaser from 'phaser';
import { audioSys, RewindSystem, Snapshot } from './systems';
import { UIScene } from './UIScene';

export class GameScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private car!: Phaser.Physics.Arcade.Sprite;
    private police!: Phaser.Physics.Arcade.Sprite;
    private npc!: Phaser.Physics.Arcade.Sprite;
    
    private buildings!: Phaser.Physics.Arcade.StaticGroup;
    private traffic!: Phaser.Physics.Arcade.Group;
    private roadblock!: Phaser.Physics.Arcade.Sprite;
    private trafficLightBase!: Phaser.GameObjects.Sprite;
    private trafficLightBulb!: Phaser.GameObjects.Sprite;
    
    private stopLineZone!: Phaser.GameObjects.Zone;
    private deliveryZone!: Phaser.GameObjects.Zone;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
    private keyE!: Phaser.Input.Keyboard.Key;
    private keyR!: Phaser.Input.Keyboard.Key;
    private keyEnter!: Phaser.Input.Keyboard.Key;

    private ui!: UIScene;
    private rewindSys!: RewindSystem;

    // States
    private inCar = false;
    private isRewinding = false;
    private missionState = 0; // 0: Start, 1: Talking, 2: Drive, 3: Completed
    private cash = 0;
    private wantedLevel = 0;
    private violationTriggered = false;
    private timelineAltered = false;
    private hadViolationBeforeRewind = false; 
    
    // Traffic Light System
    private tlTimer = 0;
    private tlState = 0; // 0=Green, 1=Yellow, 2=Red

    private markerGraphics!: Phaser.GameObjects.Graphics;

    constructor() { super({ key: 'GameScene' }); }

    create() {
        this.scene.launch('UIScene');
        this.ui = this.scene.get('UIScene') as UIScene;
        this.rewindSys = new RewindSystem();
        this.rewindSys.clear();
        
        audioSys.startEngine();

        this.cameras.main.setBackgroundColor(0x3d2b1f);
        this.physics.world.setBounds(0, 0, 1600, 1200);
        this.cameras.main.setBounds(0, 0, 1600, 1200); 

        this.markerGraphics = this.add.graphics().setDepth(10);

        this.buildDistricts();
        this.setupEntities();
        this.setupCollisions();

        // Input Setup
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;
        this.keyE = this.input.keyboard!.addKey('E');
        this.keyR = this.input.keyboard!.addKey('R');
        this.keyEnter = this.input.keyboard!.addKey('ENTER');

        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setZoom(1.5);
    }

    private isUp() { return this.cursors.up.isDown || this.wasd.W.isDown; }
    private isDown() { return this.cursors.down.isDown || this.wasd.S.isDown; }
    private isLeft() { return this.cursors.left.isDown || this.wasd.A.isDown; }
    private isRight() { return this.cursors.right.isDown || this.wasd.D.isDown; }

    private buildDistricts() {
        const g = this.add.graphics();
        g.fillStyle(0x242424);
        
        g.fillRect(0, 550, 1600, 100); 
        g.fillRect(750, 0, 100, 1200); 
        g.fillRect(150, 150, 600, 80); 
        g.fillRect(150, 150, 80, 400); 

        g.lineStyle(2, 0xddddcc, 0.6);
        for(let i=0; i<1600; i+=40) { g.beginPath(); g.moveTo(i, 600); g.lineTo(i+20, 600); g.strokePath(); }
        for(let y=0; y<1200; y+=40) { g.beginPath(); g.moveTo(800, y); g.lineTo(800, y+20); g.strokePath(); }

        this.buildings = this.physics.add.staticGroup();
        
        this.buildings.create(350, 350, 'build_res').setScale(2).refreshBody();
        this.buildings.create(550, 350, 'build_res').setScale(2).refreshBody();
        this.buildings.create(350, 100, 'build_res').setScale(2).refreshBody();
        
        this.buildings.create(1000, 200, 'build_market').setScale(3).refreshBody();
        this.buildings.create(1250, 200, 'build_market').setScale(3).refreshBody();
        this.add.sprite(900, 350, 'stall'); this.add.sprite(1100, 400, 'stall');

        this.add.rectangle(350, 900, 500, 400, 0x3d6e35);
        this.add.sprite(200, 800, 'tree'); this.add.sprite(400, 850, 'tree'); this.add.sprite(300, 1000, 'tree');

        this.buildings.create(1200, 900, 'build_ind').setScale(3, 4).refreshBody();

        this.trafficLightBase = this.add.sprite(880, 520, 'tl_base');
        this.trafficLightBulb = this.add.sprite(880, 520, 'tl_green');
        
        g.fillStyle(0xffffff, 0.8); g.fillRect(750, 540, 100, 10);
        this.stopLineZone = this.add.zone(800, 545, 100, 20);
        this.physics.add.existing(this.stopLineZone, true);

        this.roadblock = this.physics.add.sprite(1000, 600, 'roadblock').setScale(1.5).setImmovable(true);
        this.roadblock.disableBody(true, true);

        this.add.rectangle(1300, 1100, 150, 150, 0x00ff00, 0.2);
        this.deliveryZone = this.add.zone(1300, 1100, 150, 150);
        this.physics.add.existing(this.deliveryZone, true);
    }

    private fitVehicleSprite(car: Phaser.Physics.Arcade.Sprite, baseRotDeg: number = 0) {
        // 1. Existing collision body dimensions
        const targetL = 40;
        const targetW = 20;

        // 2 & 3 & 4. Scale PNG preserving aspect ratio to visually fill the 40x20 footprint
        const scale = Math.max(targetL / car.width, targetW / car.height);
        car.setScale(scale);

        // 5. Lock physics body precisely to 40x20 (unscaled equivalent) and center it
        const body = car.body as Phaser.Physics.Arcade.Body;
        body.setSize(targetL / scale, targetW / scale, true);

        // 6. Apply visual rotation offset (Counter-Clockwise 90 deg)
        car.setAngle(baseRotDeg - 90);
    }

    private setupEntities() {
        this.player = this.physics.add.sprite(200, 200, 'player');
        this.player.setCollideWorldBounds(true);

        this.npc = this.physics.add.sprite(250, 200, 'npc').setImmovable(true);
        
        this.car = this.physics.add.sprite(200, 260, 'car_player');
        this.fitVehicleSprite(this.car, 0);
        this.car.setCollideWorldBounds(true);
        this.car.setBounce(0.05); 
        this.car.setMass(1500);   
        
        this.police = this.physics.add.sprite(-100, -100, 'car_police');
        this.fitVehicleSprite(this.police, 0);
        this.police.setBounce(0.05);
        this.police.setMass(1500);
        this.police.disableBody(true, true);

        this.traffic = this.physics.add.group();
        
        const initTrafficCar = (x: number, y: number, key: string, dir: string, rot: number) => {
            const tCar = this.traffic.create(x, y, key) as Phaser.Physics.Arcade.Sprite;
            this.fitVehicleSprite(tCar, rot);
            tCar.setImmovable(true).setBounce(0).setMass(2500);
            tCar.setData('dir', dir);
            tCar.setData('currentSpeed', 150);
            tCar.setData('blocked', false);
            tCar.setData('clearTimer', 0);
            tCar.setData('blockedTimer', 0);
            return tCar;
        };

        initTrafficCar(100, 625, 'car_traffic1', 'E', 0);
        initTrafficCar(1500, 575, 'car_traffic2', 'W', 180);
        initTrafficCar(825, 1100, 'car_traffic1', 'N', -90);
    }

    private setupCollisions() {
        this.physics.add.collider(this.player, this.buildings);
        this.physics.add.collider(this.player, this.car);
        this.physics.add.collider(this.car, this.buildings);
        this.physics.add.collider(this.car, this.roadblock);
        
        this.physics.add.collider(this.car, this.traffic, this.handleTrafficCollision, undefined, this);
        
        this.physics.add.collider(this.police, this.buildings);
        this.physics.add.collider(this.police, this.car);
        this.physics.add.collider(this.police, this.traffic);

        this.physics.add.overlap(this.car, this.stopLineZone, this.triggerViolation, undefined, this);
        this.physics.add.overlap(this.car, this.deliveryZone, this.completeMission, undefined, this);
    }

    private handleTrafficCollision(playerCar: any, trafficCar: any) {
        const tCar = trafficCar as Phaser.Physics.Arcade.Sprite;
        
        tCar.setData('blocked', true);
        tCar.setData('clearTimer', 0);
        tCar.setData('currentSpeed', 0); 
        
        const pBody = this.car.body as Phaser.Physics.Arcade.Body;
        pBody.velocity.x *= 0.5;
        pBody.velocity.y *= 0.5;
    }

    update(time: number, delta: number) {
        if (this.missionState === 3) {
            this.car.setVelocity(0, 0);
            this.player.setVelocity(0, 0);
            this.updateAudio(); 
            if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
                this.scene.start('TitleScene');
            }
            return; 
        }

        if (this.keyR.isDown && this.rewindSys.hasHistory()) {
            if (!this.isRewinding) {
                this.isRewinding = true;
                this.hadViolationBeforeRewind = this.violationTriggered; 
                this.ui.hideAlert();
            }
            this.processRewind(time);
            return; 
        } else if (!this.keyR.isDown && this.isRewinding) {
            this.isRewinding = false;
            this.checkTimelineConsequences();
        }
        
        this.ui.setRewindFX(false);
        this.recordState();
        
        this.updateTrafficLight(delta);
        this.handleInput(delta);
        this.updateTraffic(delta);
        this.updatePolice();
        this.updateAudio();
        this.updateMarkers();
        this.updateUIStatus();
    }

    private updateTrafficLight(delta: number) {
        this.tlTimer += delta;
        if (this.tlState === 0 && this.tlTimer > 5000) { this.tlState = 1; this.tlTimer = 0; this.trafficLightBulb.setTexture('tl_yellow'); }
        else if (this.tlState === 1 && this.tlTimer > 2000) { this.tlState = 2; this.tlTimer = 0; this.trafficLightBulb.setTexture('tl_red'); }
        else if (this.tlState === 2 && this.tlTimer > 5000) { this.tlState = 0; this.tlTimer = 0; this.trafficLightBulb.setTexture('tl_green'); }
    }

    private handleInput(delta: number) {
        const pressedE = Phaser.Input.Keyboard.JustDown(this.keyE);
        const dt = delta / 1000;

        if (this.inCar) {
            const body = this.car.body as Phaser.Physics.Arcade.Body;
            
            const physicsAngle = this.car.rotation + (Math.PI / 2);
            
            const fwdX = Math.cos(physicsAngle);
            const fwdY = Math.sin(physicsAngle);
            const rightX = -fwdY;
            const rightY = fwdX;

            let vX = body.velocity.x;
            let vY = body.velocity.y;
            let fwdSpeed = (vX * fwdX) + (vY * fwdY);
            let sideSpeed = (vX * rightX) + (vY * rightY);

            let accel = 0;
            if (this.isUp()) {
                accel = 350;
            } else if (this.isDown()) {
                if (fwdSpeed > 20) accel = -500; 
                else accel = -200; 
            }

            fwdSpeed += accel * dt;

            if (!this.isUp() && !this.isDown()) {
                fwdSpeed *= 0.96;
                if (Math.abs(fwdSpeed) < 2) fwdSpeed = 0;
            }

            if (fwdSpeed > 220) fwdSpeed = 220;
            if (fwdSpeed < -100) fwdSpeed = -100;

            sideSpeed *= 0.82; 

            body.velocity.x = (fwdSpeed * fwdX) + (sideSpeed * rightX);
            body.velocity.y = (fwdSpeed * fwdY) + (sideSpeed * rightY);

            if (Math.abs(fwdSpeed) > 5) {
                const turnDir = fwdSpeed > 0 ? 1 : -1; 
                let turnAmount = 0;
                
                if (this.isLeft()) turnAmount = -1;
                else if (this.isRight()) turnAmount = 1;

                const speedFactor = Math.max(0.6, 1.2 - (Math.abs(fwdSpeed) / 220) * 0.4);
                this.car.setAngularVelocity(turnAmount * 150 * turnDir * speedFactor);
            } else {
                this.car.setAngularVelocity(0);
            }

            if (body.velocity.lengthSq() > 300 * 300) {
                body.velocity.normalize().scale(300);
            }

        } else {
            const carBody = this.car.body as Phaser.Physics.Arcade.Body;
            carBody.velocity.x *= 0.90;
            carBody.velocity.y *= 0.90;
            if (carBody.velocity.lengthSq() < 1) carBody.velocity.set(0, 0);
            this.car.setAngularVelocity(0);

            const speed = 160;
            let vx = 0, vy = 0;
            if (this.isLeft()) vx = -1;
            else if (this.isRight()) vx = 1;
            if (this.isUp()) vy = -1;
            else if (this.isDown()) vy = 1;

            const vec = new Phaser.Math.Vector2(vx, vy).normalize().scale(speed);
            this.player.setVelocity(vec.x, vec.y);
            if (vec.lengthSq() > 0) this.player.setRotation(vec.angle());
        }

        if (this.ui.isDialogueOpen()) {
            this.ui.showPrompt('');
            if (pressedE) {
                this.ui.advanceDialogue();
            }
        } 
        else if (this.inCar) {
            this.ui.showPrompt('[E] Exit Vehicle');
            if (pressedE) {
                audioSys.playInteract();
                this.inCar = false;
                this.player.setPosition(this.car.x - 35, this.car.y);
                this.player.setActive(true).setVisible(true);
                (this.player.body as Phaser.Physics.Arcade.Body).enable = true;
                
                this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            }
        } 
        else {
            const distCar = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.car.x, this.car.y);
            const distNPC = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y);
            
            const canTalkNPC = (this.missionState === 0) && (distNPC < 60);
            const canEnterCar = distCar < 50;
            
            if (canTalkNPC && (!canEnterCar || distNPC <= distCar)) {
                this.ui.showPrompt('[E] Talk to Contact');
                if (pressedE) {
                    audioSys.playInteract();
                    this.missionState = 1;
                    this.ui.startDialogue([
                        "CONTACT:\n\nI've got one last delivery for you.",
                        "Take this package to the drop-off zone out East.",
                        "And this time...\n\nDon't screw it up."
                    ], () => {
                        audioSys.playAccept();
                        this.missionState = 2;
                    });
                }
            } 
            else if (canEnterCar) {
                this.ui.showPrompt('[E] Enter Vehicle');
                if (pressedE) {
                    audioSys.playInteract();
                    this.inCar = true;
                    this.player.setActive(false).setVisible(false);
                    (this.player.body as Phaser.Physics.Arcade.Body).enable = false;
                    this.cameras.main.startFollow(this.car, true, 0.1, 0.1);
                }
            } 
            else {
                this.ui.showPrompt('');
            }
        }
    }

    private triggerViolation() {
        if (this.missionState === 2 && this.inCar && !this.violationTriggered && !this.timelineAltered) {
            if (this.tlState === 2) { 
                this.violationTriggered = true;
                this.wantedLevel = 1;
                audioSys.playAlert();
                
                this.ui.showAlert('🚨 TRAFFIC VIOLATION!\n\nYou ran a red light!\nThe police are after you!\n\nHOLD R TO REWIND');
                this.police.enableBody(true, this.car.x - 300, this.car.y, true, true);
            }
        }
    }

    private completeMission() {
        if (this.missionState === 2 && this.inCar) {
            this.missionState = 3;
            this.cash += 500;
            audioSys.playAccept();
            this.ui.showCompletion();
        }
    }

    private updateTraffic(delta: number) {
        this.traffic.getChildren().forEach((child: any) => {
            const c = child as Phaser.Physics.Arcade.Sprite;
            const dir = c.getData('dir');
            
            let isBlocked = c.getData('blocked');
            let clearTimer = c.getData('clearTimer');
            let blockedTimer = c.getData('blockedTimer');
            let currentSpeed = c.getData('currentSpeed');
            
            let redLightStop = false;
            if (this.tlState === 2) {
                if (dir === 'E' && c.x > 650 && c.x < 740) redLightStop = true;
                if (dir === 'W' && c.x < 950 && c.x > 860) redLightStop = true;
                if (dir === 'N' && c.y < 700 && c.y > 610) redLightStop = true;
            }

            if (isBlocked) {
                blockedTimer += delta;
                
                let hasClearance = true;
                const dist = Phaser.Math.Distance.Between(c.x, c.y, this.car.x, this.car.y);
                const dx = this.car.x - c.x;
                const dy = this.car.y - c.y;
                
                if (dist < 130) {
                    if (dir === 'E' && dx > 0 && Math.abs(dy) < 50) hasClearance = false;
                    if (dir === 'W' && dx < 0 && Math.abs(dy) < 50) hasClearance = false;
                    if (dir === 'N' && dy < 0 && Math.abs(dx) < 50) hasClearance = false;
                }
                
                if (dist < 60) hasClearance = false;

                if (hasClearance) {
                    clearTimer += delta;
                    if (clearTimer > 600) { 
                        isBlocked = false;
                        blockedTimer = 0;
                        clearTimer = 0;
                    }
                } else {
                    clearTimer = 0;
                }
                
                c.setData('blocked', isBlocked);
                c.setData('clearTimer', clearTimer);
                c.setData('blockedTimer', blockedTimer);
            }

            let targetSpeed = 150;
            if (redLightStop || isBlocked) {
                targetSpeed = 0;
                if (isBlocked && blockedTimer > 3000) {
                    targetSpeed = -30;
                }
            }

            if (currentSpeed < targetSpeed) {
                currentSpeed += (targetSpeed - currentSpeed) * 0.05; 
                if (currentSpeed > targetSpeed) currentSpeed = targetSpeed;
            } else if (currentSpeed > targetSpeed) {
                currentSpeed += (targetSpeed - currentSpeed) * 0.2; 
                if (currentSpeed < targetSpeed) currentSpeed = targetSpeed;
            }
            
            if (Math.abs(currentSpeed) < 1) currentSpeed = 0;
            c.setData('currentSpeed', currentSpeed);

            if (dir === 'E') { 
                c.setVelocity(currentSpeed, 0); 
                if(c.x > 1650) { c.x = -50; c.setData('blocked', false); }
            }
            if (dir === 'W') { 
                c.setVelocity(-currentSpeed, 0); 
                if(c.x < -50) { c.x = 1650; c.setData('blocked', false); }
            }
            if (dir === 'N') { 
                c.setVelocity(0, -currentSpeed); 
                if(c.y < -50) { c.y = 1250; c.setData('blocked', false); }
            }
        });
    }

    private updatePolice() {
        if (this.wantedLevel > 0 && this.police.active) {
            if (Math.random() < 0.03) audioSys.playSiren();
            const target = this.inCar ? this.car : this.player;
            this.physics.moveToObject(this.police, target, 240); 
            this.police.rotation = Phaser.Math.Angle.Between(this.police.x, this.police.y, target.x, target.y) - (Math.PI / 2);
        } else if (this.police.active) {
            this.police.disableBody(true, true);
        }
    }

    private updateAudio() {
        if (this.inCar && this.missionState !== 3) {
            const speed = (this.car.body as Phaser.Physics.Arcade.Body).velocity.length();
            audioSys.updateEngine(speed, true);
        } else {
            audioSys.updateEngine(0, false);
        }
    }

    private updateMarkers() {
        this.markerGraphics.clear();
        const timeOffset = Math.sin(this.time.now / 200) * 5;

        if (this.missionState === 0) {
            this.markerGraphics.fillStyle(0xffff00);
            this.markerGraphics.fillTriangle(this.npc.x, this.npc.y - 20 + timeOffset, this.npc.x - 10, this.npc.y - 35 + timeOffset, this.npc.x + 10, this.npc.y - 35 + timeOffset);
        } else if (this.missionState === 2) {
            this.markerGraphics.fillStyle(0x00ff00);
            this.markerGraphics.fillTriangle(1375, 1175 + timeOffset, 1360, 1150 + timeOffset, 1390, 1150 + timeOffset);
        }
    }

    private recordState() {
        const cBody = this.car.body as Phaser.Physics.Arcade.Body;
        const trafficData = this.traffic.getChildren().map((c:any) => ({ x: c.x, y: c.y, rot: c.rotation }));
        
        this.rewindSys.record({
            player: { x: this.player.x, y: this.player.y, rot: this.player.rotation, inCar: this.inCar },
            car: { x: this.car.x, y: this.car.y, rot: this.car.rotation, vx: cBody.velocity.x, vy: cBody.velocity.y },
            police: { active: this.police.active, x: this.police.x, y: this.police.y, rot: this.police.rotation },
            traffic: trafficData,
            state: { mission: this.missionState, wanted: this.wantedLevel, violation: this.violationTriggered, light: this.tlState }
        });
    }

    private processRewind(time: number) {
        const snap = this.rewindSys.rewindStep(5);
        
        if (!snap) {
            this.isRewinding = false;
            this.checkTimelineConsequences();
            return;
        }

        audioSys.playRewind(time);
        this.ui.setRewindFX(true);

        this.inCar = snap.player.inCar;
        this.missionState = snap.state.mission;
        this.wantedLevel = snap.state.wanted;
        this.violationTriggered = snap.state.violation;
        
        this.tlState = snap.state.light;
        if(this.tlState === 0) this.trafficLightBulb.setTexture('tl_green');
        else if(this.tlState === 1) this.trafficLightBulb.setTexture('tl_yellow');
        else this.trafficLightBulb.setTexture('tl_red');

        this.player.setPosition(snap.player.x, snap.player.y).setRotation(snap.player.rot);
        this.player.setActive(!this.inCar).setVisible(!this.inCar);
        (this.player.body as Phaser.Physics.Arcade.Body).enable = !this.inCar;

        this.car.setPosition(snap.car.x, snap.car.y).setRotation(snap.car.rot).setVelocity(snap.car.vx, snap.car.vy);
        
        if (snap.police.active) {
            if (!this.police.active) this.police.enableBody(true, snap.police.x, snap.police.y, true, true);
            else this.police.setPosition(snap.police.x, snap.police.y).setRotation(snap.police.rot);
        } else {
            this.police.disableBody(true, true);
        }

        const tChildren = this.traffic.getChildren();
        snap.traffic.forEach((tData, i) => {
            const c = tChildren[i] as Phaser.Physics.Arcade.Sprite;
            if (c) c.setPosition(tData.x, tData.y).setRotation(tData.rot);
        });
        
        this.cameras.main.startFollow(this.inCar ? this.car : this.player, true, 0.1, 0.1);
    }

    private checkTimelineConsequences() {
        if (this.hadViolationBeforeRewind && !this.violationTriggered && !this.timelineAltered) {
            this.timelineAltered = true;
            this.roadblock.enableBody(true, 1000, 600, true, true);
        }
        this.hadViolationBeforeRewind = false;
        
        this.cameras.main.startFollow(this.inCar ? this.car : this.player, true, 0.1, 0.1);
    }

    private updateUIStatus() {
        let mStr = "Find Contact";
        if (this.missionState === 1) mStr = "Listen to Contact";
        if (this.missionState === 2) mStr = "Deliver Package (South-East)";
        if (this.missionState === 3) mStr = "Complete!";
        this.ui.updateHUD(mStr, this.cash, this.wantedLevel);
    }
}