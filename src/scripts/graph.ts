import * as THREE from 'three';

/** Lo que la escena necesita de cada estrella: a qué constelación pertenece y cuánto brilla (1 a 3). */
export type StarData = { constellation: number; brightness: number; color: string };

const STAR_WHITE = 0xdfe6ff;
// Temperaturas de color reales de estrellas: de azul (calientes) a naranja (frías).
const STAR_PALETTE = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff', '#fff4ea', '#ffd2a1', '#ffb07a'];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Centro de cada constelación alrededor de ti (el origen), repartidas en círculo. */
export function constellationCenter(index: number, total: number, radius = 5) {
  const angle = 2.5 - (index * 2 * Math.PI) / total;
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.75, index % 2 ? -1 : 0.5);
}

/**
 * Coloca las estrellas de cada constelación en espiral alrededor de su centro.
 * Es determinista: el mismo contenido siempre dibuja el mismo cielo.
 */
export function layoutStars(stars: StarData[], totalConstellations: number) {
  const seen = new Array(totalConstellations).fill(0);
  const counts = new Array(totalConstellations).fill(0);
  stars.forEach((s) => counts[s.constellation]++);
  return stars.map((s) => {
    const j = seen[s.constellation]++;
    const r = 0.5 + 2 * Math.sqrt((j + 0.5) / counts[s.constellation]);
    const a = j * GOLDEN_ANGLE;
    return constellationCenter(s.constellation, totalConstellations)
      .add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.8, (j % 3) * 0.4 - 0.4));
  });
}

type Frame = { pos: THREE.Vector3; look: THREE.Vector3 };

/** Encuadres del recorrido: vista general y luego una parada por constelación. */
export function buildKeyframes(centers: THREE.Vector3[]): Frame[] {
  return [
    { pos: new THREE.Vector3(0, 0, 16), look: new THREE.Vector3() },
    ...centers.map((c) => ({ pos: c.clone().add(new THREE.Vector3(1.2, 0.6, 9.5)), look: c.clone() })),
  ];
}

/**
 * Interpola la cámara entre encuadres según el progreso de scroll (0..1).
 * shiftX desplaza los encuadres en horizontal para dejar sitio al texto a la izquierda en pantallas anchas.
 * Se aplica entero a 16 unidades de distancia y en proporción más cerca, para que el hueco en pantalla sea parecido.
 */
export function cameraAt(progress: number, keyframes: Frame[], shiftX = 0) {
  const frames = keyframes.map((k) => {
    const dx = (shiftX * k.pos.distanceTo(k.look)) / 16;
    return { pos: k.pos.clone().setX(k.pos.x + dx), look: k.look.clone().setX(k.look.x + dx) };
  });
  if (frames.length === 1) return { pos: frames[0].pos.clone(), look: frames[0].look.clone() };
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

function line(a: THREE.Vector3, b: THREE.Vector3, color: THREE.ColorRepresentation, opacity: number, dashed: boolean) {
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, opacity, dashSize: 0.12, gapSize: 0.22, ...additive })
    : new THREE.LineBasicMaterial({ color, opacity, ...additive });
  const result = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material);
  if (dashed) result.computeLineDistances();
  return result;
}

export function mountGraph(options: {
  canvas: HTMLCanvasElement;
  stars: StarData[];
  /** Cuántas constelaciones visibles hay (las que tienen estrellas), en orden. */
  totalConstellations: number;
  /** Etiqueta HTML de cada estrella, en el mismo orden que stars. */
  starLabels: HTMLElement[];
  /** Nombre HTML de cada constelación, en orden. */
  constellationLabels: HTMLElement[];
  getProgress: () => number;
  reducedMotion: boolean;
}) {
  const { canvas, stars, totalConstellations, starLabels, constellationLabels, getProgress, reducedMotion } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const glow = glowTexture();
  const spikes = spikeTexture();

  const star = (pos: THREE.Vector3, color: THREE.ColorRepresentation, size: number, withSpikes = false) => {
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

  const field = starField(4000);
  scene.add(field);

  // Tú, en el centro.
  const center = new THREE.Vector3();
  star(center, STAR_WHITE, 3, true);

  const positions = layoutStars(stars, totalConstellations);
  const centers = Array.from({ length: totalConstellations }, (_, i) => constellationCenter(i, totalConstellations));
  const keyframes = buildKeyframes(centers);
  const twinkling: { sprite: THREE.Sprite; phase: number; base: number }[] = [];

  // Trazo de cada constelación: une sus estrellas en orden, como en las cartas celestes.
  for (let c = 0; c < totalConstellations; c++) {
    const members = positions.filter((_, i) => stars[i].constellation === c);
    const color = stars.find((s) => s.constellation === c)?.color ?? STAR_WHITE;
    for (let i = 1; i < members.length; i++) scene.add(line(members[i - 1], members[i], color, 0.35, false));
    if (members[0]) scene.add(line(center, members[0], color, 0.18, true));
  }

  stars.forEach((s, i) => {
    const size = 0.7 + s.brightness * 0.55;
    twinkling.push({ sprite: star(positions[i], s.color, size, s.brightness === 3), phase: i * 1.7, base: size });
  });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En vertical (móvil) el cielo no cabe: se aleja la cámara un poco.
    camera.zoom = camera.aspect < 1 ? 0.6 : 1;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Paralaje suave con el puntero: el cielo se mueve un poco detrás de las constelaciones.
  const pointer = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    }, { passive: true });
  }

  const fieldUniforms = (field.material as THREE.ShaderMaterial).uniforms;
  const projected = new THREE.Vector3();
  const place = (label: HTMLElement, pos: THREE.Vector3) => {
    projected.copy(pos).project(camera);
    const x = (projected.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * canvas.clientHeight;
    label.style.translate = `${x}px ${y}px`;
    label.style.opacity = projected.z < 1 ? '' : '0';
  };
  let visible = true;
  let frame = 0;

  const render = (time: number) => {
    const t = reducedMotion ? 0 : time / 1000;
    const { pos, look } = cameraAt(getProgress(), keyframes, camera.aspect > 1.2 ? -4.5 : 0);
    parallax.lerp(pointer, 0.05);
    camera.position.copy(pos).add(new THREE.Vector3(parallax.x * 0.6, -parallax.y * 0.4, 0));
    camera.lookAt(look);

    fieldUniforms.time.value = t;
    field.rotation.y = t * 0.01;
    clouds.forEach((c, i) => (c.material.rotation += reducedMotion ? 0 : 0.0002 * (i + 1)));
    twinkling.forEach(({ sprite, phase, base }) => {
      sprite.scale.setScalar(base * (1 + 0.08 * Math.sin(t * 1.3 + phase)));
      sprite.material.opacity = 0.8 + 0.2 * Math.sin(t * 1.7 + phase) * Math.sin(t * 0.7 + phase * 2);
    });
    renderer.render(scene, camera);

    // Las etiquetas son HTML real (botones accesibles); aquí solo se colocan sobre su estrella.
    starLabels.forEach((label, i) => place(label, positions[i]));
    constellationLabels.forEach((label, i) => place(label, centers[i].clone().add(new THREE.Vector3(0, 2.9, 0))));

    if (visible) frame = requestAnimationFrame(render);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(frame);
    if (visible) frame = requestAnimationFrame(render);
  }).observe(canvas);
}
