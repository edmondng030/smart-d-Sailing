export const METRES_PER_UNIT = 1;

export const QUALITY_PRESETS = {
  low: { pixelRatio: 1, oceanSegments: 72, waveCount: 2, geometryWaveCount: 3, shadowSize: 1024, foamParticles: 80, cloudCount: 10 },
  medium: { pixelRatio: 1.25, oceanSegments: 128, waveCount: 4, geometryWaveCount: 4, shadowSize: 1024, foamParticles: 150, cloudCount: 18 },
  high: { pixelRatio: 1.6, oceanSegments: 192, waveCount: 6, geometryWaveCount: 5, shadowSize: 2048, foamParticles: 260, cloudCount: 28 },
  ultra: { pixelRatio: 2, oceanSegments: 256, waveCount: 6, geometryWaveCount: 5, shadowSize: 2048, foamParticles: 380, cloudCount: 40 }
};

export const BASE_WAVES = [
  { direction: [1, .18], steepness: .24, wavelength: 18, amplitude: .62, speed: 1.15 },
  { direction: [.45, .89], steepness: .2, wavelength: 8, amplitude: .32, speed: 1.6 },
  { direction: [-.62, .78], steepness: .14, wavelength: 3.5, amplitude: .16, speed: 2.2 },
  { direction: [.92, -.38], steepness: .12, wavelength: 2.2, amplitude: .1, speed: 2.8 },
  { direction: [-.75, -.28], steepness: .08, wavelength: 1.7, amplitude: .055, speed: 3.6 },
  { direction: [.14, -.99], steepness: .04, wavelength: .9, amplitude: .015, speed: 4.5 }
];

export const WEATHER_PRESETS = {
  clear: { sky:'#8fc6df', horizon:'#c9dde0', sun:'#fff0c0', deep:'#082f4f', mid:'#0f6681', shallow:'#3ca6a0', exposure:1, fog:.0007, windSpeed:6, waveIntensity:1, cloudCoverage:.25, rain:0, wetness:.15, foam:.48 },
  cloudy: { sky:'#7f9faa', horizon:'#aebfc1', sun:'#d9ddd5', deep:'#123947', mid:'#376a72', shallow:'#65918c', exposure:.72, fog:.0012, windSpeed:8, waveIntensity:1.18, cloudCoverage:.68, rain:0, wetness:.3, foam:.44 },
  sunset: { sky:'#c87867', horizon:'#e6b18a', sun:'#ffae5d', deep:'#183e56', mid:'#8b5b61', shallow:'#be7769', exposure:.85, fog:.0011, windSpeed:5, waveIntensity:.9, cloudCoverage:.35, rain:0, wetness:.12, foam:.5 },
  fog: { sky:'#aebfc0', horizon:'#c6ceca', sun:'#e4deca', deep:'#315762', mid:'#63858a', shallow:'#8aa5a0', exposure:.72, fog:.0042, windSpeed:3, waveIntensity:.65, cloudCoverage:.82, rain:.06, wetness:.5, foam:.52 },
  night: { sky:'#07162c', horizon:'#19354a', sun:'#c8ddff', deep:'#031b31', mid:'#0d4761', shallow:'#176077', exposure:.42, fog:.0015, windSpeed:7, waveIntensity:1.1, cloudCoverage:.45, rain:0, wetness:.25, foam:.46 }
};

export const BOAT = { length:4.35, beam:1.58, hullHeight:1.05, mastHeightAboveDeck:3.45, draftDepth:.55, mass:260, buoyancyStrength:640, buoyancyDamping:125, forwardDrag:.8, sideDrag:4.5, verticalDrag:2.2, angularDamping:1.4, rightingStrength:760, rollPitchDamping:185, sailForce:1.65, rudderEfficiency:1.25 };

export function chooseInitialQuality() {
  const mobile = matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape)').matches;
  const constrained = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  return mobile || constrained ? 'medium' : 'high';
}
