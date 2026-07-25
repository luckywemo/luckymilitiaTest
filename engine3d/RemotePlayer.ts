import * as THREE from 'three';

export interface RemotePlayerConfig {
  id: string;
  name: string;
  team: 'alpha' | 'bravo';
}

export class RemotePlayer {
  public group: THREE.Group;
  public id: string;
  public name: string;
  public team: 'alpha' | 'bravo';
  public hp = 100;
  public isDead = false;
  public kills = 0;
  public deaths = 0;
  public score = 0;
  public ping = 0;
  public isDisconnected = false;
  public spawnProtectTimer = 0;

  public body: THREE.Mesh;
  public head: THREE.Mesh;
  private nameLabel: THREE.Sprite;
  private weaponMesh: THREE.Mesh;
  private teamRing: THREE.Mesh;
  private hpBar: THREE.Sprite;
  private hpBarBg: THREE.Mesh;
  private shieldBubble: THREE.Mesh;
  private disconnectLabel: THREE.Sprite;

  // Interpolation
  private targetPos = new THREE.Vector3();
  private targetYaw = 0;
  private currentPos = new THREE.Vector3();
  private currentYaw = 0;
  private prevPos = new THREE.Vector3();
  private stepDistance = 0;
  private stepTimer = 0;

  // Hit flash
  private hitFlash = 0;

  // Death animation
  private deathTimer = 0;

  private static makeHpBar(): { sprite: THREE.Sprite; bg: THREE.Mesh } {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, 64, 8);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.0, 0.12, 1);
    sprite.position.set(0, 2.0, 0);
    const bgGeo = new THREE.PlaneGeometry(1.02, 0.14);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 2.0, 0);
    return { sprite, bg };
  }

  private static makeDisconnectLabel(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,0,0,0.8)';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DISCONNECTED', 64, 22);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.4, 1);
    sprite.position.set(0, 2.5, 0);
    sprite.visible = false;
    return sprite;
  }

  private static makeNameLabel(name: string, team: 'alpha' | 'bravo'): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = team === 'alpha' ? 'rgba(249,115,22,0.8)' : 'rgba(34,211,238,0.8)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase().slice(0, 12), 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.4, 1);
    sprite.position.set(0, 2.2, 0);
    return sprite;
  }

  constructor(config: RemotePlayerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.team = config.team;

    this.group = new THREE.Group();

    const teamColor = config.team === 'alpha' ? 0xf97316 : 0x22d3ee;
    const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.7, metalness: 0.3 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcc9966, roughness: 0.6 });

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), bodyMat);
    this.body.position.y = 0.8;
    this.body.castShadow = true;
    this.group.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), headMat);
    this.head.position.y = 1.6;
    this.head.castShadow = true;
    this.head.userData.isHead = true;
    this.group.add(this.head);

    // Weapon (simple box)
    this.weaponMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.15, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.7 })
    );
    this.weaponMesh.position.set(0.3, 1.0, -0.3);
    this.group.add(this.weaponMesh);

    // Team ring on ground
    const ringGeo = new THREE.RingGeometry(0.5, 0.65, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: teamColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    this.teamRing = new THREE.Mesh(ringGeo, ringMat);
    this.teamRing.rotation.x = -Math.PI / 2;
    this.teamRing.position.y = 0.02;
    this.group.add(this.teamRing);

    // Name label
    this.nameLabel = RemotePlayer.makeNameLabel(config.name, config.team);
    this.group.add(this.nameLabel);

    // HP bar
    const hpBarResult = RemotePlayer.makeHpBar();
    this.hpBar = hpBarResult.sprite;
    this.hpBarBg = hpBarResult.bg;
    this.group.add(this.hpBarBg);
    this.group.add(this.hpBar);

    // Shield bubble (spawn protection)
    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2, wireframe: true })
    );
    this.shieldBubble.position.y = 0.8;
    this.shieldBubble.visible = false;
    this.group.add(this.shieldBubble);

    // Disconnect label
    this.disconnectLabel = RemotePlayer.makeDisconnectLabel();
    this.group.add(this.disconnectLabel);
  }

  setTargetState(x: number, y: number, z: number, yaw: number, isDead: boolean, hp: number) {
    this.prevPos.copy(this.targetPos);
    this.targetPos.set(x, y, z);
    this.stepDistance += this.prevPos.distanceTo(this.targetPos);
    this.targetYaw = yaw;
    this.isDead = isDead;
    this.hp = hp;
  }

  setDisconnected(disconnected: boolean) {
    this.isDisconnected = disconnected;
    this.disconnectLabel.visible = disconnected;
  }

  triggerSpawnProtection(duration: number) {
    this.spawnProtectTimer = duration;
  }

  getFootstepTrigger(): boolean {
    if (this.stepDistance > 1.5 && !this.isDead) {
      this.stepDistance = 0;
      return true;
    }
    return false;
  }

  update(dt: number) {
    // Position interpolation (lerp toward target)
    const lerpFactor = Math.min(1, dt * 12);
    this.currentPos.lerp(this.targetPos, lerpFactor);
    this.group.position.copy(this.currentPos);

    // Yaw interpolation
    let yawDiff = this.targetYaw - this.currentYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.currentYaw += yawDiff * lerpFactor;
    this.group.rotation.y = this.currentYaw;

    // Hit flash decay
    if (this.hitFlash > 0) {
      this.hitFlash -= dt * 3;
      const bodyMat = this.body.material as THREE.MeshStandardMaterial;
      const flash = Math.max(0, this.hitFlash);
      const teamColor = this.team === 'alpha' ? 0xf97316 : 0x22d3ee;
      bodyMat.color.setRGB(
        (teamColor >> 16 & 0xff) / 255 + flash,
        (teamColor >> 8 & 0xff) / 255,
        (teamColor & 0xff) / 255
      );
    }

    // Spawn protection bubble
    if (this.spawnProtectTimer > 0) {
      this.spawnProtectTimer -= dt;
      this.shieldBubble.visible = true;
      const pulse = 0.15 + Math.sin(Date.now() * 0.01) * 0.05;
      (this.shieldBubble.material as THREE.MeshBasicMaterial).opacity = pulse;
    } else {
      this.shieldBubble.visible = false;
    }

    // Death animation — fall over
    if (this.isDead) {
      this.deathTimer += dt;
      const fallAngle = Math.min(Math.PI / 2, this.deathTimer * 4);
      this.group.rotation.x = fallAngle;
      // Fade out after 3 seconds
      if (this.deathTimer > 3) {
        this.group.visible = false;
      } else {
        this.group.visible = true;
      }
    } else {
      this.deathTimer = 0;
      this.group.rotation.x = 0;
      this.group.visible = !this.isDisconnected;
    }

    // Disconnected — freeze and show label
    if (this.isDisconnected) {
      this.group.visible = true;
      this.disconnectLabel.visible = true;
    }

    // HP bar update
    const hpRatio = Math.max(0, this.hp / 100);
    const hpCanvas = (this.hpBar.material as THREE.SpriteMaterial).map as THREE.CanvasTexture;
    if (hpCanvas && hpCanvas.image) {
      const ctx = (hpCanvas.image as HTMLCanvasElement).getContext('2d')!;
      ctx.clearRect(0, 0, 64, 8);
      ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(0, 0, 64 * hpRatio, 8);
      hpCanvas.needsUpdate = true;
    }
    this.hpBar.visible = !this.isDead && !this.isDisconnected && hpRatio < 1;
    this.hpBarBg.visible = this.hpBar.visible;

    // Name label
    if (this.nameLabel.material as THREE.SpriteMaterial) {
      const mat = this.nameLabel.material as THREE.SpriteMaterial;
      mat.opacity = (this.isDead || this.isDisconnected) ? 0 : 1;
    }
  }

  takeHit() {
    this.hitFlash = 0.3;
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
      if (child instanceof THREE.Sprite) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }

  spawnBloodParticles(position: THREE.Vector3): THREE.Mesh[] {
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xaa0000 })
      );
      p.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3));
      p.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3);
      p.userData.lifetime = 0.5;
      particles.push(p);
    }
    return particles;
  }
}
