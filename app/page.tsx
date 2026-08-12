"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";

const ArCakeExperience = dynamic(
  () =>
    import("./ArCakeExperience").then((module) => module.ArCakeExperience),
  { ssr: false },
);

const birthday = {
  recipient: "小王",
  sender: "你的朋友",
  intro: "今天有一份限时副本，只为你开放。",
  memories: [
    {
      label: "记忆碎片 01",
      title: "绝世美女",
      note: "",
      color: "coral",
      photos: [
        {
          src: "/memory-card-01-photo-01.jpg",
          alt: "古风粉色汉服人物插画",
        },
        {
          src: "/memory-card-01-photo-02.jpg",
          alt: "身着粉色古装的女孩",
        },
      ],
    },
    {
      label: "记忆碎片 02",
      title: "下凡挤地铁",
      note: "",
      color: "blue",
      photos: [
        {
          src: "/memory-card-02-photo-01.jpg",
          alt: "三位古装女孩乘坐地铁的插画",
        },
        {
          src: "/memory-card-02-photo-02.jpg",
          alt: "三位身着古装的女孩乘坐地铁",
        },
      ],
    },
    {
      label: "记忆碎片 03",
      title: "那些深夜聊天",
      note: "写下一件你一直记得、却可能从没说过的小事。",
      color: "gold",
      photos: [],
    },
    {
      label: "记忆碎片 04",
      title: "下一站，继续同行",
      note: "留给你们下一次出发，以及未来还会发生的好故事。",
      color: "mint",
      photos: [],
    },
  ],
  letter: [
    "又顺利完成了一次绕太阳旅行，恭喜。",
    "谢谢你把很多普通日子，变成了值得记住的片段。愿新的一岁，好奇心不掉线，快乐有回声，偶尔犯傻也总有人一起。",
    "这是一个还在等真实回忆填满的小宇宙——等照片和故事到位，它才算真正属于你。",
  ],
};

type Stage = "welcome" | "memories" | "cake" | "letter";

const stageOrder: Stage[] = ["welcome", "memories", "cake", "letter"];

export default function Home() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [revealed, setRevealed] = useState<number[]>([]);
  const [photoPages, setPhotoPages] = useState<number[]>(
    birthday.memories.map(() => 0),
  );
  const [soundOn, setSoundOn] = useState(true);
  const [candlesOut, setCandlesOut] = useState(false);
  const [micStatus, setMicStatus] = useState<
    "idle" | "listening" | "denied"
  >("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ cardIndex: number; x: number } | null>(null);

  const progress = stageOrder.indexOf(stage) + 1;
  const publicAssetPath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    return () => stopMicrophone();
  }, []);

  function playChime(notes: number[] = [523.25, 659.25, 783.99]) {
    if (!soundOn || typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + index * 0.09);
      gain.gain.linearRampToValueAtTime(
        0.12,
        context.currentTime + index * 0.09 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + index * 0.09 + 0.28,
      );
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + index * 0.09);
      oscillator.stop(context.currentTime + index * 0.09 + 0.3);
    });
    window.setTimeout(() => void context.close(), 900);
  }

  function goTo(next: Stage) {
    playChime();
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function revealMemory(index: number) {
    if (revealed.includes(index)) return;
    playChime([440 + index * 70]);
    setRevealed((current) => [...current, index]);
  }

  function showPhoto(cardIndex: number, photoIndex: number) {
    setPhotoPages((current) =>
      current.map((page, index) => (index === cardIndex ? photoIndex : page)),
    );
  }

  function startPhotoSwipe(cardIndex: number, clientX: number) {
    swipeStartRef.current = { cardIndex, x: clientX };
  }

  function finishPhotoSwipe(cardIndex: number, clientX: number) {
    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!swipeStart || swipeStart.cardIndex !== cardIndex) return;

    const distance = clientX - swipeStart.x;
    if (distance < -36) showPhoto(cardIndex, 1);
    if (distance > 36) showPhoto(cardIndex, 0);
  }

  function stopMicrophone() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  function extinguishCandles() {
    if (candlesOut) return;
    stopMicrophone();
    setMicStatus("idle");
    setCandlesOut(true);
    playChime([392, 523.25, 659.25, 783.99]);
  }

  async function startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("denied");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = context;
      setMicStatus("listening");

      const samples = new Uint8Array(analyser.fftSize);
      let strongFrames = 0;
      const listen = () => {
        analyser.getByteTimeDomainData(samples);
        const energy = Math.sqrt(
          samples.reduce((sum, value) => {
            const normalized = (value - 128) / 128;
            return sum + normalized * normalized;
          }, 0) / samples.length,
        );

        strongFrames = energy > 0.12 ? strongFrames + 1 : 0;
        if (strongFrames > 4) {
          extinguishCandles();
          return;
        }
        animationRef.current = requestAnimationFrame(listen);
      };
      listen();
    } catch {
      stopMicrophone();
      setMicStatus("denied");
    }
  }

  return (
    <main
      className={`site-shell stage-${stage}`}
      style={
        {
          "--starry-sky-image": `url("${publicAssetPath}/starry-sky.jpg")`,
          "--gift-image": `url("${publicAssetPath}/birthday-gift.jpg")`,
        } as CSSProperties
      }
    >
      <div className="ambient" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="star star-one">✦</span>
        <span className="star star-two">✦</span>
        <span className="star star-three">✷</span>
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          BIRTHDAY SIDE QUEST
        </div>
        <button
          className="sound-toggle"
          type="button"
          aria-pressed={soundOn}
          onClick={() => setSoundOn((current) => !current)}
        >
          {soundOn ? "声音 · 开" : "声音 · 关"}
        </button>
      </header>

      <div className="progress" aria-label={`进度 ${progress}/4`}>
        <span>0{progress}</span>
        <div className="progress-track">
          <i style={{ width: `${progress * 25}%` }} />
        </div>
        <span>04</span>
      </div>

      {stage === "welcome" && (
        <section className="scene welcome-scene" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <div className="eyebrow">仅限今日 · 单人副本</div>
            <h1 id="welcome-title">
              <span>嘿，<em>{birthday.recipient}</em></span>
              <span>
                有个任务<span className="mobile-title-break"><br /></span>等你领取
              </span>
            </h1>
            <p className="scene-copy">{birthday.intro}</p>
          </div>

          <div className="welcome-gift">
            <button
              className="gift-button"
              type="button"
              onClick={() => goTo("memories")}
              aria-label="拆开生日礼物"
            >
              <span className="gift-action-badge">轻触拆开</span>
            </button>
            <p className="microcopy">轻触礼物开始 · 全程约 2 分钟</p>
          </div>
        </section>
      )}

      {stage === "memories" && (
        <section className="scene memories-scene" aria-labelledby="memories-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">任务 01 · 找回记忆</div>
              <h2 id="memories-title">收集四根生日蜡烛</h2>
            </div>
            <div className="counter">{revealed.length} / 4</div>
          </div>
          <p className="scene-copy left-copy">
            点亮四段记忆 · 照片区域左滑可看下一张
          </p>

          <div className="memory-grid">
            {birthday.memories.map((memory, index) => {
              const isRevealed = revealed.includes(index);
              return (
                <article
                  key={memory.label}
                  className={`memory-card ${memory.color} ${index === 1 ? "square-photo-card" : ""} ${isRevealed ? "revealed" : ""}`}
                  style={{ "--tilt": `${index % 2 === 0 ? -2.5 : 2.5}deg` } as CSSProperties}
                >
                  <div
                    className="memory-photo-window"
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startPhotoSwipe(index, event.clientX);
                    }}
                    onPointerUp={(event) => finishPhotoSwipe(index, event.clientX)}
                    onPointerCancel={() => {
                      swipeStartRef.current = null;
                    }}
                  >
                    <div
                      className="memory-photo-track"
                      style={{ transform: `translateX(-${photoPages[index] * 50}%)` }}
                    >
                      {[0, 1].map((photoIndex) => {
                        const photo = memory.photos[photoIndex];
                        return photo ? (
                          // Images are already compressed and served as static GitHub Pages assets.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="memory-photo"
                            key={photo.src}
                            src={`${publicAssetPath}${photo.src}`}
                            alt={photo.alt}
                            draggable={false}
                          />
                        ) : (
                          <div
                            className="photo-placeholder"
                            key={photoIndex}
                            aria-label={`${memory.label}，照片 ${photoIndex + 1}`}
                          >
                            <span>照片 {photoIndex + 1} 待放入</span>
                          </div>
                        );
                      })}
                    </div>
                    <span className="swipe-hint" aria-hidden="true">
                      {photoPages[index] === 0 ? "左滑看下一张 ←" : "→ 右滑看上一张"}
                    </span>
                  </div>

                  <div className="photo-pagination" aria-label={`${memory.label}照片页码`}>
                    {[0, 1].map((photoIndex) => (
                      <button
                        type="button"
                        key={photoIndex}
                        className={photoPages[index] === photoIndex ? "active" : ""}
                        onClick={() => showPhoto(index, photoIndex)}
                        aria-label={`查看照片 ${photoIndex + 1}`}
                        aria-current={photoPages[index] === photoIndex ? "true" : undefined}
                      />
                    ))}
                  </div>

                  <div className="memory-card-copy">
                    <span className="memory-label">{memory.label}</span>
                    <strong className={index < 2 ? "grand-memory-title" : undefined}>
                      {memory.title}
                    </strong>
                    {index > 1 && (
                      <small>{isRevealed ? memory.note : "点亮后解锁这段故事"}</small>
                    )}
                    <button
                      type="button"
                      className="memory-reveal-button"
                      onClick={() => revealMemory(index)}
                      disabled={isRevealed}
                    >
                      {isRevealed ? "记忆已点亮" : "点亮这段记忆"}
                    </button>
                  </div>
                  {isRevealed && <i className="collected-candle" aria-hidden="true" />}
                </article>
              );
            })}
          </div>

          {revealed.length === birthday.memories.length && (
            <button className="primary-button" type="button" onClick={() => goTo("cake")}>
              带上蜡烛，继续前进 <span>→</span>
            </button>
          )}
        </section>
      )}

      {stage === "cake" && (
        <ArCakeExperience
          candlesOut={candlesOut}
          micStatus={micStatus}
          onStartMicrophone={startMicrophone}
          onExtinguish={extinguishCandles}
          onContinue={() => goTo("letter")}
        />
      )}

      {stage === "letter" && (
        <section className="scene letter-scene" aria-labelledby="letter-title">
          <div className="eyebrow">任务完成 · 最终奖励</div>
          <div className="letter-paper">
            <div className="paper-tape" aria-hidden="true" />
            <span className="letter-date">TODAY · 23:59</span>
            <h2 id="letter-title">生日快乐，{birthday.recipient}</h2>
            {birthday.letter.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="signature">
              <span>一直站你这边的</span>
              <strong>{birthday.sender}</strong>
            </div>
            <span className="letter-stamp">HBD</span>
          </div>
          <div className="final-actions">
            <button
              className="secondary-button light"
              type="button"
              onClick={() => {
                setRevealed([]);
                setPhotoPages(birthday.memories.map(() => 0));
                setCandlesOut(false);
                goTo("welcome");
              }}
            >
              再玩一次
            </button>
            <p>愿新的一岁，继续做有趣的大人。</p>
          </div>
        </section>
      )}

      <footer>
        <span>MADE FOR ONE VERY SPECIFIC HUMAN</span>
        <span>© TODAY</span>
      </footer>
    </main>
  );
}
