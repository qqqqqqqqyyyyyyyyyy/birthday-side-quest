"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type MicStatus = "idle" | "listening" | "denied";
type ArMode = "webxr" | "camera" | "preview" | null;
type ArPhase = "intro" | "scanning" | "placed" | "lit" | "out";

type Runtime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cake: THREE.Group;
  flames: THREE.Object3D[];
  flameLights: THREE.PointLight[];
  reticle?: THREE.Mesh;
  session?: XRSession;
  hitTestSource?: XRHitTestSource;
  referenceSpace?: XRReferenceSpace;
  resize?: () => void;
};

type Props = {
  candlesOut: boolean;
  micStatus: MicStatus;
  onStartMicrophone: () => Promise<void>;
  onExtinguish: () => void;
  onContinue: () => void;
};

function buildCake() {
  const cake = new THREE.Group();
  const flames: THREE.Object3D[] = [];
  const flameLights: THREE.PointLight[] = [];

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.85, 1.95, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x72d6c9, roughness: 0.45 }),
  );
  plate.position.y = 0.06;
  plate.receiveShadow = true;
  cake.add(plate);

  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.48, 0.78, 48),
    new THREE.MeshStandardMaterial({ color: 0xc96750, roughness: 0.68 }),
  );
  lower.position.y = 0.5;
  lower.castShadow = true;
  cake.add(lower);

  const creamBand = new THREE.Mesh(
    new THREE.CylinderGeometry(1.47, 1.47, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.5 }),
  );
  creamBand.position.y = 0.86;
  cake.add(creamBand);

  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(1.34, 1.43, 0.72, 48),
    new THREE.MeshStandardMaterial({ color: 0xdd8667, roughness: 0.64 }),
  );
  upper.position.y = 1.25;
  upper.castShadow = true;
  cake.add(upper);

  const frosting = new THREE.Mesh(
    new THREE.CylinderGeometry(1.38, 1.34, 0.22, 48),
    new THREE.MeshStandardMaterial({ color: 0xf5eee2, roughness: 0.54 }),
  );
  frosting.position.y = 1.7;
  frosting.castShadow = true;
  cake.add(frosting);

  [-0.78, 0, 0.78].forEach((x, index) => {
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.68, 20),
      new THREE.MeshStandardMaterial({
        color: index === 1 ? 0xffd166 : 0xff7b54,
        roughness: 0.42,
      }),
    );
    candle.position.set(x, 2.09, 0);
    candle.castShadow = true;
    cake.add(candle);

    const flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff7b00,
      emissiveIntensity: 2.4,
      roughness: 0.25,
    });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 16),
      flameMaterial,
    );
    flame.scale.set(0.72, 1.45, 0.72);
    flame.position.set(x, 2.55, 0);
    flame.visible = false;
    cake.add(flame);
    flames.push(flame);

    const flameLight = new THREE.PointLight(0xffb347, 0, 2.2, 2);
    flameLight.position.set(x, 2.52, 0.15);
    cake.add(flameLight);
    flameLights.push(flameLight);
  });

  cake.visible = false;
  return { cake, flames, flameLights };
}

function createRuntime(container: HTMLDivElement): Runtime {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.01,
    100,
  );

  scene.add(new THREE.HemisphereLight(0xf5eee2, 0x102d35, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(2.5, 6, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const { cake, flames, flameLights } = buildCake();
  scene.add(cake);

  return { renderer, scene, camera, cake, flames, flameLights };
}

export function ArCakeExperience({
  candlesOut,
  micStatus,
  onStartMicrophone,
  onExtinguish,
  onContinue,
}: Props) {
  const [localPhase, setPhase] = useState<ArPhase>("intro");
  const [mode, setMode] = useState<ArMode>(null);
  const [support, setSupport] = useState<"checking" | "webxr" | "fallback">(
    "checking",
  );
  const [surfaceFound, setSurfaceFound] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const surfaceFoundRef = useRef(false);
  const phase: ArPhase = candlesOut ? "out" : localPhase;
  const publicAssetPath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    let active = true;
    const checkSupport = async () => {
      try {
        const supported = Boolean(
          navigator.xr &&
            (await navigator.xr.isSessionSupported("immersive-ar")),
        );
        if (active) setSupport(supported ? "webxr" : "fallback");
      } catch {
        if (active) setSupport("fallback");
      }
    };
    void checkSupport();
    return () => {
      active = false;
      releaseRuntime();
    };
  }, []);

  useEffect(() => {
    if (!candlesOut) return;
    runtimeRef.current?.flames.forEach((flame) => {
      flame.visible = false;
    });
    runtimeRef.current?.flameLights.forEach((light) => {
      light.intensity = 0;
    });
  }, [candlesOut]);

  function releaseRuntime(endSession = true) {
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (runtime) {
      runtime.renderer.setAnimationLoop(null);
      runtime.hitTestSource?.cancel();
      if (endSession && runtime.session) {
        void runtime.session.end().catch(() => undefined);
      }
      if (runtime.resize) window.removeEventListener("resize", runtime.resize);
      runtime.renderer.dispose();
      runtime.renderer.domElement.remove();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function resetExperience() {
    releaseRuntime();
    setMode(null);
    setPhase("intro");
    setSurfaceFound(false);
    surfaceFoundRef.current = false;
    setCameraError(false);
  }

  async function startExperience() {
    setCameraError(false);
    if (support === "webxr") {
      try {
        await startWebXR();
        return;
      } catch {
        releaseRuntime();
      }
    }
    await startCameraMode();
  }

  async function startWebXR() {
    if (!navigator.xr || !overlayRef.current || !canvasHostRef.current) {
      throw new Error("WebXR unavailable");
    }

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: overlayRef.current },
    });

    const sessionWithOverlay = session as XRSession & {
      domOverlayState?: { type: string };
    };
    if (!sessionWithOverlay.domOverlayState) {
      await session.end();
      throw new Error("DOM overlay unavailable");
    }

    const runtime = createRuntime(canvasHostRef.current);
    runtime.session = session;
    runtime.renderer.xr.enabled = true;
    runtime.renderer.xr.setReferenceSpaceType("local");
    await runtime.renderer.xr.setSession(session);

    const referenceSpace = await session.requestReferenceSpace("local");
    const viewerSpace = await session.requestReferenceSpace("viewer");
    if (!session.requestHitTestSource) {
      throw new Error("Hit test unavailable");
    }
    const hitTestSource = await session.requestHitTestSource({
      space: viewerSpace,
    });
    if (!hitTestSource) throw new Error("Hit test unavailable");
    runtime.referenceSpace = referenceSpace;
    runtime.hitTestSource = hitTestSource;

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.095, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.92,
      }),
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    runtime.reticle = reticle;
    runtime.scene.add(reticle);
    runtimeRef.current = runtime;

    setMode("webxr");
    setPhase("scanning");
    setSurfaceFound(false);
    surfaceFoundRef.current = false;

    session.addEventListener("end", () => {
      if (runtimeRef.current?.session !== session) return;
      releaseRuntime(false);
      setMode(null);
      setPhase("intro");
      setSurfaceFound(false);
    });

    runtime.renderer.setAnimationLoop((_time, frame) => {
      if (frame && runtime.hitTestSource && runtime.referenceSpace) {
        const results = frame.getHitTestResults(runtime.hitTestSource);
        if (results.length > 0 && !runtime.cake.visible) {
          const pose = results[0].getPose(runtime.referenceSpace);
          if (pose) {
            reticle.visible = true;
            reticle.matrix.fromArray(pose.transform.matrix);
            if (!surfaceFoundRef.current) {
              surfaceFoundRef.current = true;
              setSurfaceFound(true);
            }
          }
        } else if (!runtime.cake.visible) {
          reticle.visible = false;
        }
      }
      runtime.renderer.render(runtime.scene, runtime.camera);
    });
  }

  async function startCameraMode() {
    if (!canvasHostRef.current) return;

    let cameraAvailable = false;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        cameraAvailable = true;
      }
    } catch {
      setCameraError(true);
    }

    const runtime = createRuntime(canvasHostRef.current);
    runtime.camera.position.set(0, 2.35, 6.4);
    runtime.camera.lookAt(0, 0.75, 0);
    runtime.cake.position.set(0, -0.72, 0);
    runtime.cake.rotation.y = -0.18;
    runtime.cake.scale.setScalar(0.82);

    const resize = () => {
      runtime.camera.aspect = window.innerWidth / window.innerHeight;
      runtime.camera.updateProjectionMatrix();
      runtime.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    runtime.resize = resize;
    window.addEventListener("resize", resize);
    runtimeRef.current = runtime;
    runtime.renderer.setAnimationLoop((time) => {
      if (runtime.cake.visible) {
        runtime.cake.rotation.y = -0.18 + Math.sin(time / 1800) * 0.035;
      }
      runtime.renderer.render(runtime.scene, runtime.camera);
    });

    setMode(cameraAvailable ? "camera" : "preview");
    setPhase("scanning");
    setSurfaceFound(true);
    surfaceFoundRef.current = true;
  }

  function placeCake() {
    const runtime = runtimeRef.current;
    if (!runtime || !surfaceFound) return;

    if (mode === "webxr" && runtime.reticle) {
      runtime.reticle.matrix.decompose(
        runtime.cake.position,
        runtime.cake.quaternion,
        runtime.cake.scale,
      );
      runtime.cake.scale.setScalar(0.12);
      runtime.reticle.visible = false;
    }
    runtime.cake.visible = true;
    setPhase("placed");
  }

  function lightCandles() {
    runtimeRef.current?.flames.forEach((flame) => {
      flame.visible = true;
    });
    runtimeRef.current?.flameLights.forEach((light) => {
      light.intensity = 1.8;
    });
    setPhase("lit");
  }

  function continueToLetter() {
    releaseRuntime();
    onContinue();
  }

  const active = phase !== "intro";

  return (
    <section
      ref={overlayRef}
      className={`scene cake-scene ar-experience ${active ? "ar-active" : ""}`}
      aria-labelledby="cake-title"
    >
      <video
        ref={videoRef}
        className={`ar-camera ${mode === "camera" ? "visible" : ""}`}
        muted
        playsInline
        hidden={!active}
        aria-hidden="true"
      />
      <div
        ref={canvasHostRef}
        className="ar-canvas"
        hidden={!active}
        aria-hidden="true"
      />
      <div className="ar-shade" hidden={!active} aria-hidden="true" />
      {active && phase === "scanning" && mode !== "webxr" && (
        <div className="screen-reticle" aria-hidden="true">
          <i />
        </div>
      )}

      <button
        className={`ar-close ${active ? "visible" : ""}`}
        type="button"
        onClick={resetExperience}
        aria-label="退出 AR"
      >
        ×
      </button>

      {!active ? (
        <div className="ar-intro">
          <div className="eyebrow">任务 02 · AR 生日现场</div>
          <h2 id="cake-title">把蛋糕送进现实</h2>
          <p className="scene-copy">
            把手机对准桌面或地面。找到平坦区域后，把虚拟蛋糕稳稳放下。
          </p>
          <div className="ar-preview-card" aria-hidden="true">
            <div className="ar-preview-phone">
              <span className="preview-surface" />
              {/* Static asset is already optimized for the GitHub Pages preview. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="preview-cake"
                src={`${publicAssetPath}/ar-preview-chocolate-cake.jpg`}
                alt=""
              />
              <span className="preview-ring" />
            </div>
            <div className="preview-ray" />
          </div>
          <div className="ar-compatibility">
            <span className={`compat-dot ${support}`} />
            {support === "checking" && "正在检测 AR 能力…"}
            {support === "webxr" && "支持真实平面追踪"}
            {support === "fallback" && "将使用兼容相机模式"}
          </div>
          <button
            className="primary-button ar-start"
            type="button"
            onClick={startExperience}
            disabled={support === "checking"}
          >
            开启相机，寻找平面 <span>→</span>
          </button>
          <p className="permission-note">
            相机画面只在你的手机上处理，不会上传。
          </p>
        </div>
      ) : (
        <div className="ar-ui">
          <div className="ar-guide">
            <span>{mode === "webxr" ? "LIVE · PLANE TRACKING" : "LIVE · CAMERA AR"}</span>
            <strong>
              {phase === "scanning" &&
                (surfaceFound ? "平面已找到，蛋糕可以送达" : "缓慢移动手机，寻找平坦表面")}
              {phase === "placed" && "蛋糕已送达，下一步点亮蜡烛"}
              {phase === "lit" && "蜡烛亮了，现在对着手机吹气"}
              {phase === "out" && "愿望已接收"}
            </strong>
          </div>

          <div className="ar-bottom-panel">
            {cameraError && (
              <p className="ar-warning">相机未授权，已进入 3D 预览模式，流程仍可继续。</p>
            )}
            {phase === "scanning" && (
              <button
                className="ar-action-button"
                type="button"
                onClick={placeCake}
                disabled={!surfaceFound}
              >
                <span className="action-icon">⌄</span>
                蛋糕已送达
              </button>
            )}
            {phase === "placed" && (
              <button className="ar-action-button warm" type="button" onClick={lightCandles}>
                <span className="action-icon">✦</span>
                点亮蜡烛
              </button>
            )}
            {phase === "lit" && (
              <div className="ar-blow-actions">
                <button
                  className="ar-action-button warm"
                  type="button"
                  onClick={onStartMicrophone}
                  disabled={micStatus === "listening"}
                >
                  <span className="action-icon">◉</span>
                  {micStatus === "listening" ? "正在听你吹气…" : "开启麦克风吹气"}
                </button>
                <button className="ar-text-button" type="button" onClick={onExtinguish}>
                  麦克风不可用？轻触吹灭
                </button>
              </div>
            )}
            {phase === "out" && (
              <button className="ar-action-button" type="button" onClick={continueToLetter}>
                <span className="action-icon">✓</span>
                查看最后一份礼物
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
