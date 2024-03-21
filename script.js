const URL = "https://teachablemachine.withgoogle.com/models/-0Gjf5v4x/";
let model, webcam, ctx, labelContainer, maxPredictions;
let tracking = false;
webcam = null;

async function loop(timestamp) {
  if (tracking) {
    webcam.update(); // update the webcam frame
    await predict();
    window.requestAnimationFrame(loop);
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("canvas").appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.001,
  1000000
);
camera.position.set(7, 2, 0);

// const axis = new THREE.AxesHelper(20);
// scene.add(axis);

// const orbit = new THREE.OrbitControls(camera, renderer.domElement);
// orbit.update();

// const ambientLight = new THREE.AmbientLight("white");
// scene.add(ambientLight);

const spotLight = new THREE.SpotLight("white");
spotLight.power = 320;
scene.add(spotLight);
spotLight.distance = 28;
spotLight.position.set(7, 2, 0);
spotLight.angle = Math.PI / 2;
spotLight.lookAt(0, 4, 0);

// const pLight = new THREE.PointLight("white");
// pLight.power = 30000;
// scene.add(pLight);
// // spotLight.distance = 28;
// pLight.position.set(-10, 20, 0);
// // spotLight.angle = Math.PI / 2;
// spotLight.lookAt(0, 4, 0);

const lightHolder = new THREE.Object3D(); // Create a container object

lightHolder.add(spotLight); // Add light to the container
scene.add(lightHolder); // Add container to the scene

lightHolder.rotation.z = 0; // Rotate the container (and light) around the y-axis

const loadingManager = new THREE.LoadingManager();
const loader = new THREE.GLTFLoader(loadingManager);

let model1;
loader.load("./models/3d_exp.glb", function (gltf) {
  model1 = gltf.scene;
  scene.add(model1);
  model1.scale.set(0.5, 0.5, 0.5);
  model1.position.set(0, 0, 0);
});

let model2;
loader.load("./models/3d_exp.glb", function (gltf) {
  model2 = gltf.scene;
  scene.add(model2);
  model2.scale.set(0.5, 0.5, 0.5);
  model2.position.set(-41.8, 0, 0);
});

loadingManager.onProgress = function (url, loaded, total) {
  x = Math.ceil((loaded / total) * 100);
  document.getElementById("loading").innerText = `${x}%`;
};

loadingManager.onLoad = function () {
  setTimeout(() => {
    document.getElementById("loading").style.display = "none";
    document.getElementById("info").style.display = "grid";
  }, 1000);
};

const timeStep = 1 / 60;

let tl1 = gsap.timeline();
let tl2 = gsap.timeline();

const lookAtTarget = { x: 0, y: 0, z: 0 };
const front = { x: -20, y: 2, z: 0 };
const up = { x: 0, y: 6, z: 0 };
const down = { x: 0, y: 0, z: 0 };
const right = { x: 3, y: 1.5, z: -3 };
const left = { x: 3, y: 1.5, z: 3 };

camera.lookAt(-20, 2, 0);

async function predict() {
  // Prediction #1: run input through posenet
  // estimatePose can take in an image, video or canvas html element
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  // Prediction 2: run input through teachable machine classification model
  const prediction = await model.predict(posenetOutput);

  // for (let i = 0; i < 5; i++) {
  //     const classPrediction =
  //         prediction[i].className + ": " + prediction[i].probability.toFixed(2);
  //     labelContainer.childNodes[i].innerHTML = classPrediction;
  // }

  if (prediction[0].probability.toFixed(2) > 0.9) {
    // console.log("front");
    gsap.to(lookAtTarget, {
      x: front.x,
      y: front.y,
      z: front.z,
      duration: 3,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  }
  if (prediction[1].probability.toFixed(2) > 0.9) {
    // console.log("up");
    gsap.to(lookAtTarget, {
      x: up.x,
      y: up.y,
      z: up.z,
      duration: 1,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  }
  if (prediction[2].probability.toFixed(2) > 0.9) {
    // console.log("right");
    gsap.to(lookAtTarget, {
      x: right.x,
      y: right.y,
      z: right.z,
      duration: 1,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  }
  if (prediction[3].probability.toFixed(2) > 0.9) {
    // console.log("bottom");
    gsap.to(lookAtTarget, {
      x: down.x,
      y: down.y,
      z: down.z,
      duration: 1,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  }
  if (prediction[4].probability.toFixed(2) > 0.9) {
    // console.log("left");
    gsap.to(lookAtTarget, {
      x: left.x,
      y: left.y,
      z: left.z,
      duration: 1,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  }
}

let model1Time = 10;

// setTimeout(() => {
let runFunc = false;
function run() {
  function loop1() {
    tl1.to(model1.position, {
      x: 41.8,
      y: 0,
      z: 0,
      duration: model1Time,
      ease: "none",
      onComplete: function () {
        // console.log("done");
        model1Time = 20;
        model1.position.set(-41.8, 0, 0);
        loop1();
      },
    });
  }
  loop1();

  function loop2() {
    tl2.to(model2.position, {
      x: 41.8,
      y: 0,
      z: 0,
      duration: 20,
      ease: "none",
      onComplete: function () {
        model2.position.set(-41.8, 0, 0);
        loop2();
      },
    });
  }
  loop2();
}
// }, 2000);

// setTimeout(() => {
//   function loop() {

//     tl1.to(model1.position, {
//       x: 41.8,
//       y: 0,
//       z: 0,
//       duration: 20,
//       ease: "none",
//       onComplete: function () {

//         model1.position.set(-41.8, 0, 0);
//         loop();
//       },
//     });
//   }
//   loop();
// }, 5000);

function animate() {
  if (model1 && model2 && !runFunc) {
    runFunc = true;
    run();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

window.addEventListener("resize", function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById("tracking").addEventListener("click", async () => {
  if (tracking) {
    document.getElementById("trackingP").innerText = "OFF";
    document.getElementById("tracking").style.opacity = ".5";
    tracking = false;
    await webcam.stop();
    gsap.to(lookAtTarget, {
      x: front.x,
      y: front.y,
      z: front.z,
      duration: 3,
      onUpdate: function () {
        camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z); // Update the camera's lookAt during the animation
      },
    });
  } else {
    document.getElementById("trackingP").innerText = "ON";
    document.getElementById("tracking").style.opacity = "1";
    tracking = true;
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";
    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const size = 200;
    const flip = true; // whether to flip the webcam
    webcam = new tmPose.Webcam(size, size, flip); // width, height, flip
    await webcam.setup(); // request access to the webcam
    await webcam.play();
    window.requestAnimationFrame(loop);
  }
});

let vol = true;
let audio = new Audio("./bg.mp3");
audio.volume = 0.2;
document.getElementById("vol").addEventListener("click", function () {
  if (vol) {
    vol = false;
    document.getElementById("volP").innerText = "OFF";
    document.getElementById("vol").style.opacity = ".5";
    audio.pause();
  } else {
    audio.play();
    document.getElementById("volP").innerText = "ON";
    document.getElementById("vol").style.opacity = "1";
    vol = true;
  }
});

document.getElementById("enter").addEventListener("click", function () {
  document.getElementById("loadingCont").style.opacity = "0";
  setTimeout(() => {
    audio.play();
    document.getElementById("loadingCont").style.display = "none";
  }, 500);
});
