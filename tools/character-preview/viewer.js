import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const state = { animals: [], current: null, object: null, mixer: null, clips: [], action: null,
  playing: false, loadId: 0, abort: null, renderer: null, stats: null, frames: [], loadedAt: 0,
  swaps: 0, failures: 0, released: 0, loops: 0, status: 'starting', externalRequests: 0 };
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x819276, 2.4));
const light = new THREE.DirectionalLight(0xfff4df, 3.8);
light.position.set(4, 6, 5); scene.add(light);
const rim = new THREE.DirectionalLight(0xe1e8ff, 1.8);
rim.position.set(-4, 3, -2); scene.add(rim);
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 1000);
let controls, catalogSource = '', lastFrame = performance.now(), frameHandle, distance = 4;
const controlsIds = ['clip', 'time', 'play', 'pause', 'stop', 'left', 'right', 'closer', 'farther', 'reset'];
const labels = { idle: '대기', greet: '인사', move: '이동', curious: '관심 있게 보기', celebrate: '작은 축하', rest: '휴식', special: '종별 동작' };

function status(text, value) { $('status').textContent = text; state.status = value; }
function enable(value) { for (const id of controlsIds) $(id).disabled = !value; }
function fallback(reason) { $('fallback').hidden = false; canvas.hidden = true; $('fallback-reason').textContent = reason; enable(false); }
function image(animal) {
  $('hero').onerror = () => { $('hero').onerror = null; $('hero').src = 'fallback.svg'; };
  $('hero').src = animal?.hero ? '/assets/' + animal.hero : 'fallback.svg';
  $('hero').alt = animal?.hero ? `${animal.name}의 정적 대표 이미지` : '자산이 없을 때 표시하는 일반 대체 그림';
}
function dispose(object) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  object.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const resource of [...geometries, ...materials, ...textures, ...skeletons]) resource.dispose();
  for (const texture of textures) texture.source?.data?.close?.();
  state.released += geometries.size + materials.size + textures.size + skeletons.size;
}
function unload() {
  state.abort?.abort(); state.abort = null;
  state.playing = false;
  if (state.mixer) { state.mixer.stopAllAction(); state.mixer.uncacheRoot(state.object); }
  if (state.object) { scene.remove(state.object); dispose(state.object); }
  state.object = null; state.mixer = null; state.action = null; state.clips = []; state.stats = null; state.frames = [];
  state.renderer?.renderLists.dispose();
  enable(false);
}
function stats(object, clips, bytes) {
  let triangles = 0, bones = 0, skinnedMeshes = 0;
  const materials = new Set(), textures = new Set(), geometry = new Set();
  object.traverse((node) => {
    if (node.isBone) bones++;
    if (node.isSkinnedMesh) skinnedMeshes++;
    if (node.geometry && node.isMesh) { triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; geometry.add(node.geometry); }
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue; materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const dimensions = [...textures].map((t) => [t.source?.data?.width || 0, t.source?.data?.height || 0]);
  return { triangles, bones, skinnedMeshes, geometries: geometry.size, materials: materials.size, textures: textures.size,
    textureDimensions: dimensions, bytes, clips: clips.map((c) => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })) };
}
function facts() {
  const s = state.stats;
  const pairs = [ ['파일 크기', s ? `${(s.bytes / 1024 / 1024).toFixed(2)} MiB` : '아직 불러오지 않음'],
    ['삼각형', s?.triangles.toLocaleString() ?? '—'], ['재질 / 텍스처', s ? `${s.materials} / ${s.textures}` : '—'],
    ['뼈대 / 스킨 메시', s ? `${s.bones} / ${s.skinnedMeshes}` : '—'], ['클립', s ? `${s.clips.length}개` : '—'],
    ['이동 방식', state.current?.motion ?? '미확정'], ['화면 / DPR', `${innerWidth}×${innerHeight} / ${devicePixelRatio}`],
    ['도구 / 환경', `Three.js ${THREE.REVISION} · ${navigator.platform} · render DPR 1 / AA off`], ['제작 소스', catalogSource || '미확인'],
    ['텍스처 해상도', s ? s.textureDimensions.map((a) => a.join('×')).join(', ') || '텍스처 없음 · 재질 색상' : '—'] ];
  $('facts').replaceChildren(...pairs.map(([key, value]) => { const group = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = key; dd.textContent = value; group.append(dt, dd); return group; }));
}
function resetCamera() {
  if (!state.object || !controls) return;
  const bounds = new THREE.Box3().setFromObject(state.object), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  distance = Math.max(size.x, size.y, size.z) * 2.5;
  camera.position.copy(center).add(new THREE.Vector3(0.8, 0.35, 1).normalize().multiplyScalar(distance));
  controls.target.copy(center); controls.minDistance = distance * 0.35; controls.maxDistance = distance * 2.5;
  camera.near = distance / 100; camera.far = distance * 50; camera.updateProjectionMatrix(); controls.update();
}
function selectClip(play = true) {
  if (!state.mixer) return;
  state.mixer.stopAllAction();
  state.loops = 0;
  const clip = state.clips[Number($('clip').value)];
  if (!clip) return;
  state.action = state.mixer.clipAction(clip); state.action.reset().play(); state.action.paused = !play; state.playing = play;
  $('time').max = clip.duration; $('time').value = 0; $('time-label').textContent = '0.00초';
  state.mixer.update(0);
  status(`${state.current.name} · ${labels[clip.name] || clip.name} ${play ? '재생 중' : '정지'}`, play ? 'playing' : 'paused');
}
function checkGlb(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength) throw Error('Invalid GLB');
  const size = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + size > buffer.byteLength) throw Error('Invalid JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, size)));
  if ([...(json.buffers || []), ...(json.images || [])].some((r) => r.uri)) throw Error('Embedded resources only');
}
async function load() {
  const id = ++state.loadId; unload();
  const animal = state.animals.find((a) => a.id === $('animal').value); state.current = animal;
  $('animal-title').textContent = animal.name;
  $('quality').textContent = animal.status === 'passed' ? '제작 검사 통과 · 사람 검토 대기' : animal.status === 'temporary_fixture' ? '임시 fixture' : animal.status === 'pending' ? '제작 대기' : '검토 후보';
  $('note').textContent = animal.note || '자산 검사와 사람 최종 검토는 별도입니다.';
  image(animal); facts();
  if ($('static').checked || !state.renderer) { fallback($('static').checked ? '움직임 최소화: GLB를 읽지 않고 정적 이미지로 표시합니다.' : '이 환경에서 3D를 사용할 수 없습니다. 정적 대체 이미지입니다.'); status('정적 이미지로 검토 중입니다.', 'static'); return; }
  const variant = document.querySelector('[name=variant]:checked').value;
  if (!animal[variant]) { fallback('이 자산 버전은 아직 준비되지 않았습니다. 완료 수량에 포함하지 않습니다.'); status('선택한 자산이 아직 없습니다.', 'pending'); return; }
  fallback('선택한 로컬 GLB를 불러오는 중입니다.'); status('선택 자산을 불러오는 중입니다.', 'loading');
  const started = performance.now();
  state.abort = new AbortController();
  try {
    const response = await fetch('/assets/' + animal[variant], { signal: state.abort.signal });
    if (!response.ok) throw Error('Load failed');
    const buffer = await response.arrayBuffer(); checkGlb(buffer);
    if (id !== state.loadId) return;
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => { if (!url.startsWith('blob:') && !url.startsWith('data:')) { state.externalRequests++; throw Error('External resource blocked'); } return url; });
    const gltf = await new GLTFLoader(manager).parseAsync(buffer, '');
    if (id !== state.loadId) { dispose(gltf.scene); return; }
    state.object = gltf.scene; state.clips = gltf.animations; state.mixer = new THREE.AnimationMixer(state.object); state.mixer.addEventListener('loop', () => state.loops++); scene.add(state.object);
    state.stats = { ...stats(state.object, state.clips, buffer.byteLength), loadMs: performance.now() - started };
    state.swaps++; state.loadedAt = performance.now(); state.frames = [];
    $('clip').replaceChildren(...state.clips.map((clip, i) => { const option = document.createElement('option'); option.value = i; option.textContent = `${labels[clip.name] || clip.name} · ${clip.duration.toFixed(2)}초`; return option; }));
    $('fallback').hidden = true; canvas.hidden = false; enable(true); $('clip').disabled = !state.clips.length;
    for (const control of ['play', 'pause', 'stop']) $(control).disabled = !state.clips.length;
    resetCamera(); facts();
    if (state.clips.length) selectClip(); else status('정적 GLB를 표시했습니다. 움직임 클립이 없습니다.', 'ready');
  } catch (error) {
    if (id !== state.loadId || error.name === 'AbortError') return;
    state.failures++; unload(); fallback('자산을 읽지 못했습니다. 정적 이미지로 확인하거나 다시 불러오기를 선택해주세요.'); status('3D 불러오기 실패 · 이전 자산은 해제했습니다.', 'failed');
  }
}
function resize() { if (!state.renderer) return; const { clientWidth: width, clientHeight: height } = $('viewport'); state.renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); state.frames = []; state.loadedAt = performance.now(); facts(); }
function frame(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.1);
  if (state.object && state.playing && now - state.loadedAt > 1000) { state.frames.push(now - lastFrame); if (state.frames.length > 600) state.frames.shift(); }
  lastFrame = now;
  if (state.playing) state.mixer?.update(delta);
  if (state.action && state.playing) { $('time').value = state.action.time; $('time-label').textContent = state.action.time.toFixed(2) + '초'; }
  controls?.update();
  if (state.renderer && state.object && !$('static').checked) state.renderer.render(scene, camera);
  frameHandle = requestAnimationFrame(frame);
}
try {
  state.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  state.renderer.setPixelRatio(1); state.renderer.setClearColor(0xf1f3e9, 0);
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping; state.renderer.toneMappingExposure = 1;
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.enablePan = false;
} catch { fallback('WebGL 초기화 실패: 정적 이미지를 표시합니다.'); }
canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); ++state.loadId; unload(); state.renderer?.dispose(); state.renderer = null; fallback('3D context를 사용할 수 없어 정적 이미지로 전환했습니다. 새로고침 후 환경을 확인해주세요.'); status('3D context 중단 · 정적 표시', 'context_lost'); });
$('static').checked = reduced.matches;
reduced.addEventListener('change', (event) => { $('static').checked = event.matches; load(); });
$('static').addEventListener('change', load); $('animal').addEventListener('change', load); $('retry').addEventListener('click', load);
document.querySelectorAll('[name=variant]').forEach((radio) => radio.addEventListener('change', load));
$('clip').addEventListener('change', () => selectClip()); $('play').addEventListener('click', () => { if (state.action) { state.action.paused = false; state.playing = true; status('선택 움직임 재생 중', 'playing'); } });
$('time').addEventListener('input', () => { if (!state.action) return; state.playing = false; state.action.paused = true; state.action.time = Number($('time').value); state.mixer.update(0); $('time-label').textContent = state.action.time.toFixed(3) + '초'; status('선택한 시점의 자세입니다. 표준형과 경량형을 같은 시점으로 비교할 수 있습니다.', 'paused'); });
$('pause').addEventListener('click', () => { if (state.action) { state.action.paused = true; state.playing = false; status('현재 자세에서 일시 정지했습니다.', 'paused'); } });
$('stop').addEventListener('click', () => selectClip(false));
for (const [id, amount] of [['left', -0.3], ['right', 0.3]]) $(id).addEventListener('click', () => { const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), amount); camera.position.copy(controls.target).add(offset); controls.update(); });
for (const [id, factor] of [['closer', 0.85], ['farther', 1.18]]) $(id).addEventListener('click', () => { camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target); controls.update(); });
$('reset').addEventListener('click', resetCamera); new ResizeObserver(resize).observe($('viewport'));
window.addEventListener('pagehide', () => { ++state.loadId; cancelAnimationFrame(frameHandle); unload(); controls?.dispose(); state.renderer?.dispose(); });
window.previewDiagnostics = Object.freeze({ snapshot: () => ({ status: state.status, animal: state.current?.id, variant: document.querySelector('[name=variant]:checked').value,
  stats: state.stats, playing: state.playing, actionTime: state.action?.time ?? null, completedLoops: state.loops, swaps: state.swaps, failures: state.failures, released: state.released,
  memory: state.renderer ? { ...state.renderer.info.memory, programs: state.renderer.info.programs?.length } : null,
  frameIntervalsMs: [...state.frames], sampleRule: 'RAF intervals after most recent load/resize plus 1000ms; latest at most 600; active animation only; linear quantiles',
  bones: state.object ? (() => { const values = []; state.object.traverse((n) => { if (n.isBone) values.push(...n.quaternion.toArray(), ...n.position.toArray(), ...n.scale.toArray()); }); return values; })() : [],
  viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, renderPixelRatio: 1, antialias: false }, userAgent: navigator.userAgent, platform: navigator.platform,
  renderer: (() => { const gl = state.renderer?.getContext(); if (!gl) return null; const extension = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER); })(),
  externalRequests: state.externalRequests, reducedMotion: $('static').checked }) });
frameHandle = requestAnimationFrame(frame);
try {
  const response = await fetch('/catalog.json'); if (!response.ok) throw Error('Catalog unavailable');
  const catalog = await response.json(); state.animals = catalog.animals; catalogSource = catalog.source_commit;
  $('animal').replaceChildren(...state.animals.map((animal) => { const option = document.createElement('option'); option.value = animal.id; option.textContent = animal.name + (animal.status === 'pending' ? ' · 준비 중' : animal.status === 'temporary_fixture' ? ' · 임시 fixture' : ''); return option; }));
  const requestedAnimal = new URLSearchParams(location.search).get('animal');
  if (state.animals.some((animal) => animal.id === requestedAnimal)) $('animal').value = requestedAnimal;
  $('animal').disabled = false; resize(); await load();
} catch { status('로컬 자산 목록을 읽지 못했습니다. catalog 설정을 확인해주세요.', 'catalog_failed'); }
