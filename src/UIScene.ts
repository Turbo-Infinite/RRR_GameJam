import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    private missionText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    private promptText!: Phaser.GameObjects.Text;
    
    private alertPanel!: Phaser.GameObjects.Container;
    private alertBg!: Phaser.GameObjects.Rectangle;
    private alertText!: Phaser.GameObjects.Text;
    
    private dialoguePanel!: Phaser.GameObjects.Container;
    private dialogueText!: Phaser.GameObjects.Text;
    private dialogueQueue: string[] = [];
    private onDialogueComplete: (() => void) | null = null;
    
    private rewindOverlay!: Phaser.GameObjects.Rectangle;
    private rewindLabel!: Phaser.GameObjects.Text;

    private completionPanel!: Phaser.GameObjects.Container;

    constructor() { super({ key: 'UIScene' }); }

    create() {
        const { width, height } = this.scale;

        // Top HUD
        this.missionText = this.add.text(10, 10, 'MISSION: Find Contact', { fontSize: '20px', color: '#ffcc00', backgroundColor: '#000000bb', padding: { x: 10, y: 10 } });
        this.statsText = this.add.text(width - 10, 10, 'CASH: $0\nWANTED: 0', { fontSize: '20px', color: '#fff', align: 'right', backgroundColor: '#000000bb', padding: { x: 10, y: 10 } }).setOrigin(1, 0);
        
        // Interaction Prompt
        this.promptText = this.add.text(width / 2, height - 60, '', { fontSize: '22px', color: '#fff', backgroundColor: '#000000cc', padding: { x: 15, y: 8 } }).setOrigin(0.5);

        // Alert Panel
        this.alertBg = this.add.rectangle(0, 0, 450, 120, 0x880000, 0.95).setStrokeStyle(3, 0xffffff);
        this.alertText = this.add.text(0, 0, '', { fontSize: '22px', color: '#fff', align: 'center', fontStyle: 'bold' }).setOrigin(0.5);
        this.alertPanel = this.add.container(width / 2, height / 4, [this.alertBg, this.alertText]).setVisible(false);

        // Dialogue Panel
        const diagBg = this.add.rectangle(0, 0, 600, 140, 0x111111, 0.98).setStrokeStyle(3, 0xffcc00);
        this.dialogueText = this.add.text(0, 0, '', { fontSize: '20px', color: '#fff', align: 'center', wordWrap: { width: 560 } }).setOrigin(0.5);
        const diagPrompt = this.add.text(280, 50, '[E] Next', { fontSize: '14px', color: '#aaaaaa' }).setOrigin(1, 1);
        this.dialoguePanel = this.add.container(width / 2, height - 100, [diagBg, this.dialogueText, diagPrompt]).setVisible(false);

        // Rewind FX
        this.rewindOverlay = this.add.rectangle(0, 0, width, height, 0x2200cc, 0.4).setOrigin(0).setVisible(false);
        this.rewindLabel = this.add.text(width / 2, height / 2, '⏪ REWINDING', { fontSize: '56px', color: '#ffffff', fontStyle: 'italic bold' }).setOrigin(0.5).setVisible(false).setStroke('#000', 6);

        // Final Completion Panel
        const compBg = this.add.rectangle(0, 0, width, height, 0x000000, 0.85);
        const compTitle = this.add.text(0, -100, 'MISSION COMPLETE', { fontSize: '48px', color: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5);
        const compSub = this.add.text(0, -10, 'DELIVERY SUCCESSFUL\n\nCASH EARNED: $500\n\nTIMELINE CHANGED.', { fontSize: '24px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
        const compPromptText = this.add.text(0, 160, '[ PRESS ENTER TO RETURN TO TITLE ]', { fontSize: '22px', color: '#ffcc00' }).setOrigin(0.5);
        this.tweens.add({ targets: compPromptText, alpha: 0.2, yoyo: true, repeat: -1, duration: 800 });
        this.completionPanel = this.add.container(width / 2, height / 2, [compBg, compTitle, compSub, compPromptText]).setVisible(false);
    }

    updateHUD(missionStr: string, cash: number, wanted: number) {
        this.missionText.setText(`MISSION: ${missionStr}`);
        this.statsText.setText(`CASH: $${cash}\nWANTED: ${wanted > 0 ? '⭐'.repeat(wanted) : '0'}`);
    }

    showPrompt(text: string) { 
        this.promptText.setText(text).setVisible(text !== ''); 
    }
    
    isDialogueOpen(): boolean {
        return this.dialoguePanel.visible;
    }

    startDialogue(lines: string[], onComplete: () => void) {
        this.dialogueQueue = lines;
        this.onDialogueComplete = onComplete;
        this.advanceDialogue();
        this.dialoguePanel.setVisible(true);
    }

    advanceDialogue(): void {
        if (!this.dialoguePanel.visible) return;
        
        if (this.dialogueQueue.length > 0) {
            this.dialogueText.setText(this.dialogueQueue.shift()!);
        } else {
            this.dialoguePanel.setVisible(false);
            if (this.onDialogueComplete) this.onDialogueComplete();
        }
    }

    showAlert(text: string, color: number = 0x880000) {
        this.alertBg.fillColor = color;
        this.alertText.setText(text);
        this.alertPanel.setVisible(true);
    }

    hideAlert() { 
        this.alertPanel.setVisible(false); 
    }

    setRewindFX(active: boolean) {
        this.rewindOverlay.setVisible(active);
        this.rewindLabel.setVisible(active);
        if (active) this.cameras.main.shake(100, 0.005);
    }

    showCompletion() {
        this.completionPanel.setVisible(true);
        this.missionText.setVisible(false);
        this.statsText.setVisible(false);
        this.promptText.setVisible(false);
        this.alertPanel.setVisible(false);
    }
}