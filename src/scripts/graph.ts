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
const PAPER = 0xf2f0fa;

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

function dashedLine(a: THREE.Vector3, b: THREE.Vector3, color: number, opacity: number) {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([a, b]),
    new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.25, transparent: true, opacity }),
  );
  line.computeLineDistances();
  return line;
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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const center = new THREE.Vector3();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), new THREE.MeshBasicMaterial({ color: PAPER })));

  const positions = phases.map((_, i) => ringPosition(i, phases.length));
  const halos: THREE.Mesh[] = [];

  phases.forEach((phase, i) => {
    const pos = positions[i];
    const next = positions[(i + 1) % positions.length];
    scene.add(dashedLine(pos, next, VIOLET, 0.18));

    if (phase.active) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([center, pos]),
        new THREE.LineBasicMaterial({ color: EMBER }),
      ));
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), new THREE.MeshBasicMaterial({ color: EMBER }));
      node.position.copy(pos);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 32, 32),
        new THREE.MeshBasicMaterial({ color: EMBER, transparent: true, opacity: 0.15 }),
      );
      halo.position.copy(pos);
      halos.push(halo);
      scene.add(node, halo);
      // Satélites: las piezas que ya cuelgan de la fase activa.
      [-1, 1].forEach((side) => {
        const sat = pos.clone().add(new THREE.Vector3(side * 0.9, 0.5, 0.3));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos, sat]), new THREE.LineBasicMaterial({ color: EMBER })));
        const satMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({ color: EMBER }));
        satMesh.position.copy(sat);
        scene.add(satMesh);
      });
    } else {
      scene.add(dashedLine(center, pos, VIOLET, 0.45));
      const node = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22, 1),
        new THREE.MeshBasicMaterial({ color: VIOLET, wireframe: true }),
      );
      node.position.copy(pos);
      scene.add(node);
    }
  });

  const starPositions = new Float32Array(600 * 3).map(() => (Math.random() - 0.5) * 60);
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: PAPER, size: 0.05, transparent: true, opacity: 0.6 }),
  );
  scene.add(stars);

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

  const projected = new THREE.Vector3();
  let visible = true;
  let frame = 0;

  const render = (time: number) => {
    const { pos, look } = cameraAt(getProgress(), camera.aspect > 1.2 ? -4 : 0);
    camera.position.copy(pos);
    camera.lookAt(look);
    if (!reducedMotion) {
      stars.rotation.y = time * 0.00003;
      halos.forEach((h) => h.scale.setScalar(1 + Math.sin(time * 0.003) * 0.15));
    }
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
