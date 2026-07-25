# Game Design Document — Level Design Specification

## Battlefield Map System: Dynamic Biomes

**Version:** 1.0  
**Role:** Lead Level Designer  
**Engine:** Three.js (WebGL) custom engine  

---

## Overview

This document specifies three distinct battlefields for a competitive wave-based shooter. Each battlefield features unique layout archetypes, biome aesthetics, tactical cover density, and engine performance budgets. Maps are designed for solo and co-op play with AI enemy waves.

---

## 1. Urban Desert

### 1.1 Map Layout & Sightlines

| Property | Specification |
|---|---|
| **Layout Archetype** | Tactical 3-Lane with Central Choke |
| **Map Size** | 55 × 55 units |
| **Long Sightlines** | North-South market square (30+ units), watchtower overlooks |
| **Choke Points** | Collapsed building corridors (3-4 unit gaps), tent clusters |
| **Verticality** | 2 watchtowers (8-unit height), catwalks, multi-story ruins |

**Lane Structure:**
- **West Lane:** Narrow corridor between collapsed buildings — SMG/Shotgun territory
- **Central Lane:** Open market square with sand dune cover — Rifle mid-range
- **East Lane:** Tent cluster with flanking routes — CQC ambush

**Sightline Analysis:**
- Watchtower platforms provide 8-unit elevation with 360° overlook — sniper nest but exposed
- Central square offers 30+ unit sightlines but sand dunes break LOS every 8-10 units
- Building interiors create tight 3-4 unit engagement distances

### 1.2 Biome Aesthetics & Asset List

| Category | Details |
|---|---|
| **Primary Lighting** | Harsh midday desert sun — warm directional light (0xfff0cc), intensity 4.0 |
| **Ambient** | Warm sand tone (0xddbb88), intensity 0.6 |
| **Sky** | Sandy yellow gradient (0xddb877) with 90% opacity sky dome |
| **Weather** | Sandstorm — 600 particles, horizontal drift, 0.016 fog density |

**Core Modular Assets:**
- Sandstone perimeter walls (4-unit height, sand-colored)
- Collapsed concrete building fragments (modular wall sections)
- Military camo tents (cone geometry, 2.5-unit height)
- Watchtower structures (4 legs + platform + roof, 8-unit height)
- Sandbag barricades (stacked box geometry, 3 rows)
- Shipping containers (6 × 2.5 × 2.5 units)
- Explosive barrels (cylindrical, red marking)
- Sand dune mounds (flattened spheres, subtle elevation)

**Environmental Audio/Weather:**
- Sandstorm particle system reduces visibility to ~40 units
- Wind ambient sound (low-frequency rumble)
- Sand impact particles on player movement

### 1.3 Tactical Design & Cover Density

| Cover Type | Placement |
|---|---|
| **Hard Cover** | Sandstone walls, building fragments, watchtower legs, containers |
| **Soft Cover** | Sandbag barricades (destructible), tents (penetrable), barrels (explosive) |
| **Hard Cover Count** | ~18 pieces |
| **Soft Cover Count** | ~8 pieces |

**Objective Zones:**
- **Zone A (Defend):** Central market square (0, 0) — open with dune cover
- **Zone B (Extract):** North watchtower (-22, -22) — elevated extraction point

**Flank Routes:**
- East tent cluster provides covered flank from south to north
- West corridor allows rapid push but limited cover
- Catwalks enable overhead flanking above central square

**Height Advantages:**
- Watchtower platforms: 8-unit elevation, 360° view, exposed to sniper fire
- Catwalks: 5-unit elevation, building-to-building traversal
- Sand dunes: 1-2 unit elevation, minimal but breaks LOS

### 1.4 Engine & Performance Budget

| Category | Strategy |
|---|---|
| **Occlusion Culling** | Building fragments act as occluders — frustum culling handles rest. No custom occlusion portals needed at this map size. |
| **Collision Meshes** | Box colliders for walls/buildings/containers. Cylinder colliders for tent bases. Sphere colliders for dunes (scaled). All colliders set to `visible = false`. |
| **Particle Budget** | 600 sandstorm particles, 1 Points system, updated per-frame with position array |
| **Light Budget** | 1 directional + 1 ambient + 1 fill + 1 rim + 2 point lights (atmospheric) = 5 lights total |
| **Draw Calls** | ~40-50 meshes, ~5 lights, 1 particle system, 1 sky dome |
| **Fog** | FogExp2 with 0.016 density, sand color — limits render distance naturally |

---

## 2. Terrestrial Jungle

### 2.1 Map Layout & Sightlines

| Property | Specification |
|---|---|
| **Layout Archetype** | Asymmetrical Sandbox with Central River |
| **Map Size** | 45 × 45 units |
| **Long Sightlines** | None — maximum effective sightline ~15 units due to fog and foliage |
| **Choke Points** | River crossings (2-unit bridges), hut doorways, tree gaps |
| **Verticality** | Tree canopies (8-10 unit height), elevated hut platforms, no rooftops |

**Lane Structure:**
- **West Bank:** Dense tree cover with huts — ambush territory
- **Central River:** 8-unit wide water feature dividing map — crossing chokepoint
- **East Bank:** More open with bushes and scattered cover

**Sightline Analysis:**
- Heavy fog (0.035 density) limits visibility to ~15-20 units
- Tree canopies block overhead sightlines from elevated positions
- River crossing creates natural funnel — defenders have advantage
- No long sightlines — designed for close-quarters combat

### 2.2 Biome Aesthetics & Asset List

| Category | Details |
|---|---|
| **Primary Lighting** | Filtered jungle canopy — green directional light (0x88aa66), intensity 2.5 |
| **Ambient** | Deep green (0x4a6a3a), intensity 0.5 |
| **Sky** | Dark green canopy (0x1a2a1a) with 85% opacity sky dome |
| **Weather** | Fog — 800 particles, 0.035 density, 0.15 opacity, green tint |

**Core Modular Assets:**
- Dense vegetation perimeter walls (6-unit height, dark green)
- Tree trunks with canopy (cylinder + sphere, 8-unit height)
- Wooden huts with thatched roofs (box + cone, 3-unit height)
- Bush clusters (low spheres, 0.8-unit radius, soft cover)
- River water plane (8 × 70 units, semi-transparent dark water)
- Explosive barrels (scattered near huts)

**Environmental Audio/Weather:**
- Fog particle system limits visibility to ~15-20 units
- Jungle ambient sounds (insects, birds, water flow)
- Rain-like fog particles drift slowly downward
- Footstep audio muffled by soft ground

### 2.3 Tactical Design & Cover Density

| Cover Type | Placement |
|---|---|
| **Hard Cover** | Tree trunks, hut walls, vegetation perimeter |
| **Soft Cover** | Bushes (low, crouch-level), hut roofs (penetrable) |
| **Hard Cover Count** | ~25 trees + 4 huts + 4 perimeter walls = ~33 pieces |
| **Soft Cover Count** | ~20 bushes |

**Objective Zones:**
- **Zone A (Defend):** West hut cluster (-12, -8) — dense cover, ambush-friendly
- **Zone B (Extract):** East bank clearing (12, 12) — more exposed, requires crossing

**Flank Routes:**
- River crossing at north and south ends — high risk, high reward
- Tree-to-tree movement provides concealment but not hard cover
- Bush clusters allow crouched flanking along edges

**Height Advantages:**
- Tree canopies: 8-10 unit height — blocks overhead sightlines but not playable
- Hut roofs: 3-unit height — accessible via jumping, limited positioning
- No significant vertical gameplay — ground-level combat focus

### 2.4 Engine & Performance Budget

| Category | Strategy |
|---|---|
| **Occlusion Culling** | Tree canopies and fog naturally limit render distance. FogExp2 at 0.035 density provides built-in distance culling. Frustum culling handles off-screen geometry. |
| **Collision Meshes** | Cylinder colliders for tree trunks. Box colliders for huts (with rotation). Box colliders for perimeter walls. Sphere colliders for bushes (player can push through partially). |
| **Particle Budget** | 800 fog particles, 1 Points system, slow downward drift |
| **Light Budget** | 1 directional + 1 ambient + 1 fill + 1 rim = 4 lights total (no point lights) |
| **Draw Calls** | ~55-65 meshes (high tree count), ~4 lights, 1 particle system, 1 sky dome, 1 water plane |
| **Fog** | FogExp2 with 0.035 density — strongest fog in game, limits render distance significantly |
| **Optimization Note** | Tree canopies use low-poly spheres (6 × 5 segments) to keep vertex count low. Bushes use 6 × 5 segment spheres. |

---

## 3. Sci-Fi/Cyberpunk City (Neon City)

### 3.1 Map Layout & Sightlines

| Property | Specification |
|---|---|
| **Layout Archetype** | Vertical Arena CQC with Elevated Catwalks |
| **Map Size** | 50 × 50 units |
| **Long Sightlines** | Central plaza (20+ units), building-top sightlines |
| **Choke Points** | Catwalk stairwells, building alleyways, neon-lit corridors |
| **Verticality** | Elevated catwalks (5-unit height), multi-story buildings (10-16 unit height), neon light poles |

**Lane Structure:**
- **Ground Level:** 3-lane layout with buildings as dividers — CQC with energy weapons
- **Catwalk Level:** Cross-shaped elevated platforms at 5-unit height — vertical flanking
- **Building Tops:** Not directly accessible but provide cover and block sightlines

**Sightline Analysis:**
- Central plaza offers 20+ unit sightlines but catwalks break LOS at 5-unit height
- Building alleys create 3-4 unit chokepoints
- Catwalks provide elevated sightlines over ground cover
- Neon fog (0.025 density) creates medium visibility — ~25-30 units

### 3.2 Biome Aesthetics & Asset List

| Category | Details |
|---|---|
| **Primary Lighting** | Neon night — purple directional light (0xaa66ff), intensity 2.0 |
| **Ambient** | Deep purple (0x4a2a6a), intensity 0.5 |
| **Sky** | Near-black with neon tint (0x0a0a1a) with 95% opacity sky dome |
| **Weather** | Neon haze — 500 particles, slow lateral drift, 0.025 fog density, magenta color |

**Core Modular Assets:**
- Dark concrete perimeter walls with neon strip trim (8-unit height)
- Tall buildings with neon window strips (10-16 unit height, modular box)
- Elevated metal catwalks with neon rails (5-unit height, cross-shaped)
- Neon light poles with point lights (4 colors: magenta, cyan, blue, pink)
- Holographic billboard planes (double-sided, semi-transparent, glowing)
- Shipping containers (dark metal)
- Explosive barrels (scattered in alleys)
- Neon grid floor overlay (GridHelper, 0.3 opacity)

**Environmental Audio/Weather:**
- Neon haze particles drift slowly in all directions — holographic atmosphere
- Cyberpunk ambient sounds (synth hum, distant traffic, electronic distortion)
- Neon point lights create dynamic colored shadows on surfaces
- Rain-like particle effect with magenta/cyan tint

### 3.3 Tactical Design & Cover Density

| Cover Type | Placement |
|---|---|
| **Hard Cover** | Buildings, perimeter walls, catwalk support pillars, containers |
| **Soft Cover** | Catwalk railings (low), holographic billboards (visual only, no collision) |
| **Hard Cover Count** | 5 buildings + 4 perimeter walls + 8 catwalk pillars + containers = ~20 pieces |
| **Soft Cover Count** | 4 catwalk railings (visual cover only) |

**Objective Zones:**
- **Zone A (Defend):** Central plaza (0, 0) — open area with catwalk overwatch
- **Zone B (Extract):** South building alley (0, -18) — narrow extraction with building cover

**Flank Routes:**
- Catwalk network provides 4 directional elevated flanks at 5-unit height
- Building alleys offer ground-level flanking between structures
- Neon light poles provide visual waypoints for navigation
- Perimeter wall neon strips help orientation in low-visibility conditions

**Height Advantages:**
- Catwalks: 5-unit elevation — overwatch on ground-level enemies, exposed to building-top fire
- Light poles: 8-unit height — not playable but provide lighting reference
- Buildings: 10-16 unit height — block sightlines, define map verticality
- No accessible rooftops — verticality limited to catwalk level

### 3.4 Engine & Performance Budget

| Category | Strategy |
|---|---|
| **Occlusion Culling** | Tall buildings (10-16 units) act as major occluders. FogExp2 at 0.025 density provides medium-distance culling. Catwalks at 5-unit height create vertical occlusion planes. |
| **Collision Meshes** | Box colliders for buildings, walls, catwalks, pillars. Cylinder colliders for light poles. All colliders invisible. Catwalk colliders include floor + pillars for proper player collision. |
| **Particle Budget** | 500 neon haze particles, 1 Points system, slow multi-axis drift (no falling) |
| **Light Budget** | 1 directional + 1 ambient + 1 fill + 1 rim + 4 colored point lights = 8 lights total (highest of all maps) |
| **Draw Calls** | ~45-55 meshes + neon strips + holographic planes, ~8 lights, 1 particle system, 1 grid helper, 1 sky dome |
| **Fog** | FogExp2 with 0.025 density, dark purple (0x1a0a2a) — medium visibility |
| **Optimization Note** | 4 point lights are the most expensive element. Limit to 18-unit range to reduce fragment shader cost. Neon window strips use emissive materials (no extra lights). Holographic billboards use MeshBasicMaterial (unlit, cheap). GridHelper is a single draw call. |

---

## Cross-Map Comparison Summary

| Feature | Urban Desert | Terrestrial Jungle | Neon City |
|---|---|---|---|
| **Archetype** | Tactical 3-Lane | Asymmetrical Sandbox | Vertical Arena CQC |
| **Map Size** | 55 × 55 | 45 × 45 | 50 × 50 |
| **Max Sightline** | 30+ units | 15-20 units | 20+ units |
| **Verticality** | Watchtowers (8u) | Tree canopies (10u, non-playable) | Catwalks (5u) |
| **Weather** | Sandstorm (600 particles) | Fog (800 particles) | Neon haze (500 particles) |
| **Fog Density** | 0.016 | 0.035 | 0.025 |
| **Light Count** | 5 | 4 | 8 |
| **Hard Cover** | ~18 | ~33 | ~20 |
| **Soft Cover** | ~8 | ~20 | ~4 |
| **Recommended Weapons** | SMG, Shotgun, Rifle | Shotgun, SMG, Pistol | Plasma, SMG, Rifle |
| **Enemy Bias** | Rifleman, Shotgunner, Sniper | Charger, Bomber, Shotgunner | Sniper, Charger, Rifleman |
| **Draw Calls (est.)** | 40-50 | 55-65 | 45-55 |
| **Performance Tier** | Medium | Low (fog culling) | High (point lights) |

---

## Pickup Placement Strategy

All maps share the following pickup spawn pattern:

| Pickup Type | Count | Effect | Visual |
|---|---|---|---|
| **Health** | 3 | +50 HP | White box, green emissive |
| **Ammo** | 3 | Full ammo refill (all weapon types) | Dark box, orange emissive |
| **Armor** | 2 | Upgrades to Medium/Heavy vest | Blue-emissive metal box |
| **Weapon** | 3 | Swaps to picked weapon with full mag | Magenta-emissive weapon shape |

**Pickup Positions (all maps):**
- Health: (-16, -16), (16, 16), (0, -14)
- Ammo: (16, -16), (-16, 16), (0, 14)
- Armor: (-10, 10) = Medium, (10, -10) = Heavy
- Weapons: (-20, 0), (20, 0), (0, 20) — cycles through rifle, sniper, shotgun, LMG, DMR, plasma

---

## Safe Zone Protocol

All maps implement a 10-second safe zone at round start:
- Player is invulnerable to damage
- Enemies are passive (hold position, do not fire)
- Player can change loadout via overlay UI
- Safe zone timer displayed in HUD
- On expiry: combat engaged notification, enemies activate, pointer lock re-engaged

---

*End of Document*
