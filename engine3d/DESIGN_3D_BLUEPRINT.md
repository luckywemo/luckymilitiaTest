# LUCKY MILITIA 3D — COMPLETE GAME DESIGN BLUEPRINT

> Based on the existing 2D Phaser tactical shooter. This document specifies the full 3D redesign.

---

## 1. OVERALL 3D GAME VISION

**Visual Style:** Semi-realistic military tactical FPS with stylized proportions. Think *Insurgency: Sandstorm* meets *Valorant* — grounded weapon feel, readable silhouettes, but not photorealistic. PBR materials (metal, concrete, tactical gear) with slight stylization in character proportions (larger heads/visors for readability at distance).

**Atmosphere:** Tense, kinetic, squad-based. Dark industrial environments punctuated by team-colored lighting (orange Alpha, cyan Bravo). Fog and volumetric lighting create uncertainty.

**Tone:** Gritty but arcade-fast. Matches are short (3-7 min). Death is quick, respawns rapid. The blockchain/wallet layer adds meta-progression — "operating" in a persistent mercenary ecosystem.

**Perspective:** First-person FPS. Camera at 1.7m eye height with weapon viewmodel. Third-person spectate on death.

**How 3D improves on 2D:**
- **Verticality:** Rooftops, catwalks, underground tunnels, elevated firing positions
- **Spatial awareness:** True depth perception for cover and distances
- **Immersion:** Weapon viewmodel, muzzle flash lighting, 3D tracers, destruction
- **Tactical depth:** Lean around corners, peek over cover, suppress through fog
- **Spectacle:** 3D explosions, grenade arcs, collapsing structures

**Core loop:** DEPLOY → ENGAGE → ELIMINATE → COLLECT → EXTRACT → UPGRADE → REDEPLOY

---

## 2. PLAYER CHARACTER

### Visual Design

| Class | Body | Height | Armor | Color | Features |
|-------|------|--------|-------|-------|----------|
| **STRIKER** | Athletic, balanced | 1.8m | Medium vest, knee/elbow pads | Orange (#f97316) on charcoal | Medium helmet, visor up |
| **GHOST** | Lean, wiry | 1.75m | Light recon gear | Cyan (#22d3ee) on navy | Hood+helmet, glowing cyan visor strip |
| **TITAN** | Heavy, broad | 1.9m | Full EOD armor, pauldrons | Stone gray (#78716c) + team overlay | Massive shoulders, reinforced helmet |

**Face:** Not visible — all classes wear full-face tactical helmets with glowing visor strips (team-colored). Avoids uncanny valley, maintains operator identity.

**Weapons (viewmodel):** Detailed FPS weapon models with animated gloved hands, weapon sway/bob/recoil, reload animations, muzzle flash, brass ejection.

### Animation Set

| Animation | Description |
|-----------|-------------|
| **Idle** | Breathing motion, weapon at low-ready, weight shift |
| **Walking** | Tactical walk, weapon up, slight bob, 8-directional blend |
| **Sprinting** | Weapon to hip, lean forward, FOV widen 85° |
| **Crouch** | Quick drop, weapon stabilized, reduced bob |
| **Sliding** | Sprint-to-slide, camera lowers, dust particles |
| **Leaning L/R** | Upper body tilt 30° for peeking corners |
| **Jumping** | Quick hop, knee tuck, minimal air control |
| **Landing** | Camera dip, dust kick, stagger from height |
| **Reloading** | Mag out/in, charge handle — class-specific timing |
| **Firing** | Recoil kick, muzzle flash, weapon climb |
| **ADS** | Weapon to eye, FOV 45°, scope/dot replaces crosshair |
| **Taking Damage** | Camera flinch, red vignette, stagger back |
| **Death** | Ragdoll, weapon drops, camera falls, fade to respawn |
| **Revive** | Camera rises, weapon raises, invuln glow |
| **Victory** | Weapon raised overhead, team-colored flare |

**Transitions:** Blended state machine, 2D blend space (speed × direction). Combat states overlay on locomotion. 100-200ms transition speed.

---

## 3. PLAYER MOVEMENT

| Action | Speed | Notes |
|--------|-------|-------|
| Walk | 4 m/s | Default, weapon ready |
| Sprint | 7 m/s | Weapon lowered, FOV widens, 3s stamina |
| Crouch Walk | 2 m/s | Silent, smaller hitbox |
| Slide | 10 m/s → decel | From sprint, 1.5s |
| Jump | 2.2m | Tactical hop |
| Lean | Static | Q/E, 30° upper body tilt |

**Feel:** Fast and responsive, arcade-tactical. Instant input, 50ms ramp. Slide is satisfying. Sprint has camera shake.

**Camera Response:** Walking bob ±0.015m, sprint stronger bob + FOV pulse, slide camera to 1.2m, damage 0.3s directional flinch, nearby explosion 0.5s shake.

**Terrain:** Flat = full speed, stairs auto-step 0.3m, slopes <30° at 80% speed, obstacles <0.5m auto-step, >0.5m must jump.

---

## 4. CAMERA SYSTEM

**Primary: First-Person FPS**
- Eye height: 1.7m (1.55 crouch, 1.2 slide)
- FOV: 75° default, 85° sprint, 45° ADS
- Near-clip: 0.01m
- Weapon viewmodel on separate camera layer (50° FOV)

**Combat:** Slight zoom toward aim when firing. Recoil kicks camera up + random horizontal. Damage = 0.2s directional flinch.

**Spectate (death):** Third-person orbit, 3m distance, 1.5m height, smooth 2-frame lag, free mouse orbit.

**Kill Cam:** 2s replay from killer's perspective → spectate.

**Intro:** Camera flies through map showing key positions → drops to FPS at spawn.

---

## 5. CHARACTERS AND NPCS

### Player Classes (recap)

| Class | HP | Speed | Armor | Tech | Role |
|-------|----|-------|-------|------|------|
| STRIKER | 120 | 100% | Medium | Low | Frontline assault |
| GHOST | 80 | 150% | Light | High | Flanking, recon |
| TITAN | 200 | 50% | Heavy | Low | Point hold, tanking |

### Enemy Types

| Type | Silhouette | HP | Behavior | Visual |
|------|-----------|-----|----------|-------|
| **GRUNT** | Standard humanoid | 100 | Charges, basic rifle | Red armor, no visor glow |
| **RIFLEMAN** | Taller, visible rifle | 150 | Maintains distance, cover | Dark red, rifle strap |
| **SHOTGUNNER** | Stocky, bulky | 120 | Rushes to close range | Orange-red, shotgun |
| **HEAVY** | Very large, broad | 300 | Slow advance, suppressive | Dark + red plates, LMG |
| **SNIPER** | Lean, elevated | 80 | Static, long-range, laser | Dark cloak, laser line |
| **ELITE** | Glowing red visor + cape | 250 | Coordinates, flanks | Crimson, particle trail |
| **BREACHER (mini-boss)** | 2x size, shield | 800 | Slow advance, frontal immune | Towering, riot shield |
| **WARLORD (boss)** | 2.5x, ornate | 2000 | Multi-phase | Golden-red, energy aura |

### Allies (PvE)
- **Squad AI:** 2-3 friendly bots, take orders (hold, push, flank)
- **Extraction Pilot:** NPC at extraction zone with helicopter

---

## 6. CHARACTER AI

### State Machine

```
IDLE → PATROL → SUSPICIOUS → ALERTED → CHASING → ATTACKING → TAKING_DAMAGE → SEARCHING → RETREATING → REGROUPING → DEAD
```

| State | Behavior |
|-------|----------|
| **Idle** | Stand at post, look around, weapon lowered |
| **Patrol** | Walk route, pause at waypoints, scan |
| **Suspicious** | Investigate noise/movement, weapon raised |
| **Alerted** | Confirmed sight — radio call, alert nearby within 15m |
| **Chasing** | Move to last known position, sprint if LOS broken |
| **Attacking** | Stop at optimal range, fire with difficulty-based accuracy, strafe, cover |
| **Taking Damage** | Flinch, flash, knockback, HP <35% → seek cover |
| **Searching** | Lost sight → last known pos, look around, 10s timeout → patrol |
| **Retreating** | HP <20% → move away, find cover, may heal |
| **Regrouping** | Multiple retreat to same cover, push together |
| **Dead** | Ragdoll, weapon drop, loot, fade 10s |

### Type-Specific AI

| Type | AI Modification |
|------|----------------|
| GRUNT | Basic charge and fire, no cover |
| RIFLEMAN | 15-25m range, uses cover, strafes |
| SHOTGUNNER | Sprint to <5m, burst fire, close strafe |
| HEAVY | Slow walk, suppressive fire, no cover, bullet resist |
| SNIPER | Elevated, static, laser sight reveals position, high dmg |
| ELITE | Flanks while others engage, calls reinforcements, grenades |
| BREACHER | Shield up, frontal immune, must flank; lowers shield to fire |
| WARLORD | Phase 1: LMG suppress. Phase 2 (50%): Charge + slam shockwave. Phase 3 (25%): Aura dmg, enrage, calls adds. |

### Difficulty Scaling

| Difficulty | HP | Accuracy | Reaction | Abilities |
|------------|----|---------|----------|-----------|
| Recruit | 0.7× | 40% | 800ms | No cover |
| Standard | 1.0× | 65% | 500ms | Basic cover |
| Veteran | 1.3× | 80% | 300ms | Advanced cover, flanking |
| Elite | 1.5× | 90% | 200ms | Coordinated tactics, grenades |

---

## 7. BATTLEFIELD DESIGN

### Terrain & Ground
- **Base:** Concrete with cracks, oil stains, tactical grid overlay (orange lines)
- **Variations:** Gravel (footstep change), metal grating (visible drop), wet surfaces (reflections), sand

### Elevation & Verticality
- **Ground level:** Main combat arena
- **Upper catwalks:** 3-4m elevated metal walkways with railings
- **Rooftops:** 6-8m, accessible via ladders, open sightlines but exposed
- **Underground tunnels:** -3m, narrow corridors, flanking routes, dark (flashlight needed)
- **Ramps:** 10-15° inclines connecting zones

### Structures
- **Buildings:** Partially destroyed concrete with rooms, doorways, windows
- **Ruins:** Collapsed walls at various heights providing cover
- **Containers:** Stacked shipping containers creating corridors + elevated positions
- **Bridges:** Connecting elevated positions, destructible railings
- **Tunnels:** Underground passages with support pillars (cover)
- **Caves:** Natural rock formations in outskirts

### Water
- Shallow pools (0.2m) — splash effects, no gameplay impact
- Drainage channels — visual atmosphere

### Background Scenery
- Distant ruined city skyline (skybox)
- Smoke columns on horizon
- Distant helicopter patrols (animated skybox)
- Stars/moon for night maps

---

## 8. BATTLEFIELD LAYOUT

### Zone 1: Deploy Zone (Player Start)
- Clean platform with team-colored light strips, ammo crate, health station
- Spawn beacons (team-colored), supply crates, briefing hologram
- Control hints fade in, HUD activates
- 3-second spawn invulnerability, glowing team dome

### Zone 2: Exploration Corridor
- Two routes: left (covered, longer) and right (open, faster)
- Hidden room behind destructible wall → weapon box
- Data drive on desk in side room (intel objective)
- Abandoned command post with maps, radio static, scattered gear

### Zone 3: First Contact Area
- 2-3 grunts patrolling, 1 rifleman on catwalk
- Cover: stacked crates, low walls, vehicle husks
- Slight depression creating natural trench
- Flanking route through tunnel, elevated catwalk position

### Zone 4: Main Battlefield
- Central open area with scattered cover
- Enemy waves from 3 directions (N, E, S) in groups of 3-5
- Hazards: explosive barrels (red, glowing), electrical panels
- Destructible walls create new pathways, mounted turret (usable)
- Two catwalks overhead, rooftop access via stairs

### Zone 5: Objective Area
- **Hardpoint:** Central capture zone, team-colored ring, control terminal
- **Extraction:** Landing pad with helicopter (animated rotors), hold 30s
- **Survival:** Arena shrinks via fog wall, visible boundary
- Enemies converge on objective, increased spawn rate

### Zone 6: Boss Arena (PvE Final)
- Circular room, 30m diameter, pillars for cover
- Floor vents emitting fire (telegraphed by glow), collapsing sections
- Phase changes alter arena: Phase 2 — pillars destroyed. Phase 3 — floor collapses revealing lava glow
- Victory: boss HP → 0, extraction chopper arrives

---

## 9. BATTLEFIELD ACTIVITIES

| Activity | How It Works |
|----------|-------------|
| **Exploration** | Free movement, discover hidden rooms, find intel |
| **Combat** | FPS shooting with all weapons, grenades, melee |
| **Collecting** | Walk over items auto-pickup, or press E for crates |
| **Searching containers** | Press E near crates/lockers — opens lid, reveals contents |
| **Weapon crates** | Floating, pulsing — press E, random weapon drop |
| **Squad orders** | Press E near ally — order wheel (hold, push, flank, regroup) |
| **Quests** | Mission objectives tracked in HUD |
| **Capturing** | Stand in zone 5s, progress ring fills, team-colored when captured |
| **Defending** | Hold position, enemies converge, defense timer in HUD |
| **Escorting** | Protect extraction pilot moving to pad |
| **Destroying** | Explosive weapons damage walls, cracks → collapse |
| **Switches** | Press E at terminals — opens doors, activates turrets, disables hazards |
| **Puzzles** | Find keycard → unlock door; shoot coupling → disable electric |
| **Climbing** | Ladders (W to climb), mantle obstacles below chest height |
| **Secrets** | Hidden rooms, easter eggs, bonus loot |

---

## 10. BATTLEFIELD ITEMS

### Weapons (3D Viewmodels)

| Weapon | Appearance | Size | Materials | Animation |
|--------|-----------|------|-----------|-----------|
| **M9 Sidearm** | Compact pistol | 0.18m | Black polymer, steel slide | 12-round mag, slide lock reload |
| **MP5 Tactical** | SMG, folding stock | 0.35m | Black polymer, matte metal | 30-round mag, bolt charge, 10 rds/sec |
| **870 Breacher** | Pump shotgun | 0.75m | Dark steel, wood furniture | Pump action, 4 shells individual load |
| **M32 GL** | Revolving grenade launcher | 0.6m | Olive drab metal | Cylinder rotation, 6 grenades, arc |
| **XM-25 Rail** | Bullpup energy, glowing rails | 0.7m | White polymer, cyan cells | Charge-up, beam, 3 cells |
| **X-ION Repeater** | Plasma rifle, translucent chamber | 0.5m | Dark metal, magenta glow | 20-round cell, visible plasma bolts |

### Consumables

| Item | Appearance | Effect | Location |
|------|-----------|--------|----------|
| **Med Kit** | White box, red cross | +50 HP, 2s use | Luck boxes, med stations |
| **Shield Cell** | Blue glowing disc | +50 shield, 1s | Luck boxes, spawn |
| **Ammo Bag** | Green canvas pouch | Refill ammo | Weapon boxes, spawn |
| **Adrenaline** | Orange auto-injector | 5s speed + reduced dmg | Rare elite drop |

### Collectibles

| Item | Appearance | Value | Location |
|------|-----------|-------|----------|
| **Data Drive** | Glowing purple USB | 500 pts, objective | Side rooms, desks |
| **CELO Token** | Golden coin, Celo logo | On-chain currency | Hidden areas, boss drops |
| **Intel Docs** | Folder, red stamp | 100 pts, lore | Command posts |
| **Dog Tags** | Metal chain+tags | 50 pts, from kills | Enemy corpses |

### Interactive Objects

| Object | Interaction | Result |
|--------|-------------|--------|
| **Door** | Press E | Opens/closes, blocks sightlines |
| **Weapon Crate** | Press E, 1s | Random weapon drop |
| **Lever** | Press E | Hidden passage or machinery |
| **Explosive Barrel** | Shoot/explosive | 5m blast, chain reaction |
| **Ammo Crate** | Walk near | Refill ammo |
| **Mounted Turret** | Press E to mount | Fixed LMG, high fire rate |
| **Radio** | Press E | Call extraction, trigger objective |

---

## 11. ENVIRONMENTAL INTERACTION

| Element | Visual | Gameplay Effect |
|---------|--------|----------------|
| **Destructible walls** | Crack network → rubble | New pathways, removes cover |
| **Explosive barrels** | Red, hazard symbol | 5m blast, chain reactions |
| **Breakable windows** | Glass shards | Reveals interior, bullets pass |
| **Physics crates** | Wooden/metal | Pushable, stackable, dynamic cover |
| **Climbable ladders** | Metal rungs | Vertical traversal, vulnerable |
| **Interactive machinery** | Control panels, generators | Activate/deactivate hazards |
| **Traps** | Pressure plates, tripwires | Damage or alert enemies |
| **Environmental switches** | Wall panels, keycard readers | Progress locked doors |

---

## 12. ENVIRONMENTAL HAZARDS

| Hazard | Visual | Audio | Effect | Avoidance |
|--------|--------|-------|--------|-----------|
| **Fire** | Orange flames, shimmer | Crackling | 10 dmg/s | Walk around |
| **Lava glow** | Red-orange floor cracks | Rumble | Instant death | Don't step on glow |
| **Toxic gas** | Green cloud | Hissing | 5 dmg/s, blur | Avoid area |
| **Electricity** | Blue arcs from panels | Buzzing | 20 dmg, stun 0.5s | Shoot coupling |
| **Explosions** | Flash, shockwave, debris | Boom | 30-50 dmg in radius | Distance, cover |
| **Falling debris** | Dust, chunks falling | Rumble | 15 dmg, stagger | Watch ceiling |
| **Collapsing structures** | Cracks, groaning metal | Groan | Platform impassable | Move before collapse |

---

## 13. COMBAT SYSTEM

### Weapons & Firing

| Weapon | Type | Fire Mode | Damage | Fire Rate | Range | Special |
|--------|------|-----------|--------|-----------|-------|---------|
| M9 Sidearm | Kinetic | Semi | 15 | 350ms | 30m | Infinite ammo |
| MP5 Tactical | Kinetic | Auto | 10 | 100ms | 25m | 45-round mag |
| 870 Breacher | Kinetic | Pump | 20×8 | 900ms | 10m | Spread, close-range |
| M32 GL | Explosive | Semi | 80 | 1500ms | 40m | Arc, 3m splash |
| XM-25 Rail | Energy | Charged | 100 | 2000ms | 60m | Pierces walls, 3 shots |
| X-ION Repeater | Energy | Auto | 30 | 200ms | 35m | Plasma bolts, 20-round cell |

### Combat Mechanics

- **Fire:** Left click
- **ADS:** Right click — reduced spread, FOV 45°
- **Reload:** R — weapon-specific animation, cannot fire during
- **Weapon Switch:** 1-6 or scroll — 0.3s swap animation
- **Melee:** V — knife slash, 25 dmg, 0.5s cooldown
- **Grenade:** G — arc throw, 3s fuse, 4m radius, 50 dmg
- **Ability:** Shift — class-specific:
  - **STRIKER — Rally:** 3s fire rate boost, team glow aura
  - **GHOST — Cloak:** 4s invisibility, shimmer when moving
  - **TITAN — Bulwark:** 5s damage reduction, frontal shield, cannot move

### 3D Positioning

- **Cover:** C near low cover — hunker, reduced hitbox, Q/E to lean
- **High ground:** +20% damage bonus, sightline advantage
- **Flanking:** Horizontal and vertical flanking in 3D
- **Suppression:** Sustained fire near enemies reduces their accuracy
- **Line of sight:** Raycast-based, walls block, windows allow bullets

---

## 14. VISUAL EFFECTS

| Effect | Description |
|--------|-------------|
| **Muzzle flash** | Additive sprite at barrel, point light 45ms, random rotation |
| **Bullet tracers** | Glowing cylinder barrel→impact, 60ms fade, additive |
| **Impact sparks** | 8-12 particles, additive, gravity, 300ms |
| **Blood hit** | Red particle burst, directional spray by impact angle |
| **Death** | Red burst + ragdoll, weapon physics drop |
| **Explosion** | Shockwave ring (1m→5m), fireball, 15 debris, screen shake 10m |
| **Grenade arc** | Visible model, smoke trail, surface bounce |
| **Rail beam** | Cyan beam muzzle→target, 200ms, wall pierce with exit spark |
| **Plasma bolt** | Magenta glowing sphere, particle trail, 0.5m light |
| **Ability activation** | Class-colored particle burst, screen-edge glow |
| **Damage vignette** | Red edge overlay, scales with damage, 1s fade |
| **Hit marker** | White X on hit, red X on kill, 200ms |
| **Kill feed** | Top-right: "[Player] ☠ [Enemy] [Weapon]" |
| **Weather** | Rain (particles + reflections), fog density per map |
| **Ambient** | Dust motes in light beams, steam from pipes, flickering lights |

---

## 15. AUDIO DESIGN

| Category | Description |
|----------|-------------|
| **Menu music** | Dark ambient drone, military snare rolls |
| **Combat music** | Electronic + orchestral, 140 BPM, builds with kill streak |
| **Exploration music** | Minimal ambient pads, distant gunfire |
| **Boss music** | Heavy orchestral + synth, 3 phases add layers |
| **Victory** | Brass fanfare, 5s |
| **Defeat** | Descending tone + static, 3s |

### Sound Effects

| Sound | Description |
|-------|-------------|
| **Footsteps** | Surface-dependent (concrete, metal, gravel, water), speed cadence |
| **Weapon fire** | Unique per weapon — pistol crack, SMG burp, shotgun boom, rail hum, plasma zap |
| **Reload** | Mag out click, mag in clack, charge handle |
| **Bullet impact** | Surface-dependent — concrete ping, metal spark, flesh thud, glass shatter |
| **Explosion** | Boom + debris + ear ringing if close |
| **Enemy alerts** | Radio chatter (garbled), alert horn, footstep detection |
| **Ability** | Class-specific whoosh/hum |
| **HUD** | UI clicks, notification chimes, objective updates |
| **Ambient** | Wind, distant gunfire, metal creaking, water drip, radio static |
| **Death** | Heartbeat slow + fade |
| **Respawn** | Electronic boot-up, weapon charge |

### Dynamic Audio
- Combat music layers add as kills increase
- Audio muffles when HP < 30% (low-pass filter)
- Spatial 3D audio for enemy footsteps and gunfire
- Suppression: nearby bullets cause ear ringing

---

## 16. LIGHTING

### Lighting Setup

| Light Type | Purpose | Specs |
|-----------|---------|-------|
| **Hemisphere ambient** | Base fill | Sky 0x223344, ground 0x111111, 0.3 intensity |
| **Directional (sun/moon)** | Primary shadows | Warm 0xffaa55, 2.0 intensity, 4096 shadow map, 60m range |
| **Point lights** | Atmosphere | Flickering ceiling lights, fire glow, screens |
| **Spot lights** | Tactical | Player flashlight (F toggle), mounted searchlights |
| **Team accents** | Navigation | Orange/cyan strips on walls, spawn zones |
| **Muzzle flash** | Dynamic | Point light at barrel, 45ms, 8m, warm orange |
| **Explosion** | Dynamic | Point light, 500ms, 15m, orange-red |

### Day/Night
- Maps default to **dusk/night** for tactical atmosphere
- Night: flashlight essential, visors glow, muzzle flashes reveal positions
- Dusk: long shadows, warm directional, dramatic silhouettes

### Shadow Quality
- PCFSoftShadowMap, 2048-4096 resolution
- Shadow bias to prevent acne
- Dynamic objects cast + receive
- Static geometry baked (future)

### Lighting as Gameplay
- **Danger:** Red lights = enemy zones, green = safe/objective
- **Guidance:** Team-colored floor strips toward objectives
- **Tactical:** Shoot out lights for darkness (future)
- **Boss arena:** Phase 1 normal → Phase 2 red emergency → Phase 3 darkness + boss aura

---

## 17. GAMEPLAY LOOP

```
DEPLOY (spawn, select loadout)
    ↓
MOVE THROUGH ZONES (explore, find items, discover enemies)
    ↓
ENGAGE COMBAT (cover, abilities, weapons, positioning)
    ↓
ELIMINATE ENEMIES (kills, headshots, multi-kills)
    ↓
COLLECT REWARDS (loot, data drives, CELO tokens, dog tags)
    ↓
CAPTURE OBJECTIVE (hardpoint, extraction, survival timer)
    ↓
EXTRACT / ROUND END (helicopter or timer)
    ↓
POST-MATCH (stats screen, on-chain sync, leaderboard)
    ↓
UPGRADE (arsenal, class, unlock weapons)
    ↓
REDEPLOY (next match, improved loadout)
```

---

## 18. LEVEL PROGRESSION

| Stage | Maps | Enemies | Difficulty | New Mechanics | Equipment |
|-------|------|---------|-----------|---------------|-----------|
| **Early (1-3)** | Urban Ruins, The Pit | Grunts, Riflemen | Recruit-Standard | Basic movement, shooting, cover | M9, MP5 |
| **Mid (4-7)** | Outpost X, **Cargo Dock** | + Shotgunners, Heavies | Standard-Veteran | Grenades, abilities, destructible walls | + 870, M32 GL |
| **Late (8-12)** | **Blacksite**, **Reactor** | + Snipers, Elites | Veteran-Elite | Verticality, traps, hazards | + XM-25, X-ION |
| **Endgame (13+)** | **Warlord's Fortress** | Breacher, Warlord boss | Elite | Boss phases, arena hazards, extraction | All + Adrenaline |

### Environment Complexity
- Early: Flat, simple cover, 2 routes
- Mid: Multi-level, destructible, 3+ routes
- Late: Full verticality, hazards, machinery, secrets
- Endgame: Boss arena with phase-changing geometry

---

## 19. UI AND HUD

### In-Game HUD (React/Tailwind overlay)

| Element | Position | Style |
|---------|----------|-------|
| **Crosshair** | Center | Dynamic spread (expands moving/firing), white, hit marker overlay |
| **Health bar** | Bottom-left | Red/green + shield overlay (blue), numeric |
| **Ammo counter** | Bottom-right | "30 / 45" + weapon name, reload prompt |
| **Weapon icon** | Bottom-right | Current weapon icon + name |
| **Ability cooldown** | Bottom-center | Circular indicator, class-colored |
| **Kill feed** | Top-right | "[You] ☠ [Grunt] [MP5]" scrolling |
| **Score/Timer** | Top-center | "ALPHA 12 — 8 BRAVO" + match timer |
| **Objective marker** | Top-center below score | "CAPTURE HARDPOINT" + progress bar |
| **Minimap** | Top-left | Top-down radar, 30m radius, enemy dots (red), allies (team), objectives (yellow) |
| **Compass** | Top-center thin strip | N/S/E/W + objective directions |
| **Damage indicator** | Screen edge | Red directional arc from damage source |
| **Hit marker** | Center crosshair | White X on hit, red X on kill |
| **Interaction prompt** | Center-bottom | "[E] Open Weapon Crate" when near |
| **Boss health** | Bottom-center (boss only) | Wide bar with phase indicators |
| **Notifications** | Top-center | "INTEL SECURED +500", fade 2s |

### Design Principles
- Semi-transparent dark backgrounds, team-colored accents
- Monospace font (military aesthetic)
- <15% screen coverage
- Critical info always visible; contextual info appears when relevant

---

## 20. FULL GAMEPLAY SCENARIO

### Mission: "Operation Lucky Strike" — PvE Extraction on Cargo Dock

1. **Deploy:** Player selects STRIKER with MP5 Tactical. Camera flies through Cargo Dock — shipping containers, crane silhouettes, dusk sky, distant ship hull. Drops to FPS at spawn. HUD activates: HP 120, ammo 45/45, objective "SECURE 3 DATA DRIVES."

2. **Explore:** Player moves through container corridor. Footsteps echo on metal grating. Flashlight illuminates dark corners. Radio static from nearby office.

3. **Discover:** Side room with weapon crate. Press E — metallic clang, reveals 870 Breacher. Weapon swap animation. HUD: "870 BREACHER EQUIPPED."

4. **First Contact:** Two GRUNTS patrolling near crane. One stops, looks around — alert icon appears. Player ducks behind container.

5. **Combat:** Player leans right (Q), fires shotgun — GRUNT goes down with blood spray and ragdoll. Second GRUNT alerts, fires wildly. Player slides to new cover, switches to MP5, bursts him down. Kill feed: "[You] ☠ [Grunt] [870]" and "[You] ☠ [Grunt] [MP5]."

6. **Vertical Tactics:** RIFLEMAN on catwalk fires down. Player can't hit from here. Sprints through tunnel, comes up stairs behind catwalk, flanks RIFLEMAN. Melee knife finish.

7. **Collect:** Data drive #1 on catwalk control panel — glowing purple USB. Auto-collected. "INTEL 1/3 SECURED +500." Dog tags from each body.

8. **New Objective:** HUD: "DATA DRIVE 2/3 — Underground Office." Minimap marker appears. Player descends into tunnels. Dark — flashlight on. Water drips. Eerie.

9. **Ambush:** SHOTGUNNER rushes from side passage. Close-quarters firefight — player wins but takes 30 damage. Health flashes. Adrenaline spike.

10. **Data Drive 2:** Underground office desk. "INTEL 2/3 SECURED." Weapon box here — opens to M32 Grenade Launcher.

11. **Final Drive:** Marker on main dock. Player emerges. ELITE with glowing red visor guards area, flanked by two GRUNTS. ELITE strafing, coordinating.

12. **Grenade Play:** Player lobs M32 grenade at group. Explosion — shockwave ring, fireball, debris. One GRUNT down, others scattered.

13. **Elite Fight:** ELITE flanks left while GRUNT suppresses. Player uses STRIKER ability "Rally" — fire rate boost, orange aura. Burns down GRUNT, then duels ELITE. ELITE takes 3 MP5 mags, strafing and firing. Player hits last shot — ELITE ragdolls with red particle burst.

14. **Data Drive 3:** On a crate near dock edge. "INTEL 3/3 SECURED. EXTRACTION AVAILABLE." HUD updates: "REACH EXTRACTION POINT."

15. **Extraction:** Player sprints to landing pad. Press E on radio — "EXTRACTION CALLED." 30s timer. Helicopter approaches from distance, rotors spinning. Enemies spawn and converge — player holds position, picking them off. Timer ticks down. 10s... 5s... helicopter lands.

16. **Victory:** Player runs to helicopter. Camera transitions to third-person — character boards chopper. It lifts off. Stats screen: kills 8, headshots 2, accuracy 64%, data drives 3, time 4:32. On-chain sync: "STATS RECORDED ON CELO." Leaderboard updates. CELO token reward.

17. **Upgrade:** Arsenal screen — new weapon unlocked (XM-25 Rail). Player equips it for next mission. REDEPLOY.

---

## 21. 3D ASSET REQUIREMENTS

### Characters

| Asset | Type | Notes |
|-------|------|-------|
| STRIKER model | Full body + viewmodel arms | Medium armor, orange accents |
| GHOST model | Full body + viewmodel arms | Light armor, cyan visor |
| TITAN model | Full body + viewmodel arms | Heavy armor, broad silhouette |
| GRUNT model | Full body | Red armor, standard |
| RIFLEMAN model | Full body | Dark red, rifle strap |
| SHOTGUNNER model | Full body | Stocky, shotgun |
| HEAVY model | Full body | Large, LMG, shoulder plates |
| SNIPER model | Full body | Lean, cloak, laser |
| ELITE model | Full body | Crimson, cape, particle trail |
| BREACHER model | Full body + shield | 2x size, riot shield |
| WARLORD model | Full body | 2.5x, ornate, aura |
| Squad AI models | Full body | Team-colored allies |
| Extraction Pilot | Full body | Helicopter NPC |

### Environment

| Asset | Notes |
|-------|-------|
| Floor tiles | Concrete, metal grating, gravel, wet |
| Wall sections | Concrete, brick, metal panel, destructible |
| Shipping containers | Various colors, stackable |
| Buildings | Ruined concrete structures |
| Catwalks | Metal grating, railings |
| Stairs/ramps | Metal, concrete |
| Ladders | Wall-mounted |
| Cranes | Background scenery, animated |
| Helicopter | Extraction vehicle, animated rotors |
| Skybox | Dusk/night ruined city |
| Vegetation | Dead grass, weeds, sparse |

### Props

| Asset | Notes |
|-------|-------|
| Explosive barrels | Red, hazard symbol |
| Crates | Wooden, metal, physics-enabled |
| Weapon crates | Military green, glowing seams |
| Data drives | Glowing purple USB |
| Med kits | White box, red cross |
| Shield cells | Blue glowing disc |
| Ammo bags | Green canvas pouch |
| Doors | Sliding metal, control panel |
| Control panels | Wall-mounted terminals |
| Mounted turret | Tripod LMG |
| Radio | Field radio |
| Light fixtures | Ceiling, wall, flickering |
| Debris | Concrete chunks, metal scrap |

### Effects

| Asset | Notes |
|-------|-------|
| Muzzle flash sprite | Additive, animated |
| Tracer material | Glowing cylinder |
| Impact spark particles | 8-12 per hit |
| Blood particles | Red spray |
| Explosion sprite + particles | Shockwave, fireball, debris |
| Grenade model | With smoke trail |
| Rail beam material | Cyan additive |
| Plasma bolt model | Magenta glowing sphere |
| Ability aura | Class-colored particles |
| Damage vignette | Red edge overlay (HUD) |
| Dust motes | Ambient particles |
| Fog | Exponential density |
| Rain particles | Weather effect |

### Animation Sets

| Set | Animations |
|-----|-----------|
| Player locomotion | Idle, walk, sprint, crouch, slide, jump, land, lean L/R, ladder climb |
| Player combat | Fire, ADS, reload (per weapon), melee, grenade throw, ability activate |
| Player reactions | Take damage, stagger, death, revive, victory |
| Enemy shared | Idle, walk, run, death, hit reaction |
| Enemy combat | Fire, reload, take cover, throw grenade |
| BREACHER | Shield raise, shield lower, charge, slam |
| WARLORD | Phase 1 LMG, phase 2 charge/slam, phase 3 aura/enrage, phase transition |
| Helicopter | Approach, land, hover, depart |

---

## 22. DEVELOPMENT PRIORITY

### Phase 1: Core Movement & Camera ✅ (Mostly Complete)
- FPS camera with pointer lock
- WASD movement, sprint, crouch, jump
- Mouse look with sensitivity
- Camera bob, weapon bob
- **Test:** Smooth movement, no clipping, responsive controls
- **Result:** Player can move and look around 3D environment

### Phase 2: Basic Battlefield ✅ (Partially Complete)
- Floor plane with texture
- Boundary walls
- Static cover objects (crates, walls)
- Basic lighting (ambient + directional)
- Fog
- **Test:** Player can navigate, walls block movement
- **Result:** Playable arena space

### Phase 3: Character Models & Animations
- Replace box enemies with proper character models
- Player viewmodel arms + weapon
- Idle, walk, run, death animations
- Hit reactions, ragdoll
- **Test:** Characters look right, animations blend smoothly
- **Result:** Recognizable characters on battlefield

### Phase 4: Combat System ✅ (Partially Complete)
- Raycasting shooting (done)
- All 6 weapons with unique stats
- Reload mechanic + ammo
- ADS (aim down sights)
- Melee, grenades
- Hit markers, damage numbers
- **Test:** Each weapon feels distinct, hit detection accurate
- **Result:** Full combat sandbox

### Phase 5: Enemy AI ✅ (Partially Complete)
- State machine (idle, patrol, chase, attack, search, retreat)
- LOS checking, cover finding
- Per-type behavior parameters
- Difficulty scaling
- Alert system (call for help)
- **Test:** Enemies behave intelligently, use cover, flank
- **Result:** Challenging AI opponents

### Phase 6: Items & Interaction
- Weapon crates (press E)
- Med kits, shield cells, ammo bags
- Data drives, collectibles
- Explosive barrels
- Destructible walls
- Doors, switches, levers
- **Test:** All items work, interactions responsive
- **Result:** Rich interactive environment

### Phase 7: Objectives & Quests
- Hardpoint capture zones
- Extraction mechanic with helicopter
- Survival mode with shrinking zone
- Mission objectives (collect, destroy, escort)
- HUD objective tracking
- **Test:** Objectives complete correctly, HUD updates
- **Result:** Full game modes

### Phase 8: Advanced Environments
- Multi-level geometry (catwalks, tunnels, rooftops)
- Multiple map layouts (Urban Ruins, The Pit, Outpost X, Cargo Dock)
- Environmental hazards (fire, electricity, gas)
- Environmental storytelling props
- **Test:** Verticality works, maps feel distinct
- **Result:** Varied, replayable battlefields

### Phase 9: Visual Effects & Lighting ✅ (Partially Complete)
- Muzzle flash + light (done)
- Tracers (done)
- Impact sparks (done)
- Explosions with shockwave
- Particle systems for blood, debris, dust
- Dynamic flashlight (done)
- Team-colored accent lighting
- Boss arena phase lighting
- **Test:** Effects enhance gameplay clarity, lighting guides player
- **Result:** Cinematic visual quality

### Phase 10: Audio & Polish
- Weapon sound effects (per weapon)
- Footstep sounds (per surface)
- Ambient environment audio
- Combat music with dynamic layers
- Boss music with phase transitions
- Spatial 3D audio
- UI sounds
- **Test:** Audio enhances immersion, directional cues work
- **Result:** Full audio experience

### Phase 11: Optimization
- Frustum culling
- LOD (level of detail) for distant objects
- Instanced rendering for repeated geometry
- Texture atlas for environment
- Shadow map optimization
- Particle system pooling
- **Test:** 60 FPS on mid-range hardware, no stuttering
- **Result:** Smooth performance

### Phase 12: Final Testing
- All weapon balance passes
- AI difficulty tuning
- Map flow testing
- Multiplayer integration (PeerJS → 3D)
- Blockchain stats sync verification
- Edge case handling (disconnect, respawn, extraction)
- **Test:** Full playthrough without crashes, balanced gameplay
- **Result:** Shippable 3D game
