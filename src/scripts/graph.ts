import * as THREE from 'three';

export type Phase = { id: string; active: boolean };

// Encuadres de cámara que recorre el scroll: vista general, zoom al nodo activo y vista de lo que falta.
const KEYFRAMES = [
  { pos: new THREE.Vector3(0, 0, 13), look: new THREE.Vector3(0, 0, 0) },
  { pos: new THREE.Vector3(1.8, 4.6, 6), look: new THREE.Vector3(0, 4, 0) },
  { pos: new THREE.Vector3(-3.5, -2, 11), look: new THREE.Vector3(-3.5, 0, 0) },
];

const EMBER = 0xff7a45;
const VIOLET = 0x9d8cff;
const STAR_WHITE = 0xdfe6ff;
// Temperaturas de color reales de estrellas: de azul (calientes) a naranja (frías).
const STAR_PALETTE = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffb07a'];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Posición de cada fase en un anillo, la F0 arriba. Se exporta para los tests. */
export function ringPosition(index: number, total: number, radius = 4) {
  const angle = Math.PI / 2 - (index * 2 * Math.PI) / total;
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, index % 2 ? -0.6 : 0.4);
}

/**
 * Interpola la cámara entre KEYFRAMES según el progreso de scroll (0..1).
 * shiftX desplaza solo la vista general, para dejar sitio al texto de portada en pantallas anchas.
 */
export function cameraAt(progress: number, shiftX = 0) {
  const frames = KEYFRAMES.map((k, i) => (i === 0 ? {
    pos: k.pos.clone().setX(k.pos.x + shiftX),
    look: k.look.clone().setX(k.look.x + shiftX),
  } : k));
  const p = Math.min(Math.max(progress, 0), 1) * (frames.length - 1);
  const i = Math.min(Math.floor(p), frames.length - 2);
  const t = smooth(p - i);
  return {
    pos: frames[i].pos.clone().lerp(frames[i + 1].pos, t),
    look: frames[i].look.clone().lerp(frames[i + 1].look, t),
  };
}

// --- Texturas generadas en un canvas: sin imágenes que descargar. ---

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Halo de una estrella: núcleo blanco que cae de forma rápida, como en una foto de larga exposición. */
const glowTexture = () => canvasTexture(128, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

/** Picos de difracción: la cruz de luz que deja un telescopio en las estrellas brillantes. */
const spikeTexture = () => canvasTexture(256, (ctx, s) => {
  const c = s / 2;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const g = ctx.createLinearGradient(c - dx * c, c - dy * c, c + dx * c, c + dy * c);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    if (dx) ctx.fillRect(0, c - 1, s, 2);
    else ctx.fillRect(c - 1, 0, 2, s);
  }
});

/** Nube de nebulosa: muchas manchas suaves superpuestas al azar. */
const nebulaTexture = () => canvasTexture(256, (ctx, s) => {
  for (let i = 0; i < 70; i++) {
    const r = s * (0.06 + Math.random() * 0.18);
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * s * 0.3;
    const x = s / 2 + Math.cos(angle) * dist;
    const y = s / 2 + Math.sin(angle) * dist * 0.6;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
});

const additive = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true } as const;

// --- Campo estelar: miles de puntos con tamaño, color y centelleo propios, dibujados en un shader. ---

const STAR_VERTEX = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute vec3 starColor;
  uniform float time;
  uniform float pixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.7 + 0.3 * sin(time * (0.6 + phase) + phase * 6.2831);
    vColor = starColor;
    gl_PointSize = size * pixelRatio * (30.0 / -mv.z);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

function starField(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const color = new THREE.Color();
  // La mitad de las estrellas forman una banda inclinada, como la Vía Láctea.
  const band = new THREE.Matrix4().makeRotationZ(-0.5);
  const p = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    if (i % 2) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 35;
      const thickness = (Math.random() + Math.random() + Math.random() - 1.5) * 6;
      p.set(Math.cos(angle) * radius, thickness, Math.sin(angle) * radius - 10).applyMatrix4(band);
    } else {
      p.randomDirection().multiplyScalar(20 + Math.random() * 40);
    }
    p.toArray(positions, i * 3);
    color.set(STAR_PALETTE[Math.floor(Math.random() * STAR_PALETTE.length)]).toArray(colors, i * 3);
    // Muchas estrellas débiles y pocas brillantes, como en el cielo real.
    sizes[i] = 1 + Math.pow(Math.random(), 8) * 7;
    phases[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry()
    .setAttribute('position', new THREE.BufferAttribute(positions, 3))
    .setAttribute('starColor', new THREE.BufferAttribute(colors, 3))
    .setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    .setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: { time: { value: 0 }, pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    ...additive,
  });
  return new THREE.Points(geometry, material);
}

function line(a: THREE.Vector3, b: THREE.Vector3, color: number, opacity: number, dashed: boolean) {
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.12, gapSize: 0.22, ...additive })
    : new THREE.LineBasicMaterial({ color, opacity, ...additive });
  const result = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material);
  if (dashed) result.computeLineDistances();
  return result;
}

export function mountGraph(options: {
  canvas: HTMLCanvasElement;
  phases: Phase[];
  labels: HTMLElement[];
  getProgress: () => number;
  reducedMotion: boolean;
}) {
  const { canvas, phases, labels, getProgress, reducedMotion } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const glow = glowTexture();
  const spikes = spikeTexture();

  const star = (pos: THREE.Vector3, color: number, size: number, withSpikes = false) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, ...additive }));
    sprite.scale.setScalar(size);
    sprite.position.copy(pos);
    scene.add(sprite);
    if (withSpikes) {
      const cross = new THREE.Sprite(new THREE.SpriteMaterial({ map: spikes, color, opacity: 0.7, ...additive }));
      cross.scale.setScalar(size * 1.6);
      cross.position.copy(pos);
      scene.add(cross);
    }
    return sprite;
  };

  // Nebulosas de fondo: color de marca muy tenue, lejos de la cámara.
  const nebula = nebulaTexture();
  const clouds = [
    { color: 0x5b3fd1, pos: [-18, 8, -40], scale: 70, opacity: 0.35 },
    { color: 0xb8452a, pos: [22, -10, -45], scale: 60, opacity: 0.22 },
    { color: 0x2a4fb8, pos: [0, -4, -55], scale: 90, opacity: 0.25 },
  ].map(({ color, pos, scale, opacity }) => {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebula, color, opacity, ...additive }));
    cloud.position.set(pos[0], pos[1], pos[2]);
    cloud.scale.setScalar(scale);
    cloud.material.rotation = Math.random() * Math.PI;
    scene.add(cloud);
    return cloud;
  });

  const stars = starField(4000);
  scene.add(stars);

  const center = new THREE.Vector3();
  star(center, STAR_WHITE, 3.2, true);

  const positions = phases.map((_, i) => ringPosition(i, phases.length));
  const pulsing: THREE.Sprite[] = [];
  const flickering: { sprite: THREE.Sprite; phase: number }[] = [];

  phases.forEach((phase, i) => {
    const pos = positions[i];
    scene.add(line(pos, positions[(i + 1) % positions.length], VIOLET, 0.2, true));

    if (phase.active) {
      scene.add(line(center, pos, EMBER, 0.55, false));
      pulsing.push(star(pos, EMBER, 2.6, true));
      // Satélites: las piezas que ya cuelgan de la fase activa.
      [-1, 1].forEach((side) => {
        const sat = pos.clone().add(new THREE.Vector3(side * 0.9, 0.5, 0.3));
        scene.add(line(pos, sat, EMBER, 0.4, false));
        star(sat, 0xffb07a, 0.8);
      });
    } else {
      // Fases pendientes: estrellas débiles que parpadean, unidas con trazo discontinuo.
      scene.add(line(center, pos, VIOLET, 0.45, true));
      flickering.push({ sprite: star(pos, 0xaabfff, 1.1), phase: Math.random() * 10 });
    }
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En vertical (móvil) el anillo no cabe: se aleja la cámara un poco.
    camera.zoom = camera.aspect < 1 ? 0.7 : 1;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Paralaje suave con el puntero: el cielo se mueve un poco detrás del grafo.
  const pointer = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    }, { passive: true });
  }

  const starUniforms = (stars.material as THREE.ShaderMaterial).uniforms;
  const projected = new THREE.Vector3();
  let visible = true;
  let frame = 0;

  const render = (time: number) => {
    const t = reducedMotion ? 0 : time / 1000;
    const { pos, look } = cameraAt(getProgress(), camera.aspect > 1.2 ? -4 : 0);
    parallax.lerp(pointer, 0.05);
    camera.position.copy(pos).add(new THREE.Vector3(parallax.x * 0.6, -parallax.y * 0.4, 0));
    camera.lookAt(look);

    starUniforms.time.value = t;
    stars.rotation.y = t * 0.01;
    clouds.forEach((c, i) => (c.material.rotation += reducedMotion ? 0 : 0.0002 * (i + 1)));
    pulsing.forEach((s) => s.scale.setScalar(2.6 + Math.sin(t * 2) * 0.25));
    flickering.forEach(({ sprite, phase }) => {
      sprite.material.opacity = 0.55 + 0.35 * Math.sin(t * 1.7 + phase) * Math.sin(t * 0.7 + phase * 2);
    });
    renderer.render(scene, camera);

    // Las etiquetas son HTML real (accesible); aquí solo se colocan sobre su nodo.
    labels.forEach((label, i) => {
      projected.copy(positions[i]).project(camera);
      const x = (projected.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * canvas.clientHeight;
      label.style.translate = `${x}px ${y}px`;
      label.style.opacity = projected.z < 1 ? '1' : '0';
    });

    if (visible) frame = requestAnimationFrame(render);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(frame);
    if (visible) frame = requestAnimationFrame(render);
  }).observe(canvas);
}
