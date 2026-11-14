import * as THREE from 'three';

/**
 * Escena del método: 27 piezas que cambian de forma en cada paso del riel.
 * problema (nudo) · entender (despiece) · construir (montaje) · medir (barras) · en producción (pieza terminada).
 * Estilo plano de la serie: caras arena, aristas en tinta, sin luces ni degradados.
 */

type Vec = [number, number, number];
export type Piece = { pos: Vec; rot: Vec };

export const STEP_COUNT = 5;
const SIDE = 3;
const COUNT = SIDE ** 3;
// La pieza destacada: arriba, delante, en el centro. En rojo mientras «falla», en naranja cuando está «bien hecha».
export const HIGHLIGHT = 25;

const INK = 0x14213d;
const FACE = 0xfbf9f5;
const RED = new THREE.Color(0xd0391b);
const EMBER = new THREE.Color(0xff5a1f);

const smooth = (t: number) => t * t * (3 - 2 * t);
// Esta forma da exactamente a con t = 0 y b con t = 1 (a + (b - a) * t no siempre).
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

/** Generador pseudoaleatorio con semilla: el nudo sale igual en cada visita y en los tests. */
function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** Posición de la pieza i en la rejilla 3×3×3, de -1 a 1 en cada eje. */
function cell(i: number): Vec {
  return [(i % SIDE) - 1, Math.floor(i / SIDE ** 2) - 1, (Math.floor(i / SIDE) % SIDE) - 1];
}

/** Las cinco formas, una por paso. Se exporta para los tests. */
export function poses(): Piece[][] {
  const random = seeded(7);
  const knot: Piece[] = Array.from({ length: COUNT }, (_, i) => {
    const a = (i / COUNT) * Math.PI * 4;
    return {
      pos: [Math.sin(a) * 2.2 + (random() - 0.5), Math.cos(a * 1.5) * 1.6 + (random() - 0.5), Math.cos(a) * 1.8],
      rot: [random() * 3, random() * 3, random() * 3],
    };
  });
  const exploded = Array.from({ length: COUNT }, (_, i) => ({
    pos: cell(i).map((v) => v * 1.9) as Vec,
    rot: [0, 0, 0] as Vec,
  }));
  const building = Array.from({ length: COUNT }, (_, i) => {
    const [x, y, z] = cell(i);
    // La capa de arriba aún está bajando a su sitio.
    return { pos: [x * 1.05, y === 1 ? 2.4 : y * 1.05, z * 1.05] as Vec, rot: [0, y === 1 ? 0.5 : 0, 0] as Vec };
  });
  // Barras crecientes: 2 + 4 + 5 + 7 + 9 = 27 piezas.
  const heights = [2, 4, 5, 7, 9];
  const bars: Piece[] = [];
  heights.forEach((h, column) => {
    for (let level = 0; level < h; level++) bars.push({ pos: [(column - 2) * 1.15, level * 1.02 - 4.4, 0], rot: [0, 0, 0] });
  });
  // La pieza destacada corona la barra más alta.
  [bars[HIGHLIGHT], bars[COUNT - 1]] = [bars[COUNT - 1], bars[HIGHLIGHT]];
  const done = Array.from({ length: COUNT }, (_, i) => ({ pos: cell(i).map((v) => v * 1.02) as Vec, rot: [0, 0, 0] as Vec }));
  return [knot, exploded, building, bars, done];
}

/** Forma interpolada para un progreso de 0 (primer paso) a 1 (último). */
export function poseAt(progress: number, shapes = poses()): Piece[] {
  const p = Math.min(Math.max(progress, 0), 1) * (shapes.length - 1);
  const i = Math.min(Math.floor(p), shapes.length - 2);
  const t = smooth(p - i);
  return shapes[i].map((from, k) => {
    const to = shapes[i + 1][k];
    return {
      pos: from.pos.map((v, axis) => lerp(v, to.pos[axis], t)) as Vec,
      rot: from.rot.map((v, axis) => lerp(v, to.rot[axis], t)) as Vec,
    };
  });
}

export function mountMetodo(options: {
  canvas: HTMLCanvasElement;
  getProgress: () => number;
  reducedMotion: boolean;
}) {
  const { canvas, getProgress, reducedMotion } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  // Cámara ortográfica en vista isométrica: sin perspectiva, como un dibujo técnico.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(8, 6.5, 8);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);
  const box = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const edges = new THREE.EdgesGeometry(box);
  const edgeMaterial = new THREE.LineBasicMaterial({ color: INK });
  // polygonOffset empuja las caras un poco hacia atrás para que las aristas no parpadeen.
  const faceMaterial = new THREE.MeshBasicMaterial({ color: FACE, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const highlightMaterial = faceMaterial.clone();

  const pieces = Array.from({ length: COUNT }, (_, i) => {
    const mesh = new THREE.Mesh(box, i === HIGHLIGHT ? highlightMaterial : faceMaterial);
    mesh.add(new THREE.LineSegments(edges, edgeMaterial));
    group.add(mesh);
    return mesh;
  });

  const shapes = poses();
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    // Margen para la capa que baja en «construir» y la barra más alta en «medir».
    const view = 5.6;
    const aspect = w / h;
    camera.left = -view * aspect;
    camera.right = view * aspect;
    camera.top = view;
    camera.bottom = -view;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  let frame = 0;
  const render = (time: number) => {
    const progress = Math.min(Math.max(getProgress(), 0), 1);
    poseAt(progress, shapes).forEach((piece, i) => {
      pieces[i].position.set(...piece.pos);
      pieces[i].rotation.set(...piece.rot);
    });
    // Rojo mientras es «lo que falla»; naranja desde que empieza a construirse.
    highlightMaterial.color.copy(RED).lerp(EMBER, smooth(Math.min(progress * 2, 1)));
    group.rotation.y = progress * Math.PI * 0.5 + (reducedMotion ? 0 : Math.sin(time / 4000) * 0.12);
    renderer.render(scene, camera);
    if (visible) frame = requestAnimationFrame(render);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    cancelAnimationFrame(frame);
    if (visible) frame = requestAnimationFrame(render);
  }).observe(canvas);
}
