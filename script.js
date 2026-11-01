import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const MODEL_PATH = "./compressed/3d_experience3.glb";
const MUSIC_PATH = "./compressed/music.mp3";
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.6/";

const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/-0Gjf5v4x/";
// Face-tracking libraries are only downloaded when tracking is first turned on
const TRACKING_SCRIPTS = [
  "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js",
  "https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js",
];
const PREDICT_INTERVAL_MS = 80; // ~12 predictions per second is plenty for head tilts

const ROAD_END = 41.8; // the road loops between -ROAD_END and +ROAD_END on x

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/* Loading screen                                                      */
/* ------------------------------------------------------------------ */

const loadingUI = {
  text: $("loadingText"),
  fill: $("barFill"),
  rows: { model: $("asset-model"), music: $("asset-music") },
};

// bytes loaded/total per asset; `done` flips once the asset is fully usable
const assets = {
  model: { loaded: 0, total: 0, done: false, failed: false, building: false },
  music: { loaded: 0, total: 0, done: false, failed: false },
};

const mb = (bytes) => (bytes / 1048576).toFixed(1);

function assetStatus(a) {
  if (a.failed) return "failed";
  if (a.done) return "ready";
  if (a.building) return "building…";
  if (!a.loaded) return "waiting…";
  return a.total ? `${mb(a.loaded)} / ${mb(a.total)} MB` : `${mb(a.loaded)} MB`;
}

function renderLoading() {
  let loaded = 0;
  let total = 0;
  for (const a of Object.values(assets)) {
    // a finished/failed asset counts as complete even if its size was unknown
    const size = a.total || a.loaded;
    total += size;
    loaded += a.done || a.failed ? size : Math.min(a.loaded, size);
  }

  const allDone = Object.values(assets).every((a) => a.done || a.failed);
  // stay below 100% until the model is actually built and on screen
  let pct = total ? Math.floor((loaded / total) * 100) : 0;
  pct = allDone ? 100 : Math.min(pct, 99);

  loadingUI.fill.style.width = `${pct}%`;
  loadingUI.text.innerText = assets.model.building && !assets.model.done
    ? `Building world ${pct}%`
    : `Loading ${pct}%`;

  for (const [key, row] of Object.entries(loadingUI.rows)) {
    const a = assets[key];
    row.querySelector(".val").innerText = assetStatus(a);
    row.classList.toggle("done", a.done);
    row.classList.toggle("failed", a.failed);
  }

  if (assets.model.failed) {
    loadingUI.text.innerText = "The road could not be loaded. Refresh to try again.";
    return;
  }

  if (allDone) showEnterScreen();
}

let enterShown = false;
function showEnterScreen() {
  if (enterShown) return;
  enterShown = true;
  setTimeout(() => {
    $("loading").style.display = "none";
    $("info").style.display = "grid";
  }, 300);
}

/* ------------------------------------------------------------------ */
/* Renderer / scene                                                    */
/* ------------------------------------------------------------------ */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap DPR: 3x screens cost 2.25x the pixels for no visible gain
renderer.setSize(window.innerWidth, window.innerHeight);
$("canvas").appendChild(renderer.domElement);

const scene = new THREE.Scene();

// tighter near/far range = far better depth precision (less z-fighting)
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(7, 2, 0);

const spotLight = new THREE.SpotLight("white");
spotLight.power = 320;
spotLight.distance = 28;
spotLight.angle = Math.PI / 2;
spotLight.position.set(7, 2, 0);
scene.add(spotLight);

/* ------------------------------------------------------------------ */
/* Camera look direction (driven by face tracking)                     */
/* ------------------------------------------------------------------ */

const POSES = {
  front: { x: -20, y: 2, z: 0, duration: 3 },
  down: { x: 0, y: 0, z: 0, duration: 1 },
  right: { x: 3, y: 1.5, z: -3, duration: 1 },
  left: { x: 3, y: 1.5, z: 3, duration: 1 },
};
// Teachable Machine class order: front, up, right, down, left ("up" also looks to the front)
const CLASS_TO_POSE = ["front", "front", "right", "down", "left"];

const lookAtTarget = { x: POSES.front.x, y: POSES.front.y, z: POSES.front.z };
let currentPose = "front";

function lookTowards(poseName) {
  if (poseName === currentPose) return; // don't restart the tween every frame
  currentPose = poseName;
  const { duration, ...target } = POSES[poseName];
  gsap.to(lookAtTarget, { ...target, duration, overwrite: true });
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
dracoLoader.preload(); // fetch the decoder while the model downloads

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let model1;
let model2;

gltfLoader.load(
  MODEL_PATH,
  (gltf) => {
    model1 = gltf.scene;
    model1.scale.set(0.5, 0.5, 0.5);
    model1.position.set(0, 0, 0);
    scene.add(model1);

    // second copy shares geometry & materials, so it costs no extra download or GPU memory
    model2 = model1.clone();
    model2.position.set(-ROAD_END, 0, 0);
    scene.add(model2);

    // compile shaders now, so there's no stutter when the scene first appears
    renderer.compile(scene, camera);
    dracoLoader.dispose(); // free the decoder worker, it's no longer needed

    startRoad();
    assets.model.done = true;
    renderLoading();
  },
  (event) => {
    assets.model.loaded = event.loaded;
    assets.model.total = event.total || assets.model.total;
    if (event.total && event.loaded >= event.total) assets.model.building = true;
    renderLoading();
  },
  (error) => {
    console.error("Failed to load model:", error);
    assets.model.failed = true;
    renderLoading();
  }
);

// Music: fetched with progress so the loading screen can show it, then played from memory
const audio = new Audio();
audio.volume = 0.2;
audio.loop = true;

async function loadMusic() {
  try {
    const res = await fetch(MUSIC_PATH);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    assets.music.total = Number(res.headers.get("Content-Length")) || 0;

    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      assets.music.loaded += value.length;
      renderLoading();
    }
    audio.src = URL.createObjectURL(new Blob(chunks, { type: "audio/mpeg" }));
    assets.music.done = true;
  } catch (error) {
    // music is optional: fall back to streaming it, never block the experience
    console.warn("Music preload failed, streaming instead:", error);
    audio.src = MUSIC_PATH;
    assets.music.failed = true;
  }
  renderLoading();
}
loadMusic();
renderLoading();

/* ------------------------------------------------------------------ */
/* Endless road animation                                              */
/* ------------------------------------------------------------------ */

function loopRoad(target, firstDuration) {
  const fullLoop = () =>
    gsap.fromTo(target.position, { x: -ROAD_END }, { x: ROAD_END, duration: 20, ease: "none", repeat: -1 });

  if (firstDuration) {
    gsap.to(target.position, { x: ROAD_END, duration: firstDuration, ease: "none", onComplete: fullLoop });
  } else {
    fullLoop();
  }
}

function startRoad() {
  loopRoad(model1, 10); // starts mid-way (x = 0), so its first pass is half as long
  loopRoad(model2);
}

/* ------------------------------------------------------------------ */
/* Render loop                                                         */
/* ------------------------------------------------------------------ */

renderer.setAnimationLoop(() => {
  camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------------ */
/* Face tracking                                                       */
/* ------------------------------------------------------------------ */

let poseModel = null; // cached after the first load
let webcam = null;
let tracking = false;
let trackingBusy = false;
let lastPredict = 0;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePoseModel() {
  if (poseModel) return poseModel;
  if (!window.tmPose) {
    for (const src of TRACKING_SCRIPTS) await loadScript(src); // order matters: tf first
  }
  poseModel = await tmPose.load(TM_MODEL_URL + "model.json", TM_MODEL_URL + "metadata.json");
  return poseModel;
}

async function trackingLoop(timestamp) {
  if (!tracking) return;
  webcam.update();
  if (timestamp - lastPredict >= PREDICT_INTERVAL_MS) {
    lastPredict = timestamp;
    await predict();
  }
  if (tracking) requestAnimationFrame(trackingLoop);
}

async function predict() {
  const { posenetOutput } = await poseModel.estimatePose(webcam.canvas);
  const prediction = await poseModel.predict(posenetOutput);
  const best = prediction.findIndex((p) => p.probability > 0.9);
  if (best !== -1) lookTowards(CLASS_TO_POSE[best]);
}

function setTrackingUI(label, active) {
  $("trackingP").innerText = label;
  $("tracking").style.opacity = active ? "1" : ".5";
}

async function startTracking() {
  setTrackingUI("...", true);
  await ensurePoseModel();
  webcam = new tmPose.Webcam(200, 200, true); // width, height, flip
  await webcam.setup(); // asks for camera permission
  await webcam.play();
  tracking = true;
  setTrackingUI("ON", true);
  requestAnimationFrame(trackingLoop);
}

async function stopTracking() {
  tracking = false;
  setTrackingUI("OFF", false);
  if (webcam) await webcam.stop();
  webcam = null;
  lookTowards("front");
}

$("tracking").addEventListener("click", async () => {
  if (trackingBusy) return; // ignore clicks while the camera/model is starting
  trackingBusy = true;
  try {
    if (tracking) await stopTracking();
    else await startTracking();
  } catch (error) {
    console.error("Face tracking unavailable:", error);
    tracking = false;
    if (webcam) webcam.stop();
    webcam = null;
    setTrackingUI("OFF", false);
  } finally {
    trackingBusy = false;
  }
});

/* ------------------------------------------------------------------ */
/* Sound + enter                                                       */
/* ------------------------------------------------------------------ */

let soundOn = true;
$("vol").addEventListener("click", () => {
  soundOn = !soundOn;
  $("volP").innerText = soundOn ? "ON" : "OFF";
  $("vol").style.opacity = soundOn ? "1" : ".5";
  if (soundOn) audio.play().catch(() => {});
  else audio.pause();
});

$("enter").addEventListener("click", () => {
  $("loadingCont").style.opacity = "0";
  if (soundOn) audio.play().catch(() => {});
  setTimeout(() => {
    $("loadingCont").style.display = "none";
    $("helpBtn").style.display = "block";
  }, 500);
});

// Mute while the tab is hidden or the window isn't focused; unmute on return.
// Uses `muted` (not pause) so it never fights the user's own sound ON/OFF toggle.
function syncFocusMute() {
  audio.muted = document.hidden || !document.hasFocus();
}
document.addEventListener("visibilitychange", syncFocusMute);
window.addEventListener("blur", syncFocusMute);
window.addEventListener("focus", syncFocusMute);

/* ------------------------------------------------------------------ */
/* Info overlay                                                        */
/* ------------------------------------------------------------------ */

function setHelpOpen(open) {
  $("help").classList.toggle("open", open);
  $("help").setAttribute("aria-hidden", String(!open));
}
$("helpBtn").addEventListener("click", () => setHelpOpen(true));
$("helpClose").addEventListener("click", () => setHelpOpen(false));
// click on the dark backdrop (outside the text) also closes it
$("help").addEventListener("click", (e) => {
  if (e.target === $("help")) setHelpOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setHelpOpen(false);
});
