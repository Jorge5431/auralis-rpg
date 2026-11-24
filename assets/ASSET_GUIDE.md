# Auralis RPG V10 - Asset Guide

## 1. Project purpose

Build a new immersive medieval fantasy RPG on a floating
island, using Three.js, TypeScript, Vite and Rapier.

The previous game implementation must not be used as
the architectural or visual foundation of V10.

Existing authorized assets may be reused.

Target platforms: desktop browsers and Android browsers.

## 2. Asset catalog

Source of truth: assets/ASSET_CATALOG.json

Asset root: public/assets/
Runtime URL: /assets/

Catalog snapshot:

- 694 asset files
- 665.42 MiB of source and optimized resources
- 77 GLB/glTF models
- 358 animation entries
- 60 skin entries
- 80 optimized texture variants
- 45 duplicate content groups
- Zero detected missing glTF dependencies
- Zero detected catalog reading errors

Counts include repeated assets and animation entries.

Never invent asset paths or animation names.
Read the catalog before implementing asset loading.

## 3. Asset locations

### RPG classes

models/characters/quaternius-rpg-classes/glTF/

Available characters:

- Ranger
- Monk
- Warrior
- Cleric
- Rogue
- Wizard

These six characters contain 76 animation entries.

FBX and OBJ weapon sources are also available.
Prefer GLB/glTF for runtime rendering.
Convert weapon sources to GLB when necessary.

### Modular characters

models/characters/quaternius-modular/

Contains complete outfits and modular clothing parts.

Use for villagers, merchants, guards and character
customization.

Do not assume that different skeletons are compatible.
Validate bone names, hierarchy and bind poses before
sharing or retargeting animations.

### Base characters

models/quaternius/

Preserve existing paths until all dependencies have
been reviewed.

### Creatures

models/creatures-complete/beasts/
models/creatures-complete/insectoids/

Includes animated animals, monsters, bosses and
spider egg props.

Use the catalog to discover exact model paths.

Godot .tres files and auxiliary JSON files are
reference data, not native Three.js runtime assets.

Reimplement required creature effects in Three.js.

### Environment models

models/kenney/fantasy-town/
models/kenney/nature/

Use these models as components for detailed medieval
architecture, vegetation and environmental decoration.

Do not limit the island design to the available props.
Create additional procedural geometry where required.

### Materials

textures/polyhaven/
textures/kenney-retro-fantasy/

Use PBR materials for terrain, rocks, wood, leather,
grass, architecture and environmental details.

### Sky environments

hdri/DaySkyHDRI069A_1K/
hdri/NightSkyHDRI003_1K/

Use EXRLoader and PMREMGenerator for environment
lighting where appropriate.

Implement a smooth day/night transition.

## 4. Texture optimization

Variant index:

public/assets/optimized/texture-variants.json

Desktop variants:

public/assets/optimized/desktop/

Mobile variants:

public/assets/optimized/mobile/

40 original textures have optimized alternatives.

Original textures: 357.39 MiB
Desktop variants: 84.43 MiB
Mobile variants: 25.77 MiB

Use optimized textures by default.

Resolve external texture URLs using the variant index.
Preserve original relative paths and URL encoding.

Use LoadingManager.setURLModifier or an equivalent
centralized resource resolver.

Embedded textures require separate optimization or
material replacement. URL redirection alone cannot
replace embedded image data.

Do not preload original high-resolution textures.

Preserve alpha transparency and material properties.

## 5. Color management

Base color and emissive textures use sRGB.

Normal, roughness, metallic, AO, displacement and
packed ORM maps use non-color data.

For standard ORM packing:

- Red: ambient occlusion
- Green: roughness
- Blue: metallic

Verify each source material before applying this rule.

Respect glTF texture orientation and UV transforms.

Do not assign sRGB to normal or roughness maps.

## 6. Animation system

Use THREE.AnimationMixer for animated models.

Use SkeletonUtils.clone for independent instances
of skinned characters.

Implement animation state machines supporting:

- Idle
- Walk
- Run
- Attack
- Hit reaction
- Death
- Class-specific actions
- Interaction
- Roll where available

Map gameplay states to actual animation names
from the catalog.

Never assume that every model contains every action.

Implement crossfades between animation states.

Handle root motion without duplicating movement
from the physics controller.

Test skeleton retargeting before enabling it.

Characters must not remain in T-pose during gameplay.

## 7. Asset manager

Implement a centralized AssetManager responsible for:

- Catalog lookup
- URL resolution
- Quality profiles
- GLB/glTF loading
- Texture loading
- Resource caching
- Loading progress
- Error handling
- Reference counting
- Resource disposal
- Region-based lazy loading

Use SHA-256 duplicate groups as deduplication hints.

Do not share mutable materials or textures when
instances require incompatible rendering settings.

Do not remove duplicate source files automatically.

## 8. Performance

Never download the entire asset library at startup.

Load the player and nearby environment first.

Load distant regions, creatures and equipment
only when needed.

Use:

- InstancedMesh for repeated static objects
- Level of detail for distant geometry
- Frustum culling
- Distance-based visibility
- Texture caching
- Animation update throttling for distant NPCs
- Controlled shadow distances
- Adaptive pixel ratio
- GPU resource disposal

Target 60 FPS on suitable desktop hardware and
30 FPS on suitable mobile hardware.

These are performance targets, not verified results.

Measure actual frame rate, memory and loading times.

## 9. Licenses

Preserve all included license and attribution files.

Consult assets/CREDITS.md and catalog license paths.

Known resource providers include:

- Quaternius
- Kenney
- Poly Haven
- Daniel Gruginski
- ambientCG (HDRI attribution; archive provenance
  should remain documented)

Do not import restricted or unverified resources.

The private medieval texture archive and restricted
fantasy icon sampler are excluded from the repository.

Do not retrieve them from private local backups.

## 10. Validation requirements

Before integrating a model:

- Confirm the catalog path.
- Confirm its dependencies.
- Load and render the model.
- Inspect scale and orientation.
- Verify materials and transparency.
- Test available animations.
- Verify collision geometry.
- Test desktop and mobile texture profiles.
- Check browser console errors.
- Check network requests.

Catalog validation does not replace runtime testing.

## 11. Repository rules

Repository:

https://github.com/Jorge5431/auralis-rpg

Asset library branch:

assets/biblioteca-completa

Keep the main branch unchanged until review.

Create a separate V10 development branch based on
the reviewed asset library.

Preserve source assets and license documentation.

Do not commit private files, credentials, temporary
exports or restricted resources.

Do not use git add . without reviewing changes.

## 12. Art direction

Create an immersive stylized fantasy world, not a
miniature diorama.

The floating island must have organic terrain,
irregular rocky cliffs, mountains, waterfalls,
a central lake, forests, medieval village,
sheep farm and a tower.

Use the original island drawing and authorized
visual references as the primary design guidance.

Detailed geography and art direction will be
defined in PROMPT_MASTER.json.

## 13. Current status

Asset preparation and structural catalog validation
are complete for the current snapshot.

Visual rendering, animation compatibility,
gameplay integration and performance remain
to be tested.

This guide does not authorize rebuilding the game
before the master specification is ready.
