const container = document.getElementById("container");
let clock = new THREE.Clock();
const gui = new dat.GUI();
let devicePixelRatio = window.devicePixelRatio || 1;

let scene, camera, renderer, material;
let settings = { fps: 30, scale: 1.0, parallaxVal: 1 };
let videoElement;

// Clock parameters
let USE_12_HOURS = false;
let SHOW_SECONDS = true;
let NUMBER_SEPARATOR = ":";
let ANIMATION_DURATION = 400;

// Clock symbols
let SYMBOLS_ELEMENTS = null;

const getElementSymbol = (element) => {
  return window.getComputedStyle(element).getPropertyValue("--symb").slice(1, -1);
};

const setElementSymbol = (element, newSymbol, replaceAnyway) => {
  const oldSymbol = getElementSymbol(element);
  const newSymbolLength = newSymbol.length;

  if (replaceAnyway || oldSymbol !== newSymbol) {
    newSymbol = `"${newSymbol}"`;
    element.style.setProperty("--next-symb", newSymbol);
    element.classList.add("transition");
    setTimeout(() => {
      element.style.setProperty("--symb", newSymbol);
      element.classList.remove("transition");
      element.style.setProperty("--next-symb", `"${new Array(newSymbolLength).fill("-").join("")}"`);
    }, ANIMATION_DURATION);
  }
};

const getAmPmModHour = (hour) => {
  return hour % 12 || 12;
};

const getCurrentTimeSymbols = () => {
  const now = new Date();

  let hour = now.getHours();
  const isPastTwelve = hour >= 12;
  if (USE_12_HOURS) {
    hour = getAmPmModHour(hour);
  }
  const hourTen = Math.floor(hour / 10);
  const hourOne = hour % 10;

  const mins = now.getMinutes();
  const minsTen = Math.floor(mins / 10);
  const minsOne = mins % 10;

  const secs = now.getSeconds();
  const secsTen = Math.floor(secs / 10);
  const secsOne = secs % 10;

  let timeArray = [hourTen, hourOne, NUMBER_SEPARATOR, minsTen, minsOne];

  if (SHOW_SECONDS) {
    timeArray = timeArray.concat([NUMBER_SEPARATOR, secsTen, secsOne]);
  }

  if (USE_12_HOURS) {
    const amPmPostfix = " " + (isPastTwelve ? "PM" : "AM");
    timeArray = timeArray.concat(Array.from(amPmPostfix));

    if (hourTen === 0) {
      timeArray = timeArray.slice(1);
    }
  }

  return timeArray.map((val) => String(val));
};

const initSymbols = (numberOfElements) => {
  const SYMBOLS_ELEMENT = document.getElementsByClassName("symbols")[0];
  let currentLength = SYMBOLS_ELEMENT.children.length;
  let diff = numberOfElements - currentLength;
  if (diff > 0) {
    new Array(diff).fill(null).forEach(() => SYMBOLS_ELEMENT.appendChild(document.createElement("div")));
  }
  if (diff < 0) {
    Array.from(SYMBOLS_ELEMENT.children)
      .slice(diff)
      .forEach((elem) => SYMBOLS_ELEMENT.removeChild(elem));
  }
  SYMBOLS_ELEMENTS = SYMBOLS_ELEMENT.children;
};

const setCurrentTime = (simultaneously) => {
  const values = getCurrentTimeSymbols();

  if (SYMBOLS_ELEMENTS.length !== values.length) {
    initSymbols(values.length);
  }

  const REVERSED_SYMBOLS_ELEMENTS = Array.from(SYMBOLS_ELEMENTS).reverse();
  const TIMEOUT_INCREMENTOR = simultaneously ? 0 : Math.floor(ANIMATION_DURATION / 4);
  let timeout = 0;

  values.reverse().map((val, i) => {
    setTimeout(setElementSymbol, timeout, REVERSED_SYMBOLS_ELEMENTS[i], val);
    timeout += TIMEOUT_INCREMENTOR;
  });
};

//custom events
const sceneLoadedEvent = new Event("sceneLoaded");

async function init() {
  renderer = new THREE.WebGLRenderer({
    antialias: false,
  });

  SYMBOLS_ELEMENTS = document.getElementsByClassName('symbols')[0].children;

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(settings.scale * devicePixelRatio);
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  material = new THREE.ShaderMaterial({
    uniforms: {
      u_tex0: { type: "t" },
      u_time: { value: 0, type: "f" },
      u_intensity: { value: 0.4, type: "f" },
      u_speed: { value: 0.25, type: "f" },
      u_brightness: { value: 0.8, type: "f" },
      u_normal: { value: 0.5, type: "f" },
      u_zoom: { value: 2.61, type: "f" },
      u_blur_intensity: { value: 0.5, type: "f" },
      u_blur_iterations: { value: 16, type: "i" },
      u_panning: { value: false, type: "b" },
      u_post_processing: { value: true, type: "b" },
      u_lightning: { value: false, type: "b" },
      u_texture_fill: { value: true, type: "b" },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
      u_tex0_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight), type: "v2" },
    },
    vertexShader: `
          varying vec2 vUv;        
          void main() {
              vUv = uv;
              gl_Position = vec4( position, 1.0 );    
          }
        `,
  });
  material.fragmentShader = await (await fetch("shaders/rain.frag")).text();
  resize();

  // material.uniforms.u_tex0_resolution.value = new THREE.Vector2(1920, 1080);
  // material.uniforms.u_tex0.value = await new THREE.TextureLoader().loadAsync("assets/temp_background.webp");

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), material);
  scene.add(quad);
  resize();

  // Initialize clock after scene is set up
  setCurrentTime(true); // initializes the clock
  setInterval(() => setCurrentTime(true), 1000); // Update clock every second

  window.addEventListener("resize", (e) => resize());
  render();
  
  datUI();


  document.dispatchEvent(sceneLoadedEvent);
}

function setScale(userScale) {
  settings.scale = userScale;
  const finalScale = devicePixelRatio * settings.scale;
  if (renderer.getPixelRatio() == finalScale)
    return;

  renderer.setPixelRatio(finalScale);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function resize() {
  if (window.devicePixelRatio !== devicePixelRatio) {
    devicePixelRatio = window.devicePixelRatio || 1;
    setScale(settings.scale);
  }
  const finalScale = devicePixelRatio * settings.scale;

  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.u_resolution.value = new THREE.Vector2(
    window.innerWidth * finalScale,
    window.innerHeight * finalScale
  );
}

function render() {
  setTimeout(function () {
    requestAnimationFrame(render);
  }, 1000 / settings.fps);

  //reset every 6hr
  if (clock.getElapsedTime() > 21600) clock = new THREE.Clock();
  material.uniforms.u_time.value = clock.getElapsedTime();

  renderer.render(scene, camera);
 
}


init();

//lively api
//docs: https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction
function livelyPropertyListener(name, val) {
  switch (name) {
    case "blurIntensity":
      material.uniforms.u_blur_intensity.value = val / 100;
      break;
    case "blurQuality":
      material.uniforms.u_blur_iterations.value = [1, 16, 32, 64][val];
      break;
    case "rainIntensity":
      material.uniforms.u_intensity.value = val / 100;
      break;
    case "rainSpeed":
      material.uniforms.u_speed.value = val / 100;
      break;
    case "brightness":
      material.uniforms.u_brightness.value = val / 100;
      break;
    case "rainNormal":
      material.uniforms.u_normal.value = val / 100;
      break;
    case "rainZoom":
      material.uniforms.u_zoom.value = val / 100;
      break;
    case "mediaSelect":
      {
        let ext = getExtension(val);
        disposeVideoElement(videoElement);
        material.uniforms.u_tex0.value?.dispose();
        if (ext == "jpg" || ext == "jpeg" || ext == "png") {
          new THREE.TextureLoader().load(val, function (tex) {
            material.uniforms.u_tex0.value = tex;
            material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
          });
        } else if (ext == "webm") {
          videoElement = createVideoElement(val);
          let videoTexture = new THREE.VideoTexture(videoElement);
          videoElement.addEventListener(
            "loadedmetadata",
            function (e) {
              material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
                videoTexture.image.videoWidth,
                videoTexture.image.videoHeight
              );
            },
            false
          );
          material.uniforms.u_tex0.value = videoTexture;
        }
      }
      break;
    case "mediaScaling":
      material.uniforms.u_texture_fill.value = [false, true][val];
      break;
    case "animateChk":
      material.uniforms.u_panning.value = val;
      break;
    case "lightningChk":
      material.uniforms.u_lightning.value = val;
      break;
    case "postProcessingChk":
      material.uniforms.u_post_processing.value = val;
      break;
    case "parallaxIntensity":
      settings.parallaxVal = val;
      break;
    case "fpsLock":
      settings.fps = val ? 30 : 60;
      break;
    case "displayScaling":
      setScale(val);
      break;
    case "debug":
      if (val) gui.show();
      else gui.hide();
      break;
    case "clock-size-use-absolute":
        // Set the type of font size - absolute or relative.
        document.getElementsByClassName('symbols')[0].style.setProperty('--font-size', `var(--font-size-${val ? 'absolute' : 'relative'})`);
        break;
    case "clock-size-absolute":
        // Set the absolute font size of the clock symbols.
        document.getElementsByClassName('symbols')[0].style.setProperty('--font-size-absolute', `${val}pt`);
        break;
    case "clock-size-relative":
        // Set the relative font size of the clock symbols.
        document.getElementsByClassName('symbols')[0].style.setProperty('--font-size-relative', `${val}vw`);
        break;
    case "enable-am-pm":
        // Enable or disable the 12-hour format for the clock.
        USE_12_HOURS = val;
        break;
    case "show-seconds":
        // Show or hide the seconds part of the clock.
        SHOW_SECONDS = val;
        break;
    case "number-separator":
        // Set the separator character for the clock digits.
        NUMBER_SEPARATOR = val.substring(0, 1) || ':';
        break;
    case "clock-animation-speed":
        // Set the animation speed for the clock symbols.
        document.getElementsByClassName('symbols')[0].style.setProperty('--animation-duration', `${val}ms`);
        ANIMATION_DURATION = val;
        break;
  }
}

//web
function datUI() {
  let rain = gui.addFolder("Rain");
  let bg = gui.addFolder("Background");
  let perf = gui.addFolder("Performance");
  let misc = gui.addFolder("More");
  rain.open();
  bg.open();
  perf.open();
  misc.open();
  rain.add(material.uniforms.u_intensity, "value", 0, 1, 0.01).name("Intensity");
  rain.add(material.uniforms.u_speed, "value", 0, 10, 0.01).name("Speed");
  rain.add(material.uniforms.u_brightness, "value", 0, 1, 0.01).name("Brightness");
  rain.add(material.uniforms.u_normal, "value", 0, 3, 0.01).name("Normal");
  rain.add(material.uniforms.u_zoom, "value", 0.1, 3.0, 0.01).name("Zoom");
  rain.add(material.uniforms.u_lightning, "value").name("Lightning");
  // bg.add(
  //   {
  //     picker: function () {
  //       document.getElementById("filePicker").click();
  //     },
  //   },
  //   "picker"
  // ).name("Change Background");
  bg.add(material.uniforms.u_blur_iterations, "value", 1, 64, 1).name("Blur Quality");
  bg.add(material.uniforms.u_blur_intensity, "value", 0, 10, 0.01).name("Blur");
  bg.add(settings, "parallaxVal", 0, 5, 1).name("Parallax");
  bg.add(material.uniforms.u_texture_fill, "value").name("Scale to Fill");
  bg.add(material.uniforms.u_panning, "value").name("Panning");
  bg.add(material.uniforms.u_post_processing, "value").name("Post Processing");
  perf.add(settings, "fps", 15, 120, 15).name("FPS");
  let tempScale = { value: settings.scale }; //don't update global value
  perf
    .add(tempScale, "value", 0.1, 2, 0.01)
    .name("Scale")
    .onChange(function () {
      setScale(tempScale.value);
    });
  misc
    .add(
      {
        lively: function () {
          window.open("https://www.rocksdanister.com/lively");
        },
      },
      "lively"
    )
    .name("Try It On Your Desktop!");
  misc
    .add(
      {
        source: function () {
          window.open("https://github.com/rocksdanister/rain");
        },
      },
      "source"
    )
    .name("Source Code");
  gui.close();
}

document.getElementById("filePicker").addEventListener("change", function () {
  if (this.files[0] === undefined) return;
  let file = this.files[0];
  if (file.type == "image/jpg" || file.type == "image/jpeg" || file.type == "image/png") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    new THREE.TextureLoader().load(URL.createObjectURL(file), function (tex) {
      material.uniforms.u_tex0.value = tex;
      material.uniforms.u_tex0_resolution.value = new THREE.Vector2(tex.image.width, tex.image.height);
    });
  } else if (file.type == "video/mp4" || file.type == "video/webm") {
    disposeVideoElement(videoElement);
    material.uniforms.u_tex0.value?.dispose();

    videoElement = createVideoElement(URL.createObjectURL(file));
    let videoTexture = new THREE.VideoTexture(videoElement);
    videoElement.addEventListener(
      "loadedmetadata",
      function (e) {
        material.uniforms.u_tex0_resolution.value = new THREE.Vector2(
          videoTexture.image.videoWidth,
          videoTexture.image.videoHeight
        );
      },
      false
    );
    material.uniforms.u_tex0.value = videoTexture;
  }
});

//parallax
document.addEventListener("mousemove", function (event) {
  if (settings.parallaxVal == 0) return;

  const x = (window.innerWidth - event.pageX * settings.parallaxVal) / 90;
  const y = (window.innerHeight - event.pageY * settings.parallaxVal) / 90;

  container.style.transform = `translateX(${x}px) translateY(${y}px) scale(1.09)`;
});

//helpers
function getExtension(filePath) {
  return filePath.substring(filePath.lastIndexOf(".") + 1, filePath.length).toLowerCase() || filePath;
}

function createVideoElement(src) {
  let htmlVideo = document.createElement("video");
  htmlVideo.src = src;
  htmlVideo.muted = true;
  htmlVideo.loop = true;
  htmlVideo.play();
  return htmlVideo;
}

//ref: https://stackoverflow.com/questions/3258587/how-to-properly-unload-destroy-a-video-element
function disposeVideoElement(video) {
  if (video != null && video.hasAttribute("src")) {
    video.pause();
    video.removeAttribute("src"); // empty source
    video.load();
  }
}
