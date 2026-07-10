/**
 * AISystem
 * ─────────
 * All bot AI logic: targeting, movement forces, LOS, cover-finding,
 * bullet avoidance, obstacle avoidance, and pathfinding.
 * Extracted from MainScene for modularity.
 *
 * All methods are static and take the Phaser scene and required groups
 * as parameters so this module has no circular dependency on MainScene.
 */

import Phaser from 'phaser';
import { WEAPONS_CONFIG } from './WeaponSystem';
import { BotData } from './types';

export interface AIUpdateContext {
  scene: Phaser.Scene;
  bot: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  time: number;
  difficultyModifier: number;
  playerTeam: 'alpha' | 'bravo';
  player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  otherPlayers: Map<string, Phaser.Types.Physics.Arcade.SpriteWithDynamicBody>;
  aiBots: Phaser.Physics.Arcade.Group;
  bullets: Phaser.Physics.Arcade.Group;
  wallLayer: Phaser.Tilemaps.TilemapLayer;
  safeZoneTimer: number;
  isMissionOver: boolean;
  mpConfig: { mode: string } | undefined;
  hardpointCenter: { x: number; y: number };
  botLastPositions: Map<string, { x: number; y: number; time: number }>;
  spawnBullet: (x: number, y: number, angle: number, weaponKey: string, owner: string, team: 'alpha' | 'bravo') => void;
  playSpatialSound: (key: string, x: number, y: number, vol: number) => void;
}

export class AISystem {
  static hasLineOfSight(
    wallLayer: Phaser.Tilemaps.TilemapLayer,
    fromX: number, fromY: number,
    toX: number, toY: number,
  ): boolean {
    const ray = new Phaser.Geom.Line(fromX, fromY, toX, toY);
    const wallTiles = wallLayer.getTilesWithinShape(ray);
    for (const tile of wallTiles) {
      if (tile.index !== -1 && tile.index !== 3) return false;
    }
    return true;
  }

  static getObstacleAvoidanceForce(
    bot: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    wallLayer: Phaser.Tilemaps.TilemapLayer,
  ): Phaser.Math.Vector2 {
    const force = new Phaser.Math.Vector2(0, 0);
    const lookAhead = 80;
    const velocity = bot.body.velocity;
    const speed = velocity.length();
    if (speed < 1) return force;

    const angle = Math.atan2(velocity.y, velocity.x);
    const checkAngles = [0, -Math.PI / 4, Math.PI / 4];

    checkAngles.forEach(offset => {
      const checkX = bot.x + Math.cos(angle + offset) * lookAhead;
      const checkY = bot.y + Math.sin(angle + offset) * lookAhead;
      const tile = wallLayer.getTileAtWorldXY(checkX, checkY);
      if (tile && (tile.index === 1 || tile.index === 2)) {
        const awayAngle = angle + offset + Math.PI;
        force.x += Math.cos(awayAngle) * 2.0;
        force.y += Math.sin(awayAngle) * 2.0;
      }
    });

    return force;
  }

  static getBulletAvoidanceForce(
    bot: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    bullets: Phaser.Physics.Arcade.Group,
  ): Phaser.Math.Vector2 {
    const force = new Phaser.Math.Vector2(0, 0);
    const detectionRadius = 150;
    const botTeam = bot.getData('team') as string;

    bullets.getChildren().forEach(rawB => {
      const b = rawB as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      if (!b.active) return;
      if (b.getData('team') === botTeam) return;
      const dist = Phaser.Math.Distance.Between(bot.x, bot.y, b.x, b.y);
      if (dist < detectionRadius) {
        const bulletVel = b.body.velocity;
        const toBullet = new Phaser.Math.Vector2(b.x - bot.x, b.y - bot.y);
        const dot = bulletVel.x * (-toBullet.x) + bulletVel.y * (-toBullet.y);
        if (dot > 0) {
          const perpX = -bulletVel.y;
          const perpY = bulletVel.x;
          const side = (toBullet.x * perpX + toBullet.y * perpY) > 0 ? 1 : -1;
          force.x += (perpX * side) / dist;
          force.y += (perpY * side) / dist;
        }
      }
    });

    return force.normalize();
  }

  static findCoverPosition(
    bot: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    target: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    wallLayer: Phaser.Tilemaps.TilemapLayer,
  ): { x: number; y: number } | null {
    const nearbyTiles = wallLayer.getTilesWithinWorldXY(bot.x - 400, bot.y - 400, 800, 800);
    const wallTiles = nearbyTiles.filter(t => t.index !== -1 && t.index !== 3);

    let bestCoverPos: { x: number; y: number } | null = null;
    let maxSafety = 0;

    wallTiles.forEach(tile => {
      const wallCenterX = tile.pixelX + 32;
      const wallCenterY = tile.pixelY + 32;
      const angleToTarget = Phaser.Math.Angle.Between(wallCenterX, wallCenterY, target.x, target.y);
      const coverX = wallCenterX + Math.cos(angleToTarget + Math.PI) * 45;
      const coverY = wallCenterY + Math.sin(angleToTarget + Math.PI) * 45;

      if (!AISystem.hasLineOfSight(wallLayer, coverX, coverY, target.x, target.y)) {
        const dist = Phaser.Math.Distance.Between(bot.x, bot.y, coverX, coverY);
        const safety = 1000 / (dist + 1);
        if (safety > maxSafety) {
          maxSafety = safety;
          bestCoverPos = { x: coverX, y: coverY };
        }
      }
    });

    return bestCoverPos;
  }

  static updateBot(ctx: AIUpdateContext): void {
    const {
      bot, time, difficultyModifier, playerTeam, player, otherPlayers,
      aiBots, bullets, wallLayer, safeZoneTimer, isMissionOver,
      mpConfig, hardpointCenter, botLastPositions, spawnBullet, playSpatialSound,
    } = ctx;

    if (isMissionOver) { bot.body.stop(); return; }

    const team = bot.getData('team') as 'alpha' | 'bravo';
    const botHp = bot.getData('hp') as number;
    const maxHp = bot.getData('maxHp') as number;
    const healthPercent = botHp / maxHp;

    // 1. FIND NEAREST TARGET
    let nearestTarget: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
    let minDist = 800;

    if (playerTeam !== team) {
      const d = Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y);
      if (d < minDist) { nearestTarget = player; minDist = d; }
    }

    otherPlayers.forEach(p => {
      if (p.getData('team') !== team) {
        const d = Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y);
        if (d < minDist) { nearestTarget = p; minDist = d; }
      }
    });

    aiBots.getChildren().forEach(rawOther => {
      const other = rawOther as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      if (other !== bot && other.getData('team') !== team) {
        const d = Phaser.Math.Distance.Between(bot.x, bot.y, other.x, other.y);
        if (d < minDist) { nearestTarget = other; minDist = d; }
      }
    });

    // 2. COMPOSITE FORCE
    let finalForceX = 0;
    let finalForceY = 0;
    let moveSpeed = 160 * (0.8 + difficultyModifier * 0.2);

    const avoidance = AISystem.getBulletAvoidanceForce(bot, bullets);
    finalForceX += avoidance.x * 2.5;
    finalForceY += avoidance.y * 2.5;

    const obstacleAvoidance = AISystem.getObstacleAvoidanceForce(bot, wallLayer);
    finalForceX += obstacleAvoidance.x * 3.0;
    finalForceY += obstacleAvoidance.y * 3.0;

    aiBots.getChildren().forEach(rawTeammate => {
      const teammate = rawTeammate as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      if (teammate !== bot && teammate.getData('team') === team) {
        const dist = Phaser.Math.Distance.Between(bot.x, bot.y, teammate.x, teammate.y);
        if (dist < 120) {
          const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, bot.x, bot.y);
          const weight = (120 - dist) / 120;
          finalForceX += Math.cos(angle) * weight * 1.5;
          finalForceY += Math.sin(angle) * weight * 1.5;
        }
      }
    });

    if (nearestTarget) {
      const targetAngle = Phaser.Math.Angle.Between(bot.x, bot.y, nearestTarget.x, nearestTarget.y);

      if (healthPercent < 0.35) {
        const coverPos = AISystem.findCoverPosition(bot, nearestTarget, wallLayer);
        if (coverPos) {
          const coverAngle = Phaser.Math.Angle.Between(bot.x, bot.y, coverPos.x, coverPos.y);
          finalForceX += Math.cos(coverAngle) * 1.5;
          finalForceY += Math.sin(coverAngle) * 1.5;
          moveSpeed *= 1.2;
        } else {
          finalForceX -= Math.cos(targetAngle) * 1.2;
          finalForceY -= Math.sin(targetAngle) * 1.2;
        }
      } else {
        const wKey = bot.getData('weaponKey') as string;
        const optimalRange = wKey === 'shotgun' ? 150 : wKey === 'smg' ? 350 : 450;

        if (minDist > optimalRange + 50) {
          finalForceX += Math.cos(targetAngle);
          finalForceY += Math.sin(targetAngle);
        } else if (minDist < optimalRange - 50) {
          finalForceX -= Math.cos(targetAngle);
          finalForceY -= Math.sin(targetAngle);
        }

        const strafeDirection = (bot.getData('id') as string).charCodeAt(0) % 2 === 0 ? 1 : -1;
        const strafeAngle = targetAngle + (Math.PI / 2) * strafeDirection;
        const jitter = Math.sin(time * 0.005 + (bot.getData('id') as string).length) * 0.5;
        finalForceX += Math.cos(strafeAngle + jitter) * 0.8;
        finalForceY += Math.sin(strafeAngle + jitter) * 0.8;
      }

      if (mpConfig?.mode === 'HARDPOINT') {
        const objDist = Phaser.Math.Distance.Between(bot.x, bot.y, hardpointCenter.x, hardpointCenter.y);
        const objAngle = Phaser.Math.Angle.Between(bot.x, bot.y, hardpointCenter.x, hardpointCenter.y);
        const objPriority = (healthPercent > 0.5 && minDist > 300) ? 1.2 : 0.4;
        finalForceX += Math.cos(objAngle) * objPriority;
        finalForceY += Math.sin(objAngle) * objPriority;
      }

      if ((finalForceX !== 0 || finalForceY !== 0) && !isNaN(finalForceX) && !isNaN(finalForceY)) {
        const finalAngle = Math.atan2(finalForceY, finalForceX);
        const botId = bot.getData('id') as string;
        const lastPos = botLastPositions.get(botId);

        if (lastPos && time > lastPos.time + 1000) {
          const distTraveled = Phaser.Math.Distance.Between(lastPos.x, lastPos.y, bot.x, bot.y);
          if (distTraveled < 10) {
            const recoveryAngle = finalAngle + (Math.random() > 0.5 ? Math.PI : -Math.PI) * 0.5;
            bot.body.velocity.x = Math.cos(recoveryAngle) * moveSpeed * 1.5;
            bot.body.velocity.y = Math.sin(recoveryAngle) * moveSpeed * 1.5;
            botLastPositions.set(botId, { x: bot.x, y: bot.y, time: time + 500 });
            return;
          }
          botLastPositions.set(botId, { x: bot.x, y: bot.y, time });
        } else if (!lastPos) {
          botLastPositions.set(botId, { x: bot.x, y: bot.y, time });
        }

        Phaser.Physics.Arcade.ArcadePhysics.prototype;
        bot.scene.physics.velocityFromRotation(finalAngle, moveSpeed, bot.body.velocity);
      }

      // 4. AIMING & SHOOTING
      const aimAngle = Phaser.Math.Angle.Between(bot.x, bot.y, nearestTarget.x, nearestTarget.y);
      bot.rotation = aimAngle;

      const wConfig = WEAPONS_CONFIG[bot.getData('weaponKey') as string] ?? WEAPONS_CONFIG.pistol;
      const delay = Math.max(0.7, 2.2 / difficultyModifier);

      if (time > (bot.getData('lastShot') as number) + wConfig.fireRate * delay) {
        const hasLOS = AISystem.hasLineOfSight(wallLayer, bot.x, bot.y, nearestTarget.x, nearestTarget.y);
        const targetInSafeZone = safeZoneTimer > 0 && nearestTarget === player;

        if (minDist < 800 && hasLOS && !targetInSafeZone && healthPercent > 0.15) {
          const baseAimError = (minDist / 800) * 0.35;
          const difficultyFactor = 1 - (difficultyModifier - 1) * 0.25;
          const aimError = baseAimError * difficultyFactor;

          for (let i = 0; i < wConfig.bullets; i++) {
            const bulletAngle = aimAngle + (Math.random() - 0.5) * (wConfig.spread + aimError);
            spawnBullet(bot.x, bot.y, bulletAngle, wConfig.key, 'bot', team);
          }
          bot.setData('lastShot', time);
          playSpatialSound(
            wConfig.category === 'pistol' ? 'sfx_pistol' : 'sfx_shotgun',
            bot.x, bot.y, 0.4,
          );
        }
      }
    } else {
      // PATROL when no target
      if (!bot.getData('patrolTarget') || Math.random() < 0.005) {
        bot.setData('patrolTarget', {
          x: Phaser.Math.Between(300, 1700),
          y: Phaser.Math.Between(300, 1700),
        });
      }
      const patrol = bot.getData('patrolTarget') as { x: number; y: number };
      const patrolAngle = Phaser.Math.Angle.Between(bot.x, bot.y, patrol.x, patrol.y);
      bot.scene.physics.velocityFromRotation(patrolAngle, 80, bot.body.velocity);
      bot.rotation = patrolAngle;
    }
  }
}
