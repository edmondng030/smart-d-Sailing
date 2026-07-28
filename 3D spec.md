# Visual Realism and Physical Fidelity Requirements

## 1. Overall Quality Target

Do not create a basic low-poly demo or a scene made mainly from primitive boxes, cylinders and flat planes.

The target is a polished, believable, stylised-realistic 3D sailing experience suitable for a commercial web game.

The scene should feel:

* Physically believable
* Visually detailed
* Naturally illuminated
* Rich in material variation
* Correctly scaled
* Alive with subtle environmental motion
* Optimised for real-time browser rendering

The visual direction is not photorealistic and not storybook-like.

Use a refined stylised-realistic art direction:

* Realistic proportions
* Slightly softened shapes
* Clean silhouettes
* Detailed PBR materials
* Natural colours
* Cinematic lighting
* Subtle surface imperfections
* No exaggerated cartoon deformation
* No flat plastic-looking materials

---

# 2. Coordinate and Scale Standards

Use a consistent real-world scale throughout the project.

## World units

Use:

```ts
1 Three.js unit = 1 metre
```

Suggested boat dimensions:

```ts
boatLength = 4.35;
boatBeam = 1.58;
hullHeight = 1.05;
mastHeightAboveDeck = 3.45;
draftDepth = 0.55;
```

Suggested environmental dimensions:

```ts
smallIslandDiameter = 80;
mediumIslandDiameter = 250;
lighthouseHeight = 18;
treeHeight = 4;
rockSize = 1.5;
oceanVisibleRadius = 2500;
```

Do not scale objects visually without considering their actual dimensions.

All physics values, camera distances, wave heights, character sizes and environmental objects must follow the same metre-based scale.

---

# 3. Boat Modelling Requirements

## 3.1 Do Not Build the Boat as One Primitive

The boat must be constructed as a hierarchy of separate components.

Recommended hierarchy:

```text
BoatRoot
├─ PhysicsHull
├─ VisualHull
│  ├─ OuterHull
│  ├─ InnerHull
│  ├─ Keel
│  ├─ Gunwale
│  ├─ BowStem
│  └─ Stern
├─ Deck
│  ├─ DeckPlanks
│  ├─ Cabin
│  ├─ Hatch
│  └─ StorageBoxes
├─ MastSystem
│  ├─ MainMast
│  ├─ Boom
│  ├─ Sail
│  ├─ Ropes
│  └─ Pulleys
├─ Steering
│  ├─ Rudder
│  └─ Wheel
├─ Accessories
│  ├─ Lanterns
│  ├─ Cleats
│  ├─ Anchor
│  ├─ LifeRing
│  ├─ Barrels
│  └─ Flag
└─ Effects
   ├─ BowSpray
   ├─ SideFoam
   ├─ Wake
   └─ WaterDrips
```

Use a simplified hidden collider for physics.

Do not use the high-detail visual mesh as the collision mesh.

---

## 3.2 Hull Geometry

The hull must have:

* A sharp but slightly softened bow
* Rounded sides
* A visible keel
* Narrower bow and stern
* Wider centre section
* Correct waterline
* Convex exterior shape
* Hollow or visually believable interior
* Separate upper and lower hull surfaces
* Sufficient subdivisions for smooth highlights

Avoid:

* Perfectly symmetrical primitive geometry
* Flat vertical hull walls
* Box-shaped bow
* Completely smooth surfaces without construction detail
* Unrealistically thin wooden surfaces

Build the hull using one of these methods:

1. Custom `BufferGeometry` generated from cross-sections
2. Imported GLTF model created in Blender
3. Lofted geometry generated from multiple elliptical hull profiles

Preferred hull cross-sections:

```ts
const hullStations = [
  { z: -2.15, width: 0.08, height: 0.50 },
  { z: -1.70, width: 0.46, height: 0.78 },
  { z: -0.90, width: 0.73, height: 0.96 },
  { z:  0.00, width: 0.79, height: 1.02 },
  { z:  0.95, width: 0.68, height: 0.92 },
  { z:  1.75, width: 0.40, height: 0.75 },
  { z:  2.20, width: 0.10, height: 0.56 }
];
```

Generate smooth surfaces between these stations.

Add a small amount of asymmetry and handmade imperfection to prevent the model from looking mathematically perfect.

---

## 3.3 Boat Detail Levels

Create three visual LOD levels.

### LOD 0 — Close View

Visible below approximately 30 metres.

Include:

* Individual deck planks
* Rope strands or detailed rope normal maps
* Metal bolts
* Wood seams
* Sail stitching
* Cleats
* Pulleys
* Window frames
* Lantern glass
* Small scratches
* Water stains
* Edge wear

### LOD 1 — Medium View

Visible from approximately 30–100 metres.

Include:

* Simplified deck
* Simplified ropes
* Main accessories
* Reduced geometry
* Baked material details

### LOD 2 — Distant View

Visible beyond approximately 100 metres.

Include:

* Clean silhouette
* Hull
* Mast
* Sail
* Basic colour and shadow
* No tiny accessories

LOD switching must not visibly pop.

Use gradual transition or hysteresis thresholds.

---

# 4. Boat Materials

Use physically based materials.

Prefer:

```ts
THREE.MeshStandardMaterial
```

or:

```ts
THREE.MeshPhysicalMaterial
```

Do not use `MeshBasicMaterial` for normal boat surfaces.

## 4.1 Wood

Wood must not look like a flat brown colour.

Use:

* Base colour map
* Normal map
* Roughness map
* Ambient occlusion map
* Optional height or parallax detail
* Directional grain aligned with each plank
* Slight colour variation between planks
* Darker end grain
* Worn edges
* Salt stains near the waterline

Suggested values:

```ts
roughness = 0.55 to 0.82;
metalness = 0.0;
clearcoat = 0.08 to 0.20;
clearcoatRoughness = 0.35 to 0.60;
```

Wet wood should become:

* Slightly darker
* Slightly more reflective
* Lower in roughness
* More saturated

Do not change the whole boat instantly.

Use a wetness mask based on:

* Height relative to water
* Rain exposure
* Wave spray
* Time since last contact with water

---

## 4.2 Painted Hull

Use multiple material layers:

* Underlying wood
* Primer
* Paint
* Scratches
* Dirt
* Salt residue
* Wetness

The lower hull should show subtle:

* Waterline staining
* Algae tint
* Paint erosion
* Small scratches
* Dirt accumulation

Avoid excessive damage that makes the boat appear abandoned.

---

## 4.3 Metal

Metal parts must use correct metallic response.

Examples:

* Brass
* Iron
* Stainless steel
* Painted steel

Suggested values:

```ts
metalness = 0.75 to 1.0;
roughness = 0.18 to 0.55;
```

Add:

* Edge wear
* Oxidation variation
* Fingerprint-like roughness variation
* Small surface scratches

Do not colour a non-metal material grey and call it metal.

---

## 4.4 Sail Fabric

The sail must not look like a rigid flat triangle.

Use:

* Subdivided cloth mesh
* Slight thickness or double-sided material
* Fabric normal map
* Roughness map
* Stitch lines
* Reinforced corners
* Small colour variation
* Dirt around ropes and edges
* Subtle translucency under strong sunlight

The sail should deform according to wind.

Use a lightweight cloth approximation rather than full expensive cloth simulation.

Calculate sail deformation from:

* Relative wind direction
* Wind strength
* Gust noise
* Sail tension
* Attachment points

The sail must remain fixed at its rope and mast attachment points.

---

## 4.5 Ropes

Ropes should have:

* Visible thickness
* Twisted surface normal
* Correct sag
* Attachment points
* Slight wind movement

Use curves and tubular geometry:

```ts
THREE.CatmullRomCurve3
THREE.TubeGeometry
```

For distant ropes, use textured strips or simplified geometry.

Do not use perfectly straight one-pixel lines for close-up ropes.

---

# 5. Ocean Rendering

Do not create the ocean using only a transparent blue plane.

The ocean must combine:

1. Large geometric wave displacement
2. Medium wave detail
3. Small animated normal-map detail
4. Reflection
5. Refraction colour
6. Fresnel effect
7. Depth-based colour
8. Foam
9. Sun glitter
10. Atmospheric horizon blending

---

## 5.1 Gerstner Wave System

Use multiple directional Gerstner waves for the visible sea surface.

Use at least four wave layers:

```ts
interface GerstnerWave {
  direction: THREE.Vector2;
  steepness: number;
  wavelength: number;
  amplitude: number;
  speed: number;
}
```

Example calm-sea configuration:

```ts
const waves = [
  {
    direction: new THREE.Vector2(1.0, 0.25).normalize(),
    steepness: 0.18,
    wavelength: 18,
    amplitude: 0.34,
    speed: 0.75
  },
  {
    direction: new THREE.Vector2(0.72, 0.68).normalize(),
    steepness: 0.12,
    wavelength: 8,
    amplitude: 0.16,
    speed: 1.05
  },
  {
    direction: new THREE.Vector2(-0.30, 1.0).normalize(),
    steepness: 0.08,
    wavelength: 3.5,
    amplitude: 0.06,
    speed: 1.55
  },
  {
    direction: new THREE.Vector2(0.90, -0.45).normalize(),
    steepness: 0.05,
    wavelength: 1.4,
    amplitude: 0.025,
    speed: 2.10
  }
];
```

Weather must adjust these parameters gradually.

Do not jump immediately between wave presets.

Use smooth interpolation over several seconds.

---

## 5.2 One Shared Wave Function

The visual ocean and boat physics must use the same mathematical wave function.

Create one reusable function:

```ts
function sampleOceanSurface(
  worldX: number,
  worldZ: number,
  time: number
): {
  height: number;
  normal: THREE.Vector3;
  velocity: THREE.Vector3;
}
```

This function must be used by:

* Ocean vertex shader
* Boat buoyancy
* Floating objects
* Foam spawning
* Camera effects
* Particle positioning

Never animate the visual water independently from the physics water.

Otherwise the boat will appear to float above waves or pass through them.

---

## 5.3 Ocean Colour

Calculate sea colour using:

* Water depth
* Viewing angle
* Sky reflection
* Sun direction
* Weather
* Foam
* Underwater absorption

Suggested colour zones:

```ts
deepWaterColour = "#082f4f";
midWaterColour = "#0f6681";
shallowWaterColour = "#3ca6a0";
sunReflectionColour = "#fff2d2";
stormWaterColour = "#20383f";
```

Do not use one uniform blue colour.

Blend between colours based on:

* Distance
* Water depth
* Surface normal
* Light angle
* Weather conditions

---

## 5.4 Reflections

Use environment lighting and sky reflection.

Requirements:

* Sun highlight reflected on the water
* Sky colour reflected at shallow viewing angles
* Darker water when looking downward
* Lighthouse and island reflection only when performance allows
* Lower-resolution reflection on medium and low quality

Do not use a full-resolution planar reflection every frame on mobile devices.

Use quality presets.

---

## 5.5 Foam

Foam should appear at:

* Wave crests
* Boat bow
* Boat sides
* Wake
* Rocks
* Shoreline
* Strong object impacts

Foam must:

* Fade gradually
* Move with the water
* Break into irregular shapes
* Use noise
* Change opacity over lifetime
* Stretch according to water velocity

Avoid perfectly circular particle sprites.

Use:

* Instanced foam cards
* Flipbook textures
* Procedural shader masks
* Decal-like foam patches

---

## 5.6 Boat Wake

Create separate wake systems:

### Bow Wake

* V-shaped
* Strongest at the bow
* Scales with speed
* Wider at high speed

### Side Foam

* Appears along submerged hull edges
* Responds to roll and pitch
* Stronger during large waves

### Rear Wake

* Long trail
* Expands over time
* Gradually loses opacity
* Distorts with waves

Wake intensity should be approximately based on:

```ts
wakeStrength =
  boatSpeed *
  submergedHullRatio *
  waterResistanceMultiplier;
```

Do not show a strong wake while the boat is stationary.

---

# 6. Boat Buoyancy and Movement

Use Rapier for the boat rigid body, but implement custom buoyancy forces.

Do not approximate floating by directly setting the boat Y position every frame.

That will make the boat look weightless.

---

## 6.1 Buoyancy Sample Points

Place multiple buoyancy points under the hull.

Recommended initial setup:

```ts
const buoyancyPoints = [
  new THREE.Vector3(-0.52, -0.28, -1.55),
  new THREE.Vector3( 0.52, -0.28, -1.55),

  new THREE.Vector3(-0.68, -0.42, -0.55),
  new THREE.Vector3( 0.68, -0.42, -0.55),

  new THREE.Vector3(-0.68, -0.42,  0.55),
  new THREE.Vector3( 0.68, -0.42,  0.55),

  new THREE.Vector3(-0.42, -0.30,  1.55),
  new THREE.Vector3( 0.42, -0.30,  1.55)
];
```

At each point:

1. Convert local position to world position
2. Sample ocean height and velocity
3. Calculate submerged depth
4. Apply upward buoyancy force
5. Apply vertical damping
6. Apply lateral hydrodynamic drag
7. Apply force at that world point

Applying force at separate points must create natural:

* Pitch
* Roll
* Heave
* Yaw resistance

---

## 6.2 Buoyancy Force

Use a stable spring-damper approximation:

```ts
const depth = waterHeight - pointWorldY;

if (depth > 0) {
  const upwardForce =
    depth * buoyancyStrength -
    relativeVerticalVelocity * buoyancyDamping;

  applyForceAtPoint(
    new THREE.Vector3(0, Math.max(0, upwardForce), 0),
    pointWorldPosition
  );
}
```

Clamp excessive forces to prevent physics explosions.

Use fixed physics time steps.

Recommended:

```ts
physicsStep = 1 / 60;
maxSubSteps = 4;
```

---

## 6.3 Water Drag

Calculate drag separately along the boat’s local axes.

The hull should:

* Move relatively easily forward
* Resist sideways movement strongly
* Resist vertical movement moderately
* Lose angular velocity gradually

Example concept:

```ts
forwardDrag = 0.8;
sideDrag = 4.5;
verticalDrag = 2.2;
angularDamping = 1.4;
```

Do not use the same drag coefficient in every direction.

A real hull should slide forward more easily than sideways.

---

## 6.4 Wind and Sail Force

Calculate apparent wind:

```ts
apparentWind = worldWindVelocity - boatVelocity;
```

Sail force must depend on:

* Apparent wind speed
* Apparent wind angle
* Sail angle
* Sail area
* Sail efficiency
* Current weather
* Gust noise

Apply sail force near the centre of the sail rather than at the boat centre.

This produces natural leaning and turning torque.

Prevent unstable force spikes by:

* Clamping force
* Smoothing wind velocity
* Limiting gust acceleration
* Using fixed time steps

---

## 6.5 Rudder

Rudder force should depend on water flow.

The rudder should have little effect when the boat is stationary.

Approximate rudder force using:

```ts
rudderForce =
  boatForwardSpeed *
  rudderAngle *
  rudderEfficiency;
```

Apply the force behind the centre of mass.

This generates yaw torque naturally.

---

# 7. Lighting and Rendering

## 7.1 Renderer Configuration

Configure a physically believable rendering pipeline.

Use:

```ts
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

Adjust exposure per weather condition.

Example ranges:

```ts
clearDayExposure = 1.0;
sunsetExposure = 0.85;
overcastExposure = 0.72;
stormExposure = 0.58;
nightExposure = 0.42;
```

Do not compensate for poor lighting by making every material very bright.

---

## 7.2 Environment Lighting

Use an environment map or procedurally generated sky to illuminate materials.

The same sky must influence:

* Scene background
* Water reflections
* Boat reflections
* Metal highlights
* General ambient colour

Generate a prefiltered environment map.

Update it only when necessary.

Do not regenerate a high-resolution environment map every frame.

For day-night transitions:

* Update at controlled intervals
* Interpolate lighting colours continuously
* Refresh the environment map at lower frequency

---

## 7.3 Sunlight

Use one primary directional light as the sun.

Requirements:

* Direction must match the visible sun
* Shadow direction must match the sun
* Water specular highlight must match the sun
* Sky colour must match sun elevation
* Sunset light should become warmer
* Midday shadows should become shorter
* Overcast shadows should become softer

Do not place multiple strong directional lights from unrelated directions.

---

## 7.4 Shadows

Prioritise shadows around:

* Boat deck
* Cabin
* Mast
* Sail
* Ropes
* Dock
* Rocks
* Nearby environment objects

Use tight shadow camera bounds around the player.

Do not render a huge shadow map covering the entire ocean.

Suggested desktop setting:

```ts
shadowMapSize = 2048;
```

Suggested mobile setting:

```ts
shadowMapSize = 1024;
```

Only important nearby objects should cast dynamic shadows.

Distant objects may use:

* Baked shadows
* Ambient occlusion
* Contact shadow approximations
* No shadow

---

## 7.5 Contact and Ambient Occlusion

Use subtle SSAO or GTAO on medium and high settings.

It should enhance:

* Deck plank gaps
* Cabin corners
* Rope attachments
* Hull interior
* Rock intersections
* Object contact with the ground

Do not overuse ambient occlusion.

Black halos around every object are unacceptable.

---

## 7.6 Post-processing

Use post-processing carefully.

Recommended:

* SMAA or FXAA
* Subtle bloom
* Colour grading
* Very light vignette
* Optional depth of field in photo mode
* Optional motion blur only at high quality

Avoid:

* Heavy bloom
* Strong chromatic aberration
* Excessive film grain
* Permanent depth of field during gameplay
* Strong vignette that hides the scene

Bloom should affect only genuinely bright objects:

* Sun
* Lantern flame
* Moon reflection
* Lightning
* Small emissive windows

---

# 8. Sky and Atmosphere

Use a procedural sky or high-quality HDR environment.

The sky must support:

* Sun elevation
* Sun azimuth
* Atmospheric haze
* Horizon brightness
* Cloud coverage
* Weather tint
* Day-night transition
* Moonlight
* Stars

The horizon must blend naturally into ocean fog.

Avoid a visible line where the ocean plane meets the sky.

Use:

* Distance fog
* Atmospheric perspective
* Matching horizon colours
* Large ocean geometry
* Camera-relative ocean positioning

---

# 9. Clouds

Do not use only a flat sky texture.

Use different cloud layers.

### High Clouds

* Thin
* Slow
* Broad coverage
* Minimal shadows

### Medium Clouds

* Visible shape
* Moderate movement
* Weather-dependent density

### Low Storm Clouds

* Darker
* Faster
* Larger
* Stronger directional movement
* Capable of producing local shadow variation

Possible implementations:

* Layered transparent cloud cards
* Instanced cloud meshes
* Volumetric ray-marched clouds on high settings
* Simplified billboard clouds on mobile

Cloud movement must follow wind direction.

---

# 10. Islands and Environmental Objects

## 10.1 Terrain

Islands should not look like circular cones placed on the ocean.

Generate layered terrain:

* Underwater shelf
* Beach
* Soil
* Grass
* Cliff
* Rock formations
* Vegetation zones

Use:

* Height maps
* Noise
* Sculpted meshes
* Vertex colour blending
* Triplanar material blending

Terrain materials should transition naturally.

Examples:

* Wet sand near water
* Dry sand above the tide line
* Grass above beach level
* Exposed rock on steep slopes
* Moss in shaded areas

---

## 10.2 Rocks

Rocks must have:

* Irregular silhouette
* Non-uniform scale
* Surface normal detail
* Roughness variation
* Ground contact
* Moss or wetness variation
* Different sizes

Do not place repeated identical rocks without rotation or scale variation.

Use instancing for repeated rock families.

Create approximately 5–10 base rock meshes and randomise:

* Rotation
* Scale
* Material tint
* Moss amount
* Wetness
* Position

---

## 10.3 Trees and Vegetation

Trees should respond subtly to wind.

Separate:

* Trunk
* Main branches
* Leaf clusters

Use different wind strengths:

```ts
trunkMovement = veryLow;
branchMovement = low;
leafMovement = medium;
```

Vegetation close to the camera should use real geometry.

Distant vegetation may use:

* Low-poly meshes
* Impostors
* Billboards
* Clustered instancing

Avoid making every tree move in exact synchronisation.

Use position-based phase variation.

---

## 10.4 Buildings and Lighthouse

Buildings should have:

* Correct human scale
* Wall thickness
* Window depth
* Roof overhang
* Door frames
* Material separation
* Dirt near the ground
* Weather exposure
* Interior glow at night

Lighthouse requirements:

* Rotating light beam
* Visible glass housing
* Fresnel lens impression
* Emissive lamp
* Volumetric-looking beam
* Distance-based intensity
* Slow mechanical rotation

The lighthouse beam must not illuminate through solid terrain.

---

## 10.5 Floating Objects

Floating barrels, crates and buoys must use the same ocean sampling and buoyancy system as the boat.

Each object should have:

* Multiple or simplified buoyancy points
* Water drag
* Rotational damping
* Wave response
* Collision
* Wetness

Do not animate floating objects with unrelated sine waves.

---

# 11. Environmental Motion

The scene should always contain subtle motion.

Include:

* Sail flutter
* Rope movement
* Flag movement
* Cloud movement
* Water waves
* Foam
* Tree movement
* Seabirds
* Floating particles
* Lantern movement
* Boat accessories reacting to motion

Each system should respond to the same global weather state.

Create one global environment state:

```ts
interface EnvironmentState {
  time: number;
  windDirection: THREE.Vector3;
  windSpeed: number;
  gustStrength: number;
  rainIntensity: number;
  cloudCoverage: number;
  waveIntensity: number;
  fogDensity: number;
  sunElevation: number;
  sunAzimuth: number;
}
```

Do not create unrelated wind values for trees, sails, waves and clouds.

---

# 12. Camera Realism

Use a damped follow camera rather than attaching the camera rigidly to the boat.

Separate:

* Boat movement
* Camera target movement
* Camera position damping
* Camera rotation damping
* Horizon stabilisation

The camera should partially absorb small boat vibrations but retain larger wave motion.

Example behaviour:

```ts
cameraPositionDamping = 4.0;
cameraTargetDamping = 6.0;
horizonStabilisation = 0.70;
```

Add subtle:

* FOV increase at speed
* Camera lag during turning
* Vertical response to large waves
* Wind shake during storms
* Impact shake

Allow users to disable camera shake.

Do not apply constant random camera noise.

---

# 13. Audio Realism

Use layered positional and environmental audio.

Required layers:

* Distant ocean
* Close hull water
* Bow splash
* Wake
* Wind
* Sail cloth
* Rope tension
* Wood creaking
* Seagulls
* Rain
* Thunder
* Lantern or cabin ambience

Audio parameters must react to:

* Boat speed
* Camera position
* Wind speed
* Wave height
* Rain intensity
* Distance from shore
* Time of day

Do not play all audio loops at constant volume.

---

# 14. Weather Integration

Weather must modify the entire world, not only the sky.

Each weather preset must control:

```ts
{
  sky,
  sun,
  exposure,
  fog,
  clouds,
  wind,
  waves,
  rain,
  oceanColour,
  reflectionStrength,
  boatWetness,
  foam,
  audio,
  cameraBehaviour
}
```

Example storm changes:

* Darker sky
* Lower exposure
* Higher wave amplitude
* Shorter wave intervals
* Stronger wind gusts
* Increased foam
* Stronger boat roll and pitch
* Lower visibility
* Wet materials
* Louder hull and wind audio
* Lightning
* Camera shake
* Reduced sail efficiency

Use smooth transitions.

Never switch the complete environment instantly.

---

# 15. Texture Requirements

Use PBR texture sets where suitable.

Each important material should support:

* Base colour
* Normal
* Roughness
* Ambient occlusion
* Metalness where required
* Optional displacement
* Optional opacity
* Optional emissive

Texture recommendations:

### Hero Boat

```text
2048 × 2048 or 4096 × 4096
```

### Nearby Environment

```text
2048 × 2048
```

### Repeated Props

```text
1024 × 1024
```

### Distant Assets

```text
512 × 512
```

Use texture atlases for small props.

Use compressed GPU texture formats where possible.

Correct texture colour spaces:

* Base colour: sRGB
* Emissive: sRGB
* Normal: linear
* Roughness: linear
* Metalness: linear
* AO: linear

---

# 16. Asset Pipeline

For complex hero assets, prefer:

```text
Blender → GLTF/GLB → Three.js
```

Use procedural Three.js geometry mainly for:

* Ocean
* Waves
* Foam
* Simple ropes
* Particle effects
* Distant objects
* Debug geometry
* Prototype assets

Do not force Three.js to procedurally construct every tiny boat component when a detailed GLB model is more appropriate.

GLB export requirements:

* Apply transforms
* Use metre-based scale
* Correct object origins
* Correct normals
* Tangents generated where needed
* Remove unused materials
* Use meaningful object names
* Separate moving parts
* Optimise mesh density
* Compress geometry
* Compress textures
* Preserve material slots

---

# 17. Performance Budget

Target:

```text
Desktop high quality: stable 60 FPS
Tablet: stable 30–60 FPS
Mobile: stable 30 FPS
```

Suggested visible budgets:

### Desktop

```text
Draw calls: below 250
Triangles: below 1.5 million
Shadow-casting lights: 1 main light
Dynamic reflection resolution: 256–512
```

### Mobile

```text
Draw calls: below 120
Triangles: below 400,000
Shadow-casting lights: 1
Dynamic reflection resolution: 128–256
```

Use:

* InstancedMesh
* LOD
* Frustum culling
* Object pooling
* Texture compression
* Geometry compression
* Adaptive pixel ratio
* Reduced particle counts
* Lower shadow resolution
* Lower reflection resolution
* Simplified shaders

---

# 18. Animation Architecture

Do not update high-frequency animation using React state every frame.

Use:

* `useFrame`
* Object refs
* Shader uniforms
* Physics transforms
* Direct mutable vectors
* Interpolated values

React or Zustand state should store:

* Weather preset
* User settings
* Selected boat
* Mission state
* UI state
* Low-frequency gameplay values

Frame-loop data should include:

* Wave animation
* Boat position
* Camera movement
* Sail deformation
* Foam
* Particle movement
* Rope movement

Avoid creating new vectors, arrays or objects inside every frame.

Reuse temporary objects:

```ts
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
```

---

# 19. Required Quality Presets

## Low

* Simplified ocean shader
* Two Gerstner waves
* No SSAO
* Low shadow resolution
* Billboard clouds
* Low particle count
* Simplified reflections

## Medium

* Four Gerstner waves
* Basic environment reflection
* Medium shadows
* Limited foam
* Instanced clouds
* Optional SSAO

## High

* Six Gerstner waves
* Detailed foam
* Higher environment resolution
* Soft shadows
* SSAO
* Better cloud layers
* Detailed wetness

## Ultra

* Maximum wave detail
* Higher reflection quality
* Volumetric clouds where supported
* High shadow resolution
* Detailed post-processing
* Maximum environmental particles

Do not change gameplay physics between graphics presets.

Only visual quality should change.

---

# 20. Mandatory Debug Tools

Create a hidden developer panel.

Allow adjustment of:

* Wave amplitude
* Wave direction
* Wave speed
* Wind speed
* Wind direction
* Buoyancy strength
* Buoyancy damping
* Forward drag
* Side drag
* Boat mass
* Centre of mass
* Sail force
* Rudder efficiency
* Exposure
* Sun elevation
* Shadow bounds
* Fog density
* Foam threshold

Add debug visualisations for:

* Buoyancy points
* Water surface samples
* Centre of mass
* Force vectors
* Wind vector
* Sail force
* Rudder force
* Boat collider
* Ocean normals
* LOD distance
* Shadow camera bounds

The debug panel must be disabled in production builds.

---

# 21. Visual Acceptance Criteria

The result is unacceptable if:

* The boat looks like a collection of basic primitives
* Wood looks like flat brown plastic
* Water is a single transparent blue plane
* Boat motion does not match visible waves
* The sail remains completely rigid
* Wake appears while stationary
* Environmental objects have inconsistent scale
* The horizon has a visible seam
* Shadows point in a direction different from the sun
* Rain does not affect materials
* All trees move identically
* Rocks are repeated without variation
* The camera is rigidly attached to the boat
* Weather changes only replace the sky colour
* High-frequency animation causes React re-rendering
* Mobile performance is ignored

The result is acceptable only when:

* The boat has believable structure and material separation
* Surface details remain visible in close camera views
* The hull naturally pitches and rolls with waves
* Visual waves and buoyancy remain synchronised
* Water shows layered movement and view-dependent reflections
* Foam responds to wave crests and hull movement
* Light, sky, shadows and reflections use the same sun direction
* Weather affects the whole scene
* Nearby objects show detailed geometry
* Distant objects use appropriate LOD
* The scene remains stable and performant

---

# 22. Codex Execution Rules

When implementing this project:

1. Inspect the existing repository before changing code.
2. Preserve working features.
3. Create the scene in independent systems.
4. Do not place all code in `App.tsx`.
5. Build and test after each major system.
6. Resolve all TypeScript errors.
7. Resolve all missing imports.
8. Do not leave placeholder pseudo-code.
9. Do not silently replace complex systems with primitive approximations.
10. Document any performance compromises.
11. Add sensible default parameters.
12. Include a graphics quality selector.
13. Include a developer debug mode.
14. Use reusable materials and geometries.
15. Dispose of unused GPU resources.
16. Test scene resizing.
17. Test low-end graphics mode.
18. Verify visual wave and physics synchronisation.
19. Verify correct texture colour spaces.
20. Verify the project runs using:

```bash
npm install
npm run dev
npm run build
```

---

# 23. Recommended Implementation Order

Implement the systems in this exact order:

## Stage 1

* Renderer
* Camera
* Colour management
* Tone mapping
* Sky
* Sun
* Environment lighting

## Stage 2

* Ocean wave function
* Ocean shader
* Shared ocean sampling function
* Fog and horizon

## Stage 3

* Boat GLB loading
* Materials
* Collider
* Buoyancy points
* Water drag

## Stage 4

* Wind
* Sail force
* Sail deformation
* Rudder
* Camera damping

## Stage 5

* Bow spray
* Side foam
* Wake
* Wetness

## Stage 6

* Islands
* Rocks
* Vegetation
* Buildings
* Lighthouse

## Stage 7

* Weather transitions
* Clouds
* Rain
* Lightning
* Audio

## Stage 8

* LOD
* Instancing
* Quality presets
* Performance profiling
* Mobile optimisation

Do not build all systems at once.

Complete and verify each stage before continuing.
