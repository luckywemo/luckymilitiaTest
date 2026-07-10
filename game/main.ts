
import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene';
import { GameMode, CharacterClass, MissionConfig, MPConfig } from '../App';

export const createGame = (parent: HTMLElement, playerName: string, avatar: string | null, roomId: string | null, isHost: boolean, gameMode: GameMode, characterClass: CharacterClass, mission?: MissionConfig, mpConfig?: MPConfig, squad?: {name: string, team: 'alpha' | 'bravo'}[]) => {
  window.addEventListener('error', (e) => {
    console.error('[Global_Error] Caught in createGame context:', e.message, e.filename, e.lineno);
  });

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent: parent,
    width: 1280,
    height: 720,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, 
        debug: false,
      },
    },
    scene: [MainScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: { width: 1, height: 1 },
      max: { width: 4096, height: 4096 },
    },
    backgroundColor: '#0c0a09',
    transparent: false,
    antialias: true,
    autoFocus: true,
  };

  console.log('[Phaser] Initializing game with AUTO renderer...');
  const game = new Phaser.Game(config);
  game.scene.start('MainScene', { playerName, avatar, roomId, isHost, gameMode, characterClass, mission, mpConfig, squad });
  return game;
};
