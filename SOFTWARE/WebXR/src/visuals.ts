import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const metal = new THREE.MeshStandardMaterial({ color: '#b5bec4', metalness: 0.85, roughness: 0.32 });
const darkMetal = new THREE.MeshStandardMaterial({ color: '#37434b', metalness: 0.65, roughness: 0.4 });
const rubber = new THREE.MeshStandardMaterial({ color: '#24292c', roughness: 0.95 });
const white = new THREE.MeshStandardMaterial({ color: '#e6e9e5', roughness: 0.52 });
export const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: '#d6eff6', transparent: true, opacity: 0.17, roughness: 0.09,
  metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false,
});

// These textures are authored locally and do not depend on external asset services.
function surface(kind: 'bench' | 'floor') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = kind === 'bench' ? '#41474b' : '#ced1cb'; ctx.fillRect(0, 0, 512, 512);
  let seed = 817;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 11000; i++) {
    const value = kind === 'bench' ? 48 + Math.floor(random() * 50) : 170 + Math.floor(random() * 60);
    ctx.fillStyle = `rgba(${value},${value},${value},${0.15 + random() * 0.3})`;
    ctx.fillRect(random() * 512, random() * 512, random() * 2 + 0.5, random() * 2 + 0.5);
  }
  if (kind === 'floor') {
    ctx.strokeStyle = '#b4bbb6'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 509, 509);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'floor' ? 16 : 3, kind === 'floor' ? 16 : 2);
  texture.anisotropy = 4;
  return texture;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}

function block(w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, radius = 0) {
  return mesh(radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
}

function sign(title: string, subtitle: string, parent: THREE.Object3D, x: number, y: number, z: number, width: number) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e6e9e5'; ctx.fillRect(0, 0, 768, 192);
  ctx.fillStyle = '#223d48'; ctx.font = '600 62px sans-serif'; ctx.fillText(title, 34, 85);
  ctx.fillStyle = '#57767c'; ctx.font = '24px sans-serif'; ctx.fillText(subtitle, 36, 143);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const object = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture }));
  object.position.set(x, y, z); parent.add(object); return object;
}

export function contactShadow(parent: THREE.Object3D, width: number, depth: number, x: number, y: number, z: number, opacity = 0.3) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.9)'); gradient.addColorStop(0.5, 'rgba(0,0,0,0.4)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity, depthWrite: false }));
  plane.rotation.x = -Math.PI / 2; plane.position.set(x, y, z); parent.add(plane); return plane;
}

function bottle(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(scale); parent.add(group);
  const amber = new THREE.MeshPhysicalMaterial({ color: '#71401b', roughness: 0.22, metalness: 0.08, clearcoat: 1 });
  mesh(new THREE.CylinderGeometry(0.021, 0.024, 0.075, 16), amber, group, 0, 0.038);
  mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.018, 16), amber, group, 0, 0.083);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 16), rubber, group, 0, 0.1);
  const label = block(0.034, 0.027, 0.001, white, group, 0, 0.04, 0.023);
  label.castShadow = false;
}

export function createLab(scene: THREE.Scene) {
  const room = new THREE.Group(); scene.add(room);
  const floor = mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ map: surface('floor'), roughness: 0.85 }), room);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const wall = new THREE.MeshStandardMaterial({ color: '#dce2df', roughness: 0.92 });
  block(7, 3.2, 0.08, wall, room, 0, 1.6, -2.55);
  block(0.08, 3.2, 6, wall, room, -3.0, 1.6, -0.2);
  block(7, 0.13, 0.03, darkMetal, room, 0, 0.075, -2.495);
  block(0.03, 0.13, 6, darkMetal, room, -2.945, 0.075, -0.2);
  sign('SURFACE SCIENCE', 'LAB 01  /  SPIN COATING WORKSTATION', room, 0.3, 2.12, -2.497, 1.35);
  // Frosted windows and the fluorescent fixtures provide visual light sources.
  const windowLight = new THREE.MeshBasicMaterial({ color: '#eef6ff' });
  block(0.018, 1.25, 2.7, windowLight, room, -2.949, 1.95, -0.65);
  for (const z of [-2.02, -0.65, 0.72]) block(0.04, 1.35, 0.025, white, room, -2.925, 1.95, z);
  for (const y of [1.31, 2.59]) block(0.04, 0.035, 2.8, white, room, -2.925, y, -0.65);
  for (const x of [-1.3, 1.3]) {
    block(0.7, 0.035, 1.05, white, room, x, 2.97, -0.5);
    block(0.64, 0.004, 0.99, new THREE.MeshBasicMaterial({ color: '#fff8e8' }), room, x, 2.945, -0.5);
  }
  // Storage counter and open shelving in the background.
  block(5, 0.75, 0.52, white, room, 0, 0.43, -2.17);
  const counterMaterial = new THREE.MeshStandardMaterial({ color: '#555e61', roughness: 0.4, metalness: 0.15 });
  block(5.05, 0.04, 0.56, counterMaterial, room, 0, 0.825, -2.17, 0.01);
  for (const x of [-2, -1, 0, 1, 2]) {
    block(0.96, 0.64, 0.018, white, room, x, 0.46, -1.9, 0.005);
    block(0.13, 0.011, 0.019, metal, room, x + 0.24, 0.7, -1.885, 0.004);
  }
  block(1.3, 0.035, 0.25, white, room, 1.6, 1.56, -2.3);
  for (const x of [1.05, 2.15]) block(0.025, 0.25, 0.025, metal, room, x, 1.42, -2.47);
  for (let i = 0; i < 5; i++) bottle(room, 1.15 + i * 0.17, 1.58, -2.3, 1.6);
  block(0.3, 0.15, 0.19, new THREE.MeshStandardMaterial({ color: '#5d8f98', roughness: 0.5 }), room, -1.55, 0.92, -2.16, 0.015);
  block(0.33, 0.024, 0.22, white, room, -1.55, 1.0, -2.16, 0.006);

  // Epoxy bench top, aluminum supports, rubber feet and a drawer cabinet.
  const table = new THREE.Group(); scene.add(table);
  block(1.8, 0.055, 0.85, new THREE.MeshStandardMaterial({ map: surface('bench'), roughness: 0.45, metalness: 0.08 }), table, 0, 0.87, -0.65, 0.015);
  block(1.73, 0.055, 0.78, metal, table, 0, 0.81, -0.65, 0.008);
  for (const x of [-0.78, 0.78]) for (const z of [-0.95, -0.35]) {
    block(0.04, 0.77, 0.04, metal, table, x, 0.405, z, 0.004);
    block(0.055, 0.03, 0.055, rubber, table, x, 0.015, z, 0.004);
  }
  block(1.57, 0.027, 0.027, metal, table, 0, 0.16, -0.95);
  block(0.36, 0.55, 0.62, white, table, 0.64, 0.49, -0.65, 0.01);
  for (const y of [0.34, 0.51, 0.68]) {
    block(0.32, 0.15, 0.015, white, table, 0.64, y, -0.333, 0.004);
    block(0.1, 0.009, 0.018, metal, table, 0.64, y + 0.035, -0.32, 0.003);
  }
  block(0.37, 0.002, 0.39, new THREE.MeshStandardMaterial({ color: '#849798', roughness: 0.9 }), table, -0.27, 0.899, -0.57, 0.006);
  contactShadow(table, 0.35, 0.4, -0.27, 0.901, -0.57, 0.6);

  // A shallow parts tray and a realistic liquid bottle beside the work area.
  block(0.18, 0.008, 0.13, metal, table, -0.64, 0.903, -0.31, 0.008);
  for (const x of [-0.725, -0.555]) block(0.008, 0.013, 0.125, metal, table, x, 0.913, -0.31, 0.003);
  for (const z of [-0.372, -0.248]) block(0.18, 0.013, 0.008, metal, table, -0.64, 0.913, z, 0.003);
  bottle(table, -0.81, 0.899, -0.71, 1.2);
  const beaker = mesh(new THREE.CylinderGeometry(0.025, 0.021, 0.053, 24, 1, true), glassMaterial, table, -0.79, 0.926, -0.49);
  beaker.castShadow = false;
  mesh(new THREE.TorusGeometry(0.025, 0.0015, 5, 24), glassMaterial, table, -0.79, 0.953, -0.49).rotation.x = Math.PI / 2;
  contactShadow(table, 0.09, 0.09, -0.79, 0.9, -0.49);
  return room;
}

export function printedMaterial(color: string, roughness = 0.47) {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.025 });
  // Original 3MF geometry is in mm, with the print direction along local Z.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying float vLayerHeight;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayerHeight = position.z;');
    shader.fragmentShader = 'varying float vLayerHeight;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.985 + 0.015 * sin(vLayerHeight * 26.18);');
  };
  material.customProgramCacheKey = () => 'maasi-printed-pla-v1';
  return material;
}

export function createPipette(parent: THREE.Group) {
  const body = new THREE.MeshStandardMaterial({ color: '#ecede8', roughness: 0.32 });
  const accent = new THREE.MeshStandardMaterial({ color: '#326584', roughness: 0.4 });
  mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.072, 20), body, parent, 0, 0.005);
  mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.014, 16), darkMetal, parent, 0, 0.048);
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 20), accent, parent, 0, 0.058);
  block(0.02, 0.008, 0.012, body, parent, 0.009, 0.035, 0, 0.003);
  block(0.007, 0.013, 0.003, darkMetal, parent, 0, 0.015, 0.008);
  const tip = mesh(new THREE.CylinderGeometry(0.005, 0.001, 0.045, 16, 1, true), glassMaterial, parent, 0, -0.054);
  tip.castShadow = false;
}

export function machineDetails(machine: THREE.Group, lid: THREE.Group) {
  // Front panel is aligned with the inclined Nextion opening in the original CAD.
  const screenFrame = new THREE.Group(); screenFrame.position.set(0, 0.073, 0.123); screenFrame.rotation.x = -0.674;
  machine.add(screenFrame);
  block(0.123, 0.078, 0.006, rubber, screenFrame, 0, 0, 0, 0.004);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.112, 0.067), new THREE.MeshBasicMaterial({ map: texture }));
  screen.position.z = 0.0035; screenFrame.add(screen);
  const ctx = canvas.getContext('2d')!;
  const draw = (rpm: number, seconds: number, phase: string) => {
    ctx.fillStyle = '#eaece4'; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#31434b'; ctx.font = '20px sans-serif'; ctx.fillText('Maasi Spin Coater', 22, 35);
    ctx.font = '17px sans-serif'; ctx.fillText('COATING SPEED', 22, 85); ctx.fillText('DURATION', 300, 85);
    ctx.font = '44px sans-serif'; ctx.fillText(String(Math.round(rpm)), 22, 139); ctx.fillText(`${seconds}s`, 300, 139);
    ctx.font = '16px sans-serif'; ctx.fillText('RPM', 22, 170);
    ctx.fillStyle = phase === 'idle' ? '#348162' : '#27658c'; ctx.fillRect(0, 222, 512, 98);
    ctx.fillStyle = '#ffffff'; ctx.font = '30px sans-serif'; ctx.fillText(phase.toUpperCase(), 22, 282);
    texture.needsUpdate = true;
  };
  draw(3000, 30, 'idle');
  // Hinge pins, screw heads, rubber feet and power cable.
  for (const x of [-0.085, 0.085]) {
    const pin = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.034, 12), metal, machine, x, 0.131, -0.125);
    pin.rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.006, 16), rubber, machine, x, -0.002, 0.09);
    mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.006, 16), rubber, machine, x, -0.002, -0.1);
  }
  for (const x of [-0.093, 0.093]) for (const z of [0.012, 0.177]) {
    const screw = mesh(new THREE.CylinderGeometry(0.0026, 0.0026, 0.0012, 12), metal, lid, x, 0.008, z);
    block(0.0035, 0.0003, 0.0005, darkMetal, screw, 0, 0.0007);
  }
  const cablePath = new THREE.CatmullRomCurve3([new THREE.Vector3(0.095, 0.02, -0.12), new THREE.Vector3(0.16, 0.015, -0.17), new THREE.Vector3(0.23, 0.004, -0.21), new THREE.Vector3(0.24, 0.001, -0.4)]);
  mesh(new THREE.TubeGeometry(cablePath, 24, 0.0023, 6, false), rubber, machine);
  return draw;
}

export function panelStand(panel: THREE.Mesh, width: number, height: number) {
  const frame = block(width + 0.027, height + 0.027, 0.025, darkMetal, panel, 0, 0, -0.019, 0.012);
  frame.castShadow = frame.receiveShadow = false;
  block(0.018, 0.18, 0.026, metal, panel, 0, -height / 2 - 0.07, -0.03, 0.004).castShadow = false;
}
