/**
 * onyx3d — the home hero as a real WebGL scene.
 *
 * The ONYX word is four letters of genuine extruded geometry (the Uncial
 * Antiqua outlines, src/data/onyx-glyphs.ts), lit like dark onyx stone:
 * a deep-purple body, off-white key, crimson rim. One coherent light source
 * carries the render: the key spotlight casts real shadows, throws a visible
 * volumetric beam with dust caught inside it, and the letters mirror in a
 * polished coal floor. The camera tracks across the word on scroll, dollying
 * into each letter while its content is born from the frame; between them it
 * glides like one continuous take.
 *
 * Because the letters are geometry, they are crisp at every distance and
 * carry real depth and specular character — no upscaled-texture blur.
 *
 * Falls back to a static, readable stacked page when WebGL is unavailable
 * or the visitor prefers reduced motion (adds html.no3d; never adds
 * html.onyx-live, which is what switches the canvas on).
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Text as TroikaText } from 'troika-three-text';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GLYPHS } from '../data/onyx-glyphs';
// Self-hosted TTFs, bundled to same-origin hashed URLs by Vite (no CDN).
import uncialUrl from '../fonts/UncialAntiqua-Regular.ttf?url';
import cardoUrl from '../fonts/Cardo-Regular.ttf?url';
import greyUrl from '../fonts/GreyQo-Regular.ttf?url';

gsap.registerPlugin(ScrollTrigger);

const CHARS = ['O', 'N', 'Y', 'X'] as const;
const GLYPH_SCALE = 0.01; // glyph em units -> world units
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
// Touch / low-power devices: drop shadows, bloom, DPR and particle count.
const LOWPERF = matchMedia('(pointer: coarse)').matches;

function webglOK(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fallback() {
  document.documentElement.classList.add('no3d');
  // Reveal the content that the 3D path would have animated.
  document.querySelectorAll<HTMLElement>('.flow, .flow-line').forEach((el) => {
    el.style.opacity = '1';
    el.style.clipPath = 'none';
    el.style.visibility = 'visible';
  });
}

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('[data-onyx-canvas]');

if (!canvas || REDUCED || !webglOK()) {
  fallback();
} else {
  try {
    boot(canvas);
  } catch (err) {
    fallback();
  }
}

function boot(canvas: HTMLCanvasElement) {
  const section = document.querySelector<HTMLElement>('[data-onyx3d]')!;
  const stage = section.querySelector<HTMLElement>('.onyx3d-stage')!;
  const groupsEl = gsap.utils.toArray<HTMLElement>('[data-flow]');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOWPERF ? 1 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8; // a touch brighter overall, letters read easier
  renderer.shadowMap.enabled = !LOWPERF;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Purple depth-haze so distant geometry and the empty transit beats recede
  // into onyx-violet; the crepuscular light shafts (below) carry the atmosphere.
  scene.fog = new THREE.FogExp2(0x0f0814, 0.012);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);

  // Custom onyx environment: a dark room lit only by palette-colored panels,
  // so the polished clearcoat reflects crimson / purple / off-white glints,
  // not the neutral studio gray of RoomEnvironment (which reads as chrome).
  const envScene = new THREE.Scene();
  const panel = (color: number, intensity: number, x: number, y: number, z: number, w: number, h: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    (mesh.material as THREE.MeshBasicMaterial).color.multiplyScalar(intensity);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  };
  // Palette only: purple + crimson dominate the reflections so the metal reads
  // as violet onyx; off-white is a COMPACT specular key (a glint), never a wash.
  panel(0xe8e2dc, 3.2, -8, 9, 8, 8, 8); // compact off-white specular key
  panel(0x6e0d25, 2.6, 12, 1, 5, 15, 16); // crimson, right — deep wine, kept below the hot-pink blowout
  panel(0x2b1b2f, 3.6, -6, -4, -9, 16, 16); // purple fill, lower-back
  panel(0x1a0f20, 2.8, 0, 0, 12, 26, 26); // deep-purple front fill (purple, not white — keeps faces violet)
  panel(0x6e0d25, 1.8, 9, 2, -11, 18, 18); // crimson back-fill so orbits read wine, never gray
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.05).texture;

  // Real polished onyx: a dark violet metal body with a clearcoat lacquer. The
  // metal reflection stays dark (onyx), the clearcoat adds the white/silver
  // sheen on top — a metallic body with white/silver, done for real.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x2b1b2f, // palette panel purple — the lit onyx body reads violet, not gray
    metalness: 0.5, // lower: violet diffuse reads instead of a gray mirror
    roughness: 0.36, // softens the specular so highlights read as sheen, not chrome
    envMapIntensity: 1.45, // more reflection presence -> reads as real polished stone
    clearcoat: 0.7, // off-white clearcoat glint on top
    clearcoatRoughness: 0.2,
    emissive: 0x160a18, // faint purple floor so faces never fall to gray/black
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide, // never cull a face to reveal the hollow interior
  });

  // One shadow-casting key (warm), a purple back-rim, a crimson rim, a
  // hemisphere fill, a violet front-fill, and a low ambient so faces never fall
  // to pure black when the camera swings behind a letter.
  scene.add(new THREE.AmbientLight(0x2a2036, 0.6));
  const key = new THREE.SpotLight(0xf3e4cc, 430, 60, Math.PI / 5.4, 0.6, 2); // warm key, stronger + softer falloff -> realistic modelling
  key.position.set(-7, 13, 10);
  key.castShadow = !LOWPERF;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 46;
  scene.add(key);
  const backRim = new THREE.DirectionalLight(0x5a2440, 1.9); backRim.position.set(6, 4, -8); scene.add(backRim); // purple-crimson (no blue fringe)
  const crimsonRim = new THREE.DirectionalLight(0x6e0d25, 1.8); crimsonRim.position.set(-4, -2, -6); scene.add(crimsonRim);
  const hemi = new THREE.HemisphereLight(0x3a2440, 0x0a0908, 0.95); scene.add(hemi); // purple sky, coal ground
  const fill = new THREE.DirectionalLight(0x4a2c50, 1.05); fill.position.set(0, 2, 16); scene.add(fill); // violet front-fill so faces read cleanly

  // Shadow catcher: a plane below the letters so the cast shadow reads over
  // coal without an off-brand bright floor.
  const FLOOR_Y = -4.0;
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(90, 44), new THREE.ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = FLOOR_Y;
  catcher.receiveShadow = true;
  scene.add(catcher);

  // Polished-floor reflection: each letter is mirrored across the floor line
  // with real geometry (synced to the source every frame), its alpha fading
  // with depth below the floor — the coal slab reads as wet-polished onyx,
  // and the reflection obeys the same lights, env and fog as the letters.
  const mirrorMat = material.clone();
  mirrorMat.transparent = true;
  mirrorMat.opacity = 0.3;
  mirrorMat.roughness = 0.55; // floor scatter softens the reflected image
  mirrorMat.clearcoat = 0.25;
  mirrorMat.envMapIntensity = 0.7;
  mirrorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFloorY = { value: FLOOR_Y };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWorldY = (modelMatrix * vec4( transformed, 1.0 )).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;\nuniform float uFloorY;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n\tgl_FragColor.a *= clamp( 1.0 - ( uFloorY - vWorldY ) / 6.0, 0.0, 1.0 );',
      );
  };

  // ---- Dust motes: additive points drifting up through the scene ----------
  function emberTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  const EMBERS = LOWPERF ? 260 : 520;
  const emberData: { sx: number; sy: number; sz: number; sway: number; swayR: number; phase: number }[] = [];
  const emberPos = new Float32Array(EMBERS * 3);
  const emberCol = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) {
    emberPos[i * 3] = (Math.random() - 0.5) * 42;
    emberPos[i * 3 + 1] = (Math.random() - 0.5) * 32;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 26 - 4;
    // Mostly off-white dust motes with a crimson minority — atmosphere, not noise.
    if (Math.random() < 0.28) { emberCol[i * 3] = 0.55; emberCol[i * 3 + 1] = 0.05; emberCol[i * 3 + 2] = 0.12; }
    else { emberCol[i * 3] = 0.91; emberCol[i * 3 + 1] = 0.886; emberCol[i * 3 + 2] = 0.86; }
    emberData.push({ sx: (Math.random() - 0.5) * 0.4, sy: 0.12 + Math.random() * 0.4, sz: (Math.random() - 0.5) * 0.35, sway: 0.4 + Math.random() * 1.2, swayR: 0.06 + Math.random() * 0.16, phase: Math.random() * Math.PI * 2 });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, map: emberTexture(),
  }));
  scene.add(embers);

  // ---- Build the letters from the Uncial outlines --------------------
  function buildGeometry(d: string) {
    const parsed = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
    const shapes: THREE.Shape[] = [];
    for (const p of parsed.paths) shapes.push(...SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 150, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelOffset: 0, bevelSegments: 2, curveSegments: 14,
    });
    geo.scale(GLYPH_SCALE, -GLYPH_SCALE, GLYPH_SCALE); // flip y (glyph is y-down) -> upright
    geo.center();
    // Crisp, hard-edged shading: keep the geometry non-indexed and compute FLAT
    // per-face normals, so the front, sides and bevel read as distinct planes.
    const g = geo.toNonIndexed();
    g.computeVertexNormals();
    return g;
  }

  const group = new THREE.Group();
  scene.add(group);
  const widths = CHARS.map((c) => (GLYPHS[c].bbox.x2 - GLYPHS[c].bbox.x1) * GLYPH_SCALE);
  const gap = 2.1;
  const letterX: number[] = [];
  const total = widths.reduce((a, b) => a + b, 0) + gap * (CHARS.length - 1);
  let x = -total / 2;
  const meshes: THREE.Mesh[] = CHARS.map((c, i) => {
    const m = new THREE.Mesh(buildGeometry(GLYPHS[c].d), material);
    m.castShadow = true;
    m.receiveShadow = true;
    x += widths[i] / 2;
    m.position.x = x;
    letterX.push(x);
    x += widths[i] / 2 + gap;
    group.add(m);
    return m;
  });

  const L = letterX; // [O, N, Y, X] centres

  // The mirrored letters (see mirrorMat above). Shared geometry, synced to the
  // source meshes in the render loop, so the reflection follows the idle
  // breathing and the assemble intro exactly. Skipped on low-power devices.
  const mirrors: THREE.Mesh[] = LOWPERF
    ? []
    : meshes.map((m) => {
        const r = new THREE.Mesh(m.geometry, mirrorMat);
        r.position.set(m.position.x, 2 * FLOOR_Y, 0);
        scene.add(r);
        return r;
      });

  // Crepuscular light shafts raking behind the word (from the key-light
  // direction). They sit deep in the haze, so the letters occlude them and the
  // light streams PAST the ONYX silhouettes, with dust drifting through it.
  function shaftTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const g = c.getContext('2d')!;
    const across = g.createLinearGradient(0, 0, 64, 0); // soft side falloff
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = across; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in'; // fade the ends
    const along = g.createLinearGradient(0, 0, 0, 256);
    along.addColorStop(0, 'rgba(0,0,0,0)');
    along.addColorStop(0.5, 'rgba(0,0,0,1)');
    along.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = along; g.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  }
  const shaftTex = shaftTexture();
  const shafts: { mesh: THREE.Mesh; base: number; phase: number }[] = [];
  const addShaft = (color: number, opacity: number, x: number, y: number, z: number, w: number, h: number, rot: number, phase: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      map: shaftTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false,
    }));
    m.position.set(x, y, z);
    m.rotation.z = rot;
    scene.add(m);
    shafts.push({ mesh: m, base: opacity, phase });
  };
  const RAKE = 0.5; // one coherent light direction (upper-left key)
  addShaft(0xe8e2dc, LOWPERF ? 0.06 : 0.08, L[0] - 2, 3, -12, 6.5, 48, RAKE, 0.0); // off-white, deep haze left
  addShaft(0x6e0d25, LOWPERF ? 0.05 : 0.07, L[3] - 1, -1, -13, 6, 46, RAKE, 3.1); // crimson, deep haze right

  // ---- Volumetric key beam: the key spotlight made visible. A cone shell
  // whose apex sits AT the key light and opens along its throw, so the beam,
  // the speculars, the cast shadows and the floor reflection all agree on one
  // light source. Animated striations give it the crepuscular shimmer of dust
  // in a projector throw; the shell fades at grazing angles so it has no hard
  // silhouette from any camera position on the journey.
  const BEAM_LEN = 34;
  const BEAM_R = 8.5;
  const beamGeo = new THREE.CylinderGeometry(0.55, BEAM_R, BEAM_LEN, LOWPERF ? 28 : 48, 1, true);
  beamGeo.translate(0, -BEAM_LEN / 2, 0); // apex at the mesh origin, opening down local -Y
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide, // far shell only: soft from outside, no wash from inside
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xe8e2dc) }, // palette off-white: no khaki cast over coal
      uIntensity: { value: LOWPERF ? 0.14 : 0.2 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalMatrix * normal;
        vViewV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewV;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      void main() {
        // Axial falloff: bright toward the apex, carrying down past the floor
        // line, eased right at the apex so there is no hot point at the light.
        float axial = pow(smoothstep(0.02, 1.0, vUv.y), 1.2) * smoothstep(1.0, 0.85, vUv.y);
        // Grazing-angle fade: the shell dissolves at its own silhouette.
        float edge = pow(abs(dot(normalize(vNormalV), normalize(vViewV))), 1.4);
        // Slow crepuscular striations drifting around the cone.
        float stri = 0.78
          + 0.14 * sin(vUv.x * 42.0 + uTime * 0.22)
          + 0.08 * sin(vUv.x * 17.0 - uTime * 0.13);
        gl_FragColor = vec4(uColor, axial * edge * stri * uIntensity);
      }`,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.copy(key.position);
  beam.lookAt(0, -0.5, 0);
  beam.rotateX(-Math.PI / 2); // swing the cylinder's -Y axis onto the look direction
  scene.add(beam);

  // Dust caught in the beam: brighter, slower motes that only exist inside the
  // cone volume (in the beam's local space, so they inherit its aim). This is
  // what makes the ray read as light in air rather than a gradient.
  const BEAM_N = LOWPERF ? 60 : 150;
  const bDust: { ang: number; rad: number; y: number; spd: number; swirl: number }[] = [];
  const bPos = new Float32Array(BEAM_N * 3);
  const coneR = (y: number) => 0.55 + (BEAM_R - 0.55) * (-y / BEAM_LEN);
  for (let i = 0; i < BEAM_N; i++) {
    const d = {
      ang: Math.random() * Math.PI * 2,
      rad: Math.sqrt(Math.random()) * 0.85, // bias toward the bright core
      y: -2.5 - Math.random() * (BEAM_LEN - 6),
      spd: 0.25 + Math.random() * 0.5,
      swirl: (Math.random() - 0.5) * 0.5,
    };
    bDust.push(d);
    const r = d.rad * coneR(d.y);
    bPos[i * 3] = Math.cos(d.ang) * r;
    bPos[i * 3 + 1] = d.y;
    bPos[i * 3 + 2] = Math.sin(d.ang) * r;
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const beamDust = new THREE.Points(bGeo, new THREE.PointsMaterial({
    color: 0xe8e2dc, size: 0.085, transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, map: emberTexture(),
  }));
  beam.add(beamDust); // local to the beam: aimed with the light

  // Where the beam lands: a soft pool of light on the floor (the beam axis
  // meets the floor plane just right of centre), stretched along the throw.
  // This grounds the ray — light that arrives somewhere reads as real.
  function poolTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(), color: 0xe8e2dc, transparent: true, opacity: LOWPERF ? 0.05 : 0.075,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(13, 7.5), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.rotation.z = 0.25; // elongated along the beam's landing direction
  pool.position.set(1.8, FLOOR_Y + 0.02, -2.6); // beam axis ∩ floor plane
  scene.add(pool);

  // ---- Depth-woven words: real troika text that shares the depth buffer,
  // so the letters occlude it — it goes behind, in front, and through the O
  // hole (reading backwards / upside-down when the camera is behind it, which
  // is the intended kinetic-type effect). One short word per letter.
  const woven: { mesh: TroikaText; a: number; b: number; bx: number; by: number; bz: number; fly?: { x: number; y: number; z: number } }[] = [];
  const addWoven = (
    str: string, font: string, size: number, color: number,
    x: number, y: number, z: number, a: number, b: number, ry = 0,
    fly?: { x: number; y: number; z: number },
  ) => {
    const tx = new TroikaText();
    tx.text = str;
    tx.font = font;
    tx.fontSize = size;
    tx.color = color;
    tx.anchorX = 'center';
    tx.anchorY = 'middle';
    tx.outlineWidth = size * 0.012;
    tx.outlineColor = 0x0a0908;
    tx.outlineBlur = size * 0.14; // soft coal halo for legibility, not a hard stroke
    tx.material.transparent = true;
    tx.position.set(x, y, z);
    tx.rotation.y = ry;
    tx.fillOpacity = 0;
    scene.add(tx);
    tx.sync();
    woven.push({ mesh: tx, a, b, bx: x, by: y, bz: z, fly });
  };
  // All behind-the-letter words share one off-white style. Each word appears
  // and flies clear BEFORE its letter's info text reads.
  addWoven('veterans', cardoUrl, 1.5, 0xe8e2dc, L[0], 0.4, 3, 0.10, 0.18, 0, { x: 0, y: 3, z: 6 }); // on approach, before the O identity
  addWoven('our roots', cardoUrl, 1.6, 0xe8e2dc, L[1], -0.4, -2.6, 0.37, 0.50); // behind N, before the N info
  addWoven('the robot', cardoUrl, 1.5, 0xe8e2dc, L[2], -1.6, 3.4, 0.61, 0.74); // in front of Y, before the Y info
  addWoven('our team', cardoUrl, 1.7, 0xe8e2dc, L[3], 0.2, -2.4, 0.81, 0.90, 0, { x: -1.2, y: 1.4, z: -8 }); // along X on the flip, then recedes back into the haze (never toward/through the X)

  // ---- Camera journey: a keyframe path threaded through the letters ---
  type KF = { t: number; px: number; py: number; pz: number; lx: number; ly: number; lz: number; roll: number };
  const KEYS: KF[] = [
    { t: 0.00, px: 0, py: 2.5, pz: 32, lx: 0, ly: 0, lz: 0, roll: 0 }, // overview (zoomed out, whole word)
    { t: 0.09, px: 0, py: 2.3, pz: 28, lx: 0, ly: 0, lz: 0, roll: 0 },
    { t: 0.14, px: L[0] - 1, py: 1.0, pz: 11, lx: L[0], ly: 0, lz: 0, roll: 0 }, // approach O (pulled back a touch)
    { t: 0.22, px: L[0] + 0.6, py: 0.6, pz: 7.8, lx: L[0], ly: 0, lz: 0, roll: 0 }, // O held (identity dwell)
    { t: 0.31, px: L[0], py: 0.2, pz: 2.4, lx: L[0], ly: 0, lz: -6, roll: 0 }, // enter the hole
    { t: 0.37, px: L[0], py: 0, pz: -1, lx: L[0], ly: 0, lz: -6.5, roll: 0 }, // through the hole
    { t: 0.42, px: L[1] - 5, py: 1.0, pz: -6.8, lx: L[1], ly: 0, lz: -0.5, roll: 0.16 }, // swing behind N
    { t: 0.49, px: L[1] - 6.6, py: 0.9, pz: -3.5, lx: L[1], ly: 0, lz: 0, roll: 0.3 }, // orbit N
    { t: 0.57, px: L[1], py: 0.8, pz: 10, lx: L[1], ly: 0, lz: 0, roll: 0 }, // front N (pulled back a touch)
    { t: 0.66, px: L[2] - 4, py: 0.9, pz: -6.8, lx: L[2], ly: 0, lz: 0, roll: -0.2 }, // around Y
    { t: 0.72, px: L[2] + 6.2, py: 0.9, pz: -3.7, lx: L[2], ly: 0, lz: 0, roll: -0.32 }, // orbit Y
    { t: 0.80, px: L[2] + 1, py: 0.8, pz: 10, lx: L[2], ly: 0, lz: 0, roll: 0 }, // front Y (pulled back a touch)
    { t: 0.87, px: L[3] - 5, py: 0.9, pz: -6, lx: L[3], ly: 0, lz: 0, roll: -0.2 }, // swing behind X
    { t: 0.93, px: L[3] + 1, py: 0.7, pz: 10.5, lx: L[3], ly: 0, lz: 0, roll: 0 }, // front X, team reads (pulled back a touch)
    { t: 1.00, px: 0, py: 2.5, pz: 32, lx: 0, ly: 0, lz: 0, roll: 0 }, // pull back (bookends the overview)
  ];
  // Smooth, continuous camera path. A Catmull-Rom spline (finite-difference
  // tangents on the non-uniform keyframe times) so the camera FLOWS through the
  // waypoints with continuous velocity, instead of easing to a dead stop at each
  // one — the stop/accelerate at every keyframe was the "square", segmented feel.
  const evalKF = (p: number) => {
    const n = KEYS.length;
    let i = 0;
    for (; i < n - 1; i++) if (p <= KEYS[i + 1].t) break;
    i = Math.min(i, n - 2);
    const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(n - 1, i + 2)];
    const h = (k2.t - k1.t) || 1;
    let s = (p - k1.t) / h; s = s < 0 ? 0 : s > 1 ? 1 : s;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const TENSION = 0.9; // slightly relax tangents so the spline never overshoots into a letter
    const ch = (a: number, b: number, c: number, d: number) => {
      const m1 = TENSION * (c - a) / ((k2.t - k0.t) || 1) * h; // Catmull-Rom tangent, scaled to the local segment
      const m2 = TENSION * (d - b) / ((k3.t - k1.t) || 1) * h;
      return h00 * b + h10 * m1 + h01 * c + h11 * m2;
    };
    return {
      px: ch(k0.px, k1.px, k2.px, k3.px), py: ch(k0.py, k1.py, k2.py, k3.py), pz: ch(k0.pz, k1.pz, k2.pz, k3.pz),
      lx: ch(k0.lx, k1.lx, k2.lx, k3.lx), ly: ch(k0.ly, k1.ly, k2.ly, k3.ly), lz: ch(k0.lz, k1.lz, k2.lz, k3.lz),
      roll: ch(k0.roll, k1.roll, k2.roll, k3.roll),
    };
  };
  (window as any).__onyxEval = evalKF; // deterministic path read-back (velocity-profile analysis)
  (window as any).__onyxJump = (p: number) => { targetP = p; scrollP = p; }; // test hook: snap the journey (capture harness)

  // Content dwell windows: the readable HTML for each letter reveals while the
  // camera holds on it (O framed through the hole; N/Y/X front; X close).
  const DWELL = [
    { a: 0.20, b: 0.31 }, // O identity, after 'veterans' has flown clear
    { a: 0.53, b: 0.63 },
    { a: 0.76, b: 0.83 },
    { a: 0.91, b: 0.98 }, // roster reads on front-X after 'our team' clears, then falls away as the camera pulls back
  ];
  const flowState = [false, false, false, false];

  let pointerX = 0, pointerY = 0; // -1..1
  let leanK = 1; // cursor-lean, fades once the journey starts
  let scrollVel = 0; // |scroll velocity|, drives dust turbulence
  let targetP = 0, scrollP = 0; // scroll progress, smoothed
  const clock = new THREE.Clock();
  let elapsed = 0;
  let alive = false; // idle breathing runs only after the assemble

  // Post: a low, tight bloom so only the brightest speculars and dust glow
  // (cinematic, not a wash). OutputPass applies tone mapping + colour space.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (!LOWPERF) {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.26, 0.5, 0.82));
  }
  composer.addPass(new OutputPass());

  function resize() {
    const w = stage.clientWidth || innerWidth;
    const h = stage.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', () => { resize(); ScrollTrigger.refresh(); }, { passive: true });

  // ---- Content flow (HTML overlay, readable + interactive) -----------
  // Generous top/bottom margins: Grey Qo's script ascenders and descenders
  // overshoot the line box hard (they cropped at mobile sizes with -8%).
  const SHOWN = 'inset(-22% -8% -18% -8%)';
  const HID_BELOW = 'inset(100% -8% -18% -8%)';
  const HID_ABOVE = 'inset(-22% -8% 100% -8%)';
  const FLOW = [
    { ix: 0, iy: 34, ox: 0, oy: -46 },
    { ix: -58, iy: 52, ox: 80, oy: -66 },
    { ix: 0, iy: -50, ox: 0, oy: 62 },
    { ix: -60, iy: -44, ox: 78, oy: 54 },
  ];
  const allLines = groupsEl.flatMap((g) => gsap.utils.toArray<HTMLElement>('.flow-line', g));
  gsap.set(groupsEl, { opacity: 1, visibility: 'hidden' });
  gsap.set(allLines, { clipPath: HID_BELOW });
  const flowIn = (i: number) => {
    const ln = gsap.utils.toArray<HTMLElement>('.flow-line', groupsEl[i]);
    gsap.set(groupsEl[i], { visibility: 'visible' });
    gsap.fromTo(ln, { clipPath: HID_BELOW, x: FLOW[i].ix, y: FLOW[i].iy },
      { clipPath: SHOWN, x: 0, y: 0, ease: 'expo.out', duration: 1.15, stagger: 0.11, overwrite: true }); // slower, softer settle
  };
  const flowOut = (i: number) => {
    const ln = gsap.utils.toArray<HTMLElement>('.flow-line', groupsEl[i]);
    gsap.to(ln, { clipPath: HID_ABOVE, x: FLOW[i].ox, y: FLOW[i].oy, ease: 'power2.inOut', duration: 0.6, stagger: 0.04, overwrite: true,
      onComplete: () => { if (!flowState[i]) gsap.set(groupsEl[i], { visibility: 'hidden' }); } });
  };

  // ---- Render loop ---------------------------------------------------
  const render = () => {
    const _t0 = (window as any).__onyxFrame ? performance.now() : 0; // perf probe (test only)
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;
    scrollP += (targetP - scrollP) * 0.12; // gentler follow -> floatier, more satisfying motion
    (window as any).__onyxP = scrollP; // progress read-back (harmless; used by capture harness)
    const idleK = 1 - Math.min(1, scrollP / 0.06);

    if (alive) {
      // Idle: each letter breathes on its own axis; fades as the journey starts.
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i];
        m.rotation.y = Math.sin(t * 0.5 + i * 1.3) * 0.09 * idleK;
        m.rotation.x = Math.sin(t * 0.42 + i * 0.7) * 0.05 * idleK;
        m.position.y = Math.sin(t * 0.6 + i * 1.1) * 0.12 * idleK;
      }
    }

    // Reflections mirror their letters across the floor line (a true mirror
    // transform: y position and x/z rotations negate, y scale flips).
    for (let i = 0; i < mirrors.length; i++) {
      const src = meshes[i], r = mirrors[i];
      r.position.set(src.position.x, 2 * FLOOR_Y - src.position.y, src.position.z);
      r.rotation.set(-src.rotation.x, src.rotation.y, -src.rotation.z);
      r.scale.set(src.scale.x, -src.scale.y, src.scale.z);
      r.visible = src.visible;
    }

    // The beam breathes with the shafts and stirs when the visitor scrolls;
    // its floor pool breathes in step so the light stays one system.
    const breathe = (0.85 + 0.15 * Math.sin(t * 0.3)) * (1 + Math.min(0.7, scrollVel * 0.6));
    beamMat.uniforms.uTime.value = t;
    beamMat.uniforms.uIntensity.value = (LOWPERF ? 0.14 : 0.2) * breathe;
    poolMat.opacity = (LOWPERF ? 0.05 : 0.075) * breathe;

    // Beam dust drifts down the throw and swirls slowly around the axis.
    for (let i = 0; i < BEAM_N; i++) {
      const d = bDust[i];
      d.y -= d.spd * dt;
      d.ang += d.swirl * dt;
      if (d.y < -(BEAM_LEN - 3)) d.y = -2.5;
      const r = d.rad * coneR(d.y);
      bPos[i * 3] = Math.cos(d.ang) * r;
      bPos[i * 3 + 1] = d.y;
      bPos[i * 3 + 2] = Math.sin(d.ang) * r;
    }
    bGeo.attributes.position.needsUpdate = true;

    // Dust motes rise; sway and speed swell with scroll velocity.
    const speedMul = 1 + scrollVel * 6;
    for (let i = 0; i < EMBERS; i++) {
      const d = emberData[i], idx = i * 3;
      emberPos[idx] += d.sx * dt * speedMul + Math.sin(t * d.sway + d.phase) * d.swayR * dt * (1 + scrollVel * 3);
      emberPos[idx + 1] += d.sy * dt * speedMul;
      emberPos[idx + 2] += d.sz * dt * speedMul;
      if (emberPos[idx + 1] > 16 || Math.abs(emberPos[idx]) > 24) {
        emberPos[idx + 1] = -16;
        emberPos[idx] = (Math.random() - 0.5) * 34;
        emberPos[idx + 2] = (Math.random() - 0.5) * 24 - 4;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;

    // Light shafts breathe slowly (living light in the haze) and brighten a
    // touch with scroll velocity, so moving through the letters stirs the light.
    for (const sh of shafts) {
      (sh.mesh.material as THREE.MeshBasicMaterial).opacity =
        sh.base * (0.72 + 0.28 * Math.sin(t * 0.35 + sh.phase)) * (1 + Math.min(0.9, scrollVel * 0.8));
    }
    scrollVel *= 0.9;

    // Woven words fade in near their letter (triangle window, smoothed). A word
    // with a fly vector also drifts on its exit side, clearing the frame.
    for (const w of woven) {
      const mid = (w.a + w.b) / 2, half = (w.b - w.a) / 2 || 1;
      let k = Math.max(0, 1 - Math.abs(scrollP - mid) / half);
      k = k * k * (3 - 2 * k);
      // Fully hide a dormant word: at opacity 0 it must not write depth, or it
      // punches letter-shaped holes in the additive beam behind it.
      w.mesh.visible = k > 0.004;
      w.mesh.fillOpacity = k;
      w.mesh.outlineOpacity = k;
      if (w.fly) {
        const exit = Math.max(0, Math.min(1, (scrollP - mid) / half)); // 0 at peak -> 1 at window end
        const e = exit * exit; // ease-in the launch
        w.mesh.position.set(w.bx + w.fly.x * e, w.by + w.fly.y * e, w.bz + w.fly.z * e);
      }
    }

    // Content HTML reveals during its dwell window.
    for (let i = 0; i < DWELL.length; i++) {
      const inside = scrollP >= DWELL[i].a && scrollP <= DWELL[i].b;
      if (inside && !flowState[i]) { flowState[i] = true; flowIn(i); }
      else if (!inside && flowState[i]) { flowState[i] = false; flowOut(i); }
      // Safety net: a fast scroll can skip the flow-out; never let a letter's
      // copy linger well outside its window (guards the transit beats).
      else if (!inside && !flowState[i] && (scrollP < DWELL[i].a - 0.07 || scrollP > DWELL[i].b + 0.07)
        && groupsEl[i].style.visibility !== 'hidden') {
        gsap.set(groupsEl[i], { visibility: 'hidden' });
        gsap.set(gsap.utils.toArray<HTMLElement>('.flow-line', groupsEl[i]), { clipPath: HID_BELOW });
      }
    }

    // Camera from the smooth keyframe path, with roll and a little cursor parallax.
    const s = evalKF(scrollP);
    (window as any).__onyxCam = { p: scrollP, x: s.px, y: s.py, z: s.pz }; // camera path read-back (velocity analysis)
    const px = pointerX * leanK, py = pointerY * leanK;
    camera.up.set(Math.sin(s.roll), Math.cos(s.roll), 0);
    camera.position.set(s.px - px * 1.4, s.py + py * 0.9, s.pz);
    camera.lookAt(s.lx + px * 0.5, s.ly - py * 0.35, s.lz);
    composer.render();
    if (_t0) (window as any).__onyxFrame(performance.now() - _t0); // per-frame work cost (ms)
  };
  gsap.ticker.add(render);

  if (FINE) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  }

  // ---- Assemble intro (once, at the top) -----------------------------
  const startAlive = () => { alive = true; };
  gsap.set(meshes, { visibility: 'visible' });
  if (scrollY < 12) {
    const intro = gsap.timeline({ delay: 0.2, onComplete: startAlive });
    meshes.forEach((m, i) => {
      const dir = i % 2 ? 1 : -1;
      intro.from(m.position, { x: m.position.x + dir * 9, y: (i - 1.5) * 4, z: -40, ease: 'expo.out', duration: 1.7 }, i * 0.13);
      intro.from(m.rotation, { y: dir * 1.4, x: 0.6, z: dir * 0.4, ease: 'expo.out', duration: 1.7 }, i * 0.13);
      intro.from(m.scale, { x: 0.4, y: 0.4, z: 0.4, ease: 'expo.out', duration: 1.7 }, i * 0.13);
    });
  } else {
    startAlive();
  }

  // ---- Scroll driver: pins the stage and feeds scroll progress --------
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: '+=1200%', // longer travel -> each beat is slower and more deliberate
    pin: stage,
    scrub: 0.4, // a touch floatier
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      targetP = self.progress;
      leanK = 1 - Math.min(1, self.progress / 0.05);
      scrollVel = Math.min(3, Math.abs(self.getVelocity()) / 1400);
    },
  });

  document.documentElement.classList.add('onyx-live');
  ScrollTrigger.refresh();
}
