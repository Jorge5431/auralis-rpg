Creatures - Godot 4.7
====================

Twenty-six rigged and animated creatures as a ready-to-open Godot 4.7 project (GDScript only, the
standard Godot build; no C# needed): grey wolf, warg, zombie wolf, giant rat, cave bear, woolly rhino,
woolly mammoth, red deer stag, golden eagle, dungeon ooze, dragon, hydra, giant bat, giant leech,
giant turtle, goat, sheep, cow, horse, pig, hen, giant hunting spider, spiderling, broodmother,
giant wasp and giant centipede, plus three spider-egg props.

Open it
- Godot 4.7 > Import > pick Creatures_Godot/project.godot > Import & Edit. The first open imports
  every model and texture (a minute or two; the dragon's and hydra's textures are 4096x4096).
- Press F5: the menu opens the demos (beasts, dragons, farm, insectoids, and a lineup of every
  creature). Right-drag orbits, middle-drag pans, the wheel zooms, Esc goes back to the menu. The
  buttons jump the camera, follow one creature, re-roll their looks, show labels, change the time
  scale and play a clip pool on all of them.

What's where
- beasts/<Name>/<Name>.tscn, insectoids/<Name>/<Name>.tscn: one scene per creature (plus OozeSmall,
  OozeGiant, WargRidden, MammothTacked and the SpiderEgg_* props). Instance them in your game.
- beasts/<Name>/<Name>.glb: the model and every clip (an AnimationPlayer inside); the scene only
  references it. M_<Name>_<Skin>.tres: the coats. <Name>_anims.tres: its clip pools.
- addons/beasts: the scripts (runtime/), shaders, the import script, the scene builder and the demos.
  addons/insectoids: the insects' data, setups and effects.

Using a creature
- The root is a Creature node. When it enters the scene it picks a random coat and size (set
  look_seed for a fixed one, call reroll() for another). creature.player is its AnimationPlayer:
  play "Idle", "Walk", "Bite"... (each creature's clip list is in its <name>_clips.json).
- creature_event(creature, event_name) fires as a clip passes one of its events (Bite, Howl, Fire,
  Dead, Spit, Spawn...): hook damage and sound there.
- Root motion: the walking and running clips move a "Motion" bone; the AnimationPlayer's
  root_motion_track is set to it, so read get_root_motion_position() / _rotation() to move the body,
  as CreatureWanderer does.
- CreatureWanderer (add it as a child of a creature) makes it wander round `home` playing random clips
  from its pools: the demos use it, and it is a simple example of driving one.

Effects (built in code, no particle scenes to keep in sync)
- Dragon: fire breath between the Fire clip's events (CreatureBreath on the Mouth bone attachment):
  flame tongues, a hot core, embers, smoke and a flickering light.
- Ooze: the see-through jelly with the remains inside, a slime trail that dries away, drips,
  splashes, the acid glob and its puddle; the giant splits into two oozes (OozeSplit.split_into).
  The jelly's shadow is a dithered shadow-only copy: it looks grainy with Godot's default shadow
  filter ("Soft Low"); set Rendering > Lights and Shadows > Positional/Directional Shadow > Soft Shadow
  Filter Quality to Soft High, or hide the OozeShadow node.
- Spider: the web spit (a glob on a silk thread, at its target or the nearest node in the
  "spider_prey" group) leaves a snare; SpiderWebSnare.is_snared(point) tells whether a point is caught.
- Centipede: holes and flying dirt when it burrows and comes back up (burrowed / emerged signals).
- Broodmother: her Spawn clip lays a SpiderEgg_Single (spawned signal).
- Eagle: blend shapes tidy the folded wing's feathers, driven from the rig.

Rebuilding
Project > Tools > Beasts: Build Creature Scenes remakes every scene and material from the models and
addons/*/data/*.json (the coats, sizes and clip pools). Change a JSON, run it, done.

Things to know
- Made to be seen from a top-down game camera; up close they are game-resolution models.
- Godot's GPU particles don't collide with level geometry: the ooze's drops stop at a floor height.
- Same creatures as the Unity package and the FBX zip; the source (Blender Python) is public:
  https://github.com/danielgruginski/Beasts and https://github.com/danielgruginski/Insectoids

How it was made: AI-generated. An AI coding assistant (Claude, via Claude Code) wrote the Blender
Python scripts that build, paint, rig and animate every creature, and the Godot scripts and shaders,
directed and reviewed by a person. No image model was used (the fire textures are procedural too).

Licence: CC0 1.0 (see LICENSE.txt).
