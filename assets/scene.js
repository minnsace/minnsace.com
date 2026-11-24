/**
 * Minnsace Inc. — three.js diorama layer.
 *
 * A low-poly island diorama (lighthouse beacon, tavern house, game portals)
 * rendered behind the page content. Progressive enhancement only: if WebGL
 * or the three.js CDN module is unavailable, the plain site remains.
 *
 * Modes:
 * - Desktop: mouse-move parallax, click-drag look, scroll-driven camera drift.
 * - Mobile: touch drag look, capped pixel ratio and particle counts.
 * - WebXR: an "Enter VR" button appears only when immersive-vr is supported;
 *   in VR the diorama becomes a table-top world with the studio title panel
 *   and one portal panel per game arranged around the island.
 * - prefers-reduced-motion: a single static frame, no idle motion.
 */
import * as THREE from "three";

const canvas = document.getElementById("scene-canvas");
const layer = canvas?.closest(".scene-layer");

const GAMES = [
  { title: "The Lethecary", line: "Psychological horror", status: "In development", accent: "#9b87ff" },
  { title: "After Vespers", line: "PSX horror", status: "In development", accent: "#ffb35c" },
  { title: "Deadlight Tavern", line: "Co-op tavern survival", status: "Free on Steam", accent: "#d5b67b" },
  { title: "Daily Verse", line: "Bible verse puzzles", status: "Coming to iOS", accent: "#5ee7d8" },
];

function probeWebGL() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

function boot() {
  if (!canvas || !layer) return;
  if (!probeWebGL()) {
    layer.remove();
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smallScreen =
    window.matchMedia("(max-width: 760px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 820);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    layer.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.xr.setFoveation(1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1424);
  scene.fog = new THREE.Fog(0x0c1424, 20, 52);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 140);
  camera.position.set(0, 4.4, 12);

  const world = new THREE.Group();
  scene.add(world);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x8fb6d9, 0x16202f, 0.85));
  const moonlight = new THREE.DirectionalLight(0xbfd8ff, 1.1);
  moonlight.position.set(7, 12, 5);
  scene.add(moonlight);

  /* ---------- helpers ---------- */
  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0.02, ...extra });

  function panelTexture(draw, width = 1024, height = 512) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d");
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makePanel({ title, line, status, accent }, width, height) {
    const texture = panelTexture((ctx, w, h) => {
      roundedRect(ctx, 10, 10, w - 20, h - 20, 36);
      ctx.fillStyle = "rgba(11, 18, 33, 0.94)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(56, 58, 120, 10);
      ctx.fillStyle = "#f3f4f0";
      ctx.font = "600 92px Georgia, 'Times New Roman', serif";
      ctx.textBaseline = "alphabetic";
      wrapTitle(ctx, title, 56, 208, w - 112, 96);
      ctx.fillStyle = "#c3cede";
      ctx.font = "500 52px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(line, 56, h - 148);
      ctx.fillStyle = accent;
      ctx.font = "700 40px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(status.toUpperCase(), 56, h - 72);
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    return mesh;
  }

  function wrapTitle(ctx, title, x, y, maxWidth, lineHeight) {
    const words = title.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    lines.slice(0, 2).forEach((text, i) => ctx.fillText(text, x, y + i * lineHeight));
  }

  /* ---------- diorama ---------- */
  // Water
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(30, 40),
    new THREE.MeshStandardMaterial({ color: 0x14304d, roughness: 0.35, metalness: 0.15 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;
  world.add(water);

  // Island
  const island = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 1.4, 2.4, 7), std(0x3d4756));
  rock.position.y = 0.6;
  island.add(rock);
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(3.65, 3.5, 0.35, 7), std(0x2e5240));
  grass.position.y = 1.85;
  island.add(grass);
  world.add(island);
  const islandTop = 2.05;

  // Rocks
  for (const [x, z, s] of [[-3.4, 2.6, 0.7], [3.9, 1.8, 0.55], [2.8, -3.4, 0.8], [-3.1, -2.9, 0.5]]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std(0x5a6675));
    r.position.set(x, islandTop - 0.15, z);
    r.rotation.set(x, z, x * z);
    island.add(r);
  }

  // Pine trees
  function pine(x, z, s = 1) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.7, 5), std(0x4a3826));
    trunk.position.y = 0.35;
    tree.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62 - i * 0.15, 0.85, 6), std(0x2e5d43));
      cone.position.y = 0.85 + i * 0.42;
      tree.add(cone);
    }
    tree.position.set(x, islandTop, z);
    tree.scale.setScalar(s);
    return tree;
  }
  island.add(pine(-2.4, -1.7, 1.15), pine(-1.6, -2.5, 0.85), pine(2.9, 0.9, 0.95), pine(-2.9, 0.4, 0.8));

  // Tavern house (a nod to Deadlight Tavern)
  const house = new THREE.Group();
  const houseBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.1), std(0x6b5136));
  houseBody.position.y = 0.5;
  house.add(houseBody);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.7, 4), std(0x3a2e22));
  roof.position.y = 1.35;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);
  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffc37e }),
  );
  windowGlow.position.set(0.3, 0.52, 0.56);
  house.add(windowGlow);
  const houseLight = new THREE.PointLight(0xffb35c, 3.5, 5.5, 1.6);
  houseLight.position.set(0.3, 0.7, 1.0);
  house.add(houseLight);
  house.position.set(-1.9, islandTop, 1.15);
  house.rotation.y = 0.5;
  island.add(house);

  // Lighthouse with rotating beacon — the studio beacon
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 2.4, 10), std(0xe8e4da));
  tower.position.y = 1.2;
  lighthouse.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.51, 0.5, 10), std(0x0ea5df));
  band.position.y = 1.55;
  lighthouse.add(band);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.42, 8), std(0x1c2739));
  lampRoom.position.y = 2.6;
  lighthouse.add(lampRoom);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  lamp.position.y = 2.6;
  lighthouse.add(lamp);
  const lampLight = new THREE.PointLight(0xffc37e, 14, 16, 1.8);
  lampLight.position.y = 2.6;
  lighthouse.add(lampLight);
  const beacon = new THREE.Mesh(
    new THREE.ConeGeometry(0.85, 4.6, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc37e,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beacon.rotation.z = Math.PI / 2;
  beacon.position.x = 2.3;
  const beaconPivot = new THREE.Group();
  beaconPivot.position.y = 2.6;
  beaconPivot.add(beacon);
  lighthouse.add(beaconPivot);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.4, 8), std(0x1c2739));
  cap.position.y = 3.0;
  lighthouse.add(cap);
  lighthouse.position.set(1.9, islandTop, -1.3);
  island.add(lighthouse);

  // Stars and moon
  const starCount = smallScreen ? 260 : 650;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const radius = 55;
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi) + 2;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xcfe2ff, size: 0.32, sizeAttenuation: true, fog: false }),
  );
  scene.add(stars);
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xe9eef5, fog: false }),
  );
  moon.position.set(-19, 15, -34);
  moon.lookAt(0, 2, 0);
  scene.add(moon);

  // Title panel
  const titlePanel = (() => {
    const texture = panelTexture((ctx, w, h) => {
      ctx.textAlign = "center";
      ctx.fillStyle = "#f3f4f0";
      ctx.font = "600 118px Georgia, 'Times New Roman', serif";
      ctx.fillText("MINNSACE INC.", w / 2, 168);
      ctx.fillStyle = "#0ea5df";
      ctx.fillRect(w / 2 - 130, 208, 260, 6);
      ctx.fillStyle = "#c3cede";
      ctx.font = "600 44px 'Segoe UI', Arial, sans-serif";
      ctx.fillText("I N D E P E N D E N T   G A M E   S T U D I O", w / 2, 292);
    }, 1024, 360);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.62),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    mesh.position.set(0, 5.1, -3.2);
    world.add(mesh);
    return mesh;
  })();

  // Game portal panels around the island
  const portalPanels = GAMES.map((game, i) => {
    const panel = makePanel(game, 2.7, 1.35);
    const angle = THREE.MathUtils.degToRad(-57 + i * 38);
    const radius = 5.6;
    panel.position.set(Math.sin(angle) * radius, 2.1, Math.cos(angle) * radius);
    panel.lookAt(panel.position.x * 2, 2.1, panel.position.z * 2);
    panel.userData.baseY = 2.1;
    panel.userData.phase = i * 1.37;
    world.add(panel);
    return panel;
  });

  // Controller rays (shown while presenting)
  const controllers = [];
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -4),
    ]);
    const ray = new THREE.Line(
      rayGeometry,
      new THREE.LineBasicMaterial({ color: 0x0ea5df, transparent: true, opacity: 0.55 }),
    );
    controller.add(ray);
    scene.add(controller);
    controllers.push(controller);
  }

  /* ---------- camera control (flat modes) ---------- */
  const look = { yaw: 0, height: 0, targetYaw: 0, targetHeight: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let parallaxX = 0;
  let parallaxY = 0;
  let frameDirty = true;

  const interactive = (target) =>
    target instanceof Element && target.closest("a, button, input, textarea, select, [data-no-orbit]");

  window.addEventListener("pointerdown", (event) => {
    if (interactive(event.target) || renderer.xr.isPresenting) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener("pointermove", (event) => {
    if (renderer.xr.isPresenting) return;
    if (dragging) {
      look.targetYaw = THREE.MathUtils.clamp(look.targetYaw - (event.clientX - lastX) * 0.0035, -1.0, 1.0);
      look.targetHeight = THREE.MathUtils.clamp(look.targetHeight - (event.clientY - lastY) * 0.012, -1.6, 2.2);
      lastX = event.clientX;
      lastY = event.clientY;
      frameDirty = true;
    } else if (event.pointerType === "mouse") {
      parallaxX = (event.clientX / window.innerWidth - 0.5) * 0.14;
      parallaxY = (event.clientY / window.innerHeight - 0.5) * 0.08;
      frameDirty = true;
    }
  });
  const endDrag = () => { dragging = false; };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  window.addEventListener("scroll", () => { frameDirty = true; }, { passive: true });

  function scrollFraction() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(window.scrollY / max, 1) : 0;
  }

  /* ---------- resize / visibility ---------- */
  let onScreen = true;
  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    frameDirty = true;
  };
  window.addEventListener("resize", resize);
  new IntersectionObserver(([entry]) => { onScreen = entry?.isIntersecting ?? true; }).observe(canvas);

  /* ---------- WebXR ---------- */
  const worldHome = { position: world.position.clone(), scale: world.scale.clone() };
  renderer.xr.addEventListener("sessionstart", () => {
    world.position.set(0, 0.1, -3.4);
    world.scale.setScalar(0.36);
  });
  renderer.xr.addEventListener("sessionend", () => {
    world.position.copy(worldHome.position);
    world.scale.copy(worldHome.scale);
  });

  if ("xr" in navigator && navigator.xr) {
    navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
      if (!supported) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vr-button";
      button.textContent = "Enter VR";
      button.addEventListener("click", async () => {
        try {
          const session = await navigator.xr.requestSession("immersive-vr", {
            optionalFeatures: ["local-floor", "bounded-floor"],
          });
          await renderer.xr.setSession(session);
        } catch {
          button.textContent = "VR unavailable";
          button.disabled = true;
        }
      });
      document.body.append(button);
    }).catch(() => { /* no XR support: no button, plain site */ });
  }

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const presenting = renderer.xr.isPresenting;
    if (!presenting && (document.hidden || !onScreen)) return;
    if (!presenting && reducedMotion && !frameDirty) return;
    frameDirty = false;

    const t = clock.getElapsedTime();
    if (!reducedMotion || presenting) {
      beaconPivot.rotation.y = t * 0.55;
      island.position.y = Math.sin(t * 0.5) * 0.06;
      for (const panel of portalPanels) {
        panel.position.y = panel.userData.baseY + Math.sin(t * 0.8 + panel.userData.phase) * 0.09;
      }
      titlePanel.position.y = 5.1 + Math.sin(t * 0.6) * 0.05;
    }

    if (!presenting) {
      const scroll = scrollFraction();
      const ease = reducedMotion ? 1 : 0.06;
      look.yaw += (look.targetYaw - look.yaw) * ease;
      look.height += (look.targetHeight - look.height) * ease;
      const theta = look.yaw + parallaxX + scroll * 0.55 + (reducedMotion ? 0 : Math.sin(t * 0.07) * 0.05);
      const radius = 12 - scroll * 1.6;
      const y = 4.4 + look.height + parallaxY * 2 + scroll * 1.8;
      camera.position.set(Math.sin(theta) * radius, y, Math.cos(theta) * radius);
      camera.lookAt(0, 1.6, 0);
    }

    renderer.render(scene, camera);
  });
}

if (document.readyState === "complete") {
  scheduleBoot();
} else {
  window.addEventListener("load", scheduleBoot, { once: true });
}

function scheduleBoot() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => boot(), { timeout: 1800 });
  } else {
    window.setTimeout(boot, 250);
  }
}
