"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type MicStatus = "idle" | "listening" | "denied" | "timeout";
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
  onBack: () => void;
  onContinue: () => void;
};

function buildCake() {
  const cake = new THREE.Group();
  const flames: THREE.Object3D[] = [];
  const flameLights: THREE.PointLight[] = [];

  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd6a84a,
    metalness: 0.72,
    roughness: 0.24,
    clearcoat: 0.7,
  });
  const chocolateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4a1f19,
    roughness: 0.46,
    clearcoat: 0.22,
  });
  const ganacheMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x24100e,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.68, 1.76, 0.1, 64),
    goldMaterial,
  );
  plate.position.y = 0.05;
  plate.receiveShadow = true;
  cake.add(plate);

  const plateTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.56, 1.62, 0.035, 64),
    new THREE.MeshPhysicalMaterial({
      color: 0xf2d78e,
      metalness: 0.58,
      roughness: 0.28,
    }),
  );
  plateTop.position.y = 0.115;
  cake.add(plateTop);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.27, 1.34, 1.05, 64),
    chocolateMaterial,
  );
  body.position.y = 0.67;
  body.castShadow = true;
  cake.add(body);

  const crumbRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.09, 12, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.92 }),
  );
  crumbRing.rotation.x = Math.PI / 2;
  crumbRing.position.y = 0.2;
  cake.add(crumbRing);

  const ganache = new THREE.Mesh(
    new THREE.CylinderGeometry(1.32, 1.28, 0.18, 64),
    ganacheMaterial,
  );
  ganache.position.y = 1.25;
  ganache.castShadow = true;
  cake.add(ganache);

  [
    [0, 0.36],
    [0.48, 0.24],
    [-0.55, 0.42],
    [1.02, 0.28],
    [-1.08, 0.2],
    [2.72, 0.3],
  ].forEach(([angle, length]) => {
    const drip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, length, 18),
      ganacheMaterial,
    );
    drip.position.set(
      Math.sin(angle) * 1.285,
      1.18 - length / 2,
      Math.cos(angle) * 1.285,
    );
    drip.castShadow = true;
    cake.add(drip);

    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 18, 12),
      ganacheMaterial,
    );
    drop.scale.y = 1.18;
    drop.position.set(drip.position.x, 1.17 - length, drip.position.z);
    cake.add(drop);
  });

  const blueberryGeometry = new THREE.SphereGeometry(0.18, 22, 16);
  const blueberryMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x17243f,
    roughness: 0.36,
    clearcoat: 0.32,
  });
  [
    [-0.63, 1.45, 0.22],
    [-0.32, 1.5, 0.47],
    [0.55, 1.47, 0.3],
  ].forEach(([x, y, z]) => {
    const berry = new THREE.Mesh(blueberryGeometry, blueberryMaterial);
    berry.position.set(x, y, z);
    berry.castShadow = true;
    cake.add(berry);
  });

  const raspberryGeometry = new THREE.IcosahedronGeometry(0.23, 2);
  const raspberryMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb70f32,
    roughness: 0.5,
    clearcoat: 0.18,
  });
  [
    [-0.1, 1.53, 0.28],
    [0.28, 1.51, 0.5],
  ].forEach(([x, y, z]) => {
    const berry = new THREE.Mesh(raspberryGeometry, raspberryMaterial);
    berry.position.set(x, y, z);
    berry.rotation.set(0.2, 0.4, -0.15);
    berry.castShadow = true;
    cake.add(berry);
  });

  const mintMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3d7c45,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  [
    [0.08, 1.56, 0.02, -0.7],
    [0.34, 1.57, 0.04, 0.48],
  ].forEach(([x, y, z, rotation]) => {
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 10),
      mintMaterial,
    );
    leaf.scale.set(0.7, 0.08, 1.35);
    leaf.rotation.set(0.14, rotation, -0.18);
    leaf.position.set(x, y, z);
    cake.add(leaf);
  });

  const goldShard = new THREE.Mesh(
    new THREE.ConeGeometry(0.31, 0.62, 3),
    goldMaterial,
  );
  goldShard.position.set(0.72, 1.53, 0.05);
  goldShard.rotation.set(0.12, -0.42, -0.3);
  cake.add(goldShard);

  [
    [-0.76, -0.42],
    [-0.25, -0.54],
    [0.25, -0.54],
    [0.76, -0.42],
  ].forEach(([x, z], index) => {
    const candleMaterial = new THREE.MeshPhysicalMaterial({
      color: index % 2 === 0 ? 0xf5eee2 : 0xe8c36a,
      roughness: 0.38,
      clearcoat: 0.2,
    });
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.58, 20),
      candleMaterial,
    );
    candle.position.set(x, 1.63, z);
    candle.castShadow = true;
    cake.add(candle);

    [1.47, 1.65, 1.81].forEach((y) => {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.061, 0.012, 8, 18),
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? 0xd6a84a : 0xf5eee2,
          metalness: index % 2 === 0 ? 0.55 : 0,
          roughness: 0.35,
        }),
      );
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(x, y, z);
      cake.add(stripe);
    });

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
      new THREE.MeshStandardMaterial({ color: 0x261714, roughness: 1 }),
    );
    wick.position.set(x, 1.965, z);
    cake.add(wick);

    const flameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffe5a3,
      emissive: 0xff6a00,
      emissiveIntensity: 3.2,
      roughness: 0.25,
      transparent: true,
      opacity: 0.96,
    });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 20, 16),
      flameMaterial,
    );
    flame.scale.set(0.66, 1.55, 0.66);
    flame.position.set(x, 2.08, z);
    flame.visible = false;
    cake.add(flame);
    flames.push(flame);

    const flameLight = new THREE.PointLight(0xffa13b, 0, 1.9, 2);
    flameLight.position.set(x, 2.05, z + 0.08);
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
  onBack,
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

  function leaveArPage() {
    releaseRuntime();
    onBack();
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
        onClick={leaveArPage}
        aria-label="返回上一页"
      >
        <span aria-hidden="true">←</span> 返回
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
                  onClick={micStatus === "listening" ? onExtinguish : onStartMicrophone}
                >
                  <span className="action-icon">◉</span>
                  {micStatus === "listening"
                    ? "正在听你吹气… 点击也能吹灭"
                    : micStatus === "timeout"
                      ? "再试一次吹气"
                      : micStatus === "denied"
                        ? "再试一次麦克风"
                        : "开启麦克风吹气"}
                </button>
                <button className="ar-manual-button" type="button" onClick={onExtinguish}>
                  {micStatus === "listening"
                    ? "没反应？点这里直接吹灭"
                    : micStatus === "timeout"
                      ? "没有检测到？直接吹灭蜡烛"
                      : micStatus === "denied"
                        ? "麦克风不可用，直接吹灭蜡烛"
                        : "不方便吹气？点这里吹灭"}
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
