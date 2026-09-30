"use client";

import { useEffect, useState } from "react";
import { PlayIcon } from "lucide-react";
import { Archivo_Black, Space_Grotesk } from "next/font/google";

// The animation is choreographed as one 21s cycle (see the keyframe
// percentages below). We let it run that cycle once, then freeze it at the
// moment the closing "parabola" wordmark is fully on screen (96%-99.5% of
// the cycle) rather than letting it fade out and loop. Replaying forces a
// full remount via `key`, which resets every CSS animation to 0%.
const CYCLE_MS = 21000;
const FREEZE_AT_MS = 20500; // inside the 20160-20895ms window sF is fully visible

const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pb-display",
});
const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-pb-body",
});

export function ParabolaHero() {
  const [playId, setPlayId] = useState(0);
  // Starts paused (both on the server and before hydration) so the CSS
  // animation's own clock can't start advancing until this effect below
  // explicitly un-pauses it — otherwise the animation (present in the
  // server-rendered HTML) starts ticking at initial paint, well before
  // hydration finishes, and the freeze timer below (which only starts
  // once JS runs) ends up firing against the wrong point in the cycle.
  const [paused, setPaused] = useState(true);
  // Distinguishes "paused because it hasn't started yet" (SSR/pre-hydration)
  // from "paused because it finished" — only the latter should offer replay.
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setEnded(false);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setPaused(true);
      setEnded(true);
      return;
    }

    setPaused(false);
    const timer = setTimeout(() => {
      setPaused(true);
      setEnded(true);
    }, FREEZE_AT_MS);
    return () => clearTimeout(timer);
  }, [playId]);

  const replay = () => setPlayId((id) => id + 1);

  return (
    <div
      className={`${archivoBlack.variable} ${spaceGrotesk.variable} pb-stage`}
    >
      <div
        key={playId}
        className={`pb-frame${paused ? " paused" : ""}`}
        role={ended ? "button" : undefined}
        aria-label={ended ? "Replay animation" : undefined}
        tabIndex={ended ? 0 : undefined}
        onClick={ended ? replay : undefined}
        onKeyDown={
          ended
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") replay();
              }
            : undefined
        }
      >
        <svg className="bg-svg" viewBox="0 0 800 400" preserveAspectRatio="none">
          <path
            className="bg-arc draw"
            d="M -50,380 Q 400,-100 850,380"
            strokeWidth="1.5"
            opacity="0.13"
            strokeDasharray="1500"
          />
          <path
            className="bg-arc draw"
            d="M -50,420 Q 400,50 850,420"
            strokeWidth="1.5"
            opacity="0.10"
            strokeDasharray="1500"
            style={{ animationDelay: "-6s" }}
          />
          <path
            className="bg-arc draw"
            d="M -50,300 Q 400,-200 850,300"
            strokeWidth="1.5"
            opacity="0.08"
            strokeDasharray="1500"
            style={{ animationDelay: "-12s" }}
          />
          <path
            className="deco"
            d="M 40,90 Q 130,20 220,90"
            transform="rotate(8 130 55)"
          />
          <path
            className="deco"
            d="M 600,340 Q 690,280 780,340"
            transform="rotate(-6 690 310)"
          />
          <path className="deco" d="M 30,250 Q 100,200 170,250" opacity="0.06" />
          <path className="deco" d="M 630,60 Q 700,15 770,60" opacity="0.06" />
          <path className="deco" d="M 300,370 Q 380,330 460,370" opacity="0.05" />
        </svg>
        <div className="dot d1" />
        <div className="dot d2" />
        <div className="dot d3" />
        <div className="dot d4" />

        <div className="scene sA">
          <div className="wordmark">
            <span className="letter top">p</span>
            <span className="letter bot">a</span>
            <span className="letter top">r</span>
            <span className="letter bot">a</span>
            <span className="letter top">b</span>
            <span className="letter bot">o</span>
            <span className="letter top">l</span>
            <span className="letter bot">a</span>
          </div>
        </div>

        <div className="scene sB">
          <div className="quote">
            it rises. it falls. that&apos;s the shape of a parabola.
            <span className="punchline">
              but with parabola, it never really falls.
            </span>
          </div>
        </div>

        <div className="scene sC">
          <svg className="rise-svg" viewBox="0 0 800 400">
            <path
              className="rise-path"
              d="M20,378 Q110,220 220,320 Q260,290 300,310 Q390,180 460,270 Q500,250 540,260 Q650,120 710,200 Q760,40 800,-120"
            />
            <circle className="impact i1" r="14" cx="220" cy="320" />
            <circle className="impact i2" r="14" cx="460" cy="270" />
            <circle className="impact i3" r="14" cx="710" cy="200" />
            <circle className="rise-dot" r="8" cx="0" cy="0" />
          </svg>
        </div>

        <div className="scene sD">
          <div className="quote">
            real work doesn&apos;t move in a straight line
            <span className="punchline">...linearly.</span>
          </div>
        </div>

        <div className="scene sE">
          <div className="tagline">plan the curve, not the line.</div>
        </div>

        <div className="scene sF">
          <div className="closing-word">parabola</div>
        </div>

        <div className="blur-layer" />
        <div className="vignette" />
        <div className="letterbox top" />
        <div className="letterbox bottom" />

        {ended && (
          <button
            type="button"
            className="pb-replay"
            aria-label="Replay"
            onClick={(e) => {
              e.stopPropagation();
              replay();
            }}
          >
            <PlayIcon className="size-4" fill="currentColor" />
          </button>
        )}
      </div>

      <style>{`
        .pb-stage { width: 100%; }
        .pb-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #000;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          font-family: var(--font-pb-body), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pb-frame.paused { cursor: pointer; }

        .pb-frame .bg-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .pb-frame .bg-arc.draw {
          fill: none; stroke: #fff; stroke-linecap: round;
          animation: pb-drawArc 21s ease-in-out infinite;
        }
        @keyframes pb-drawArc {
          0% { stroke-dashoffset: 1500; }
          40% { stroke-dashoffset: 0; }
          75% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -1500; }
        }
        .pb-frame .deco { fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; opacity: 0.08; }

        .pb-frame .dot { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #fff; opacity: 0.4; }
        .pb-frame .dot.d1 { offset-path: path("M -10,260 Q 220,30 450,260"); animation: pb-run 2.4s ease-in-out infinite; }
        .pb-frame .dot.d2 { offset-path: path("M 60,320 Q 280,90 500,320"); animation: pb-run 2.9s ease-in-out infinite; opacity: 0.3; width: 5px; height: 5px; }
        .pb-frame .dot.d3 { offset-path: path("M 380,300 Q 600,60 820,300"); animation: pb-run 2.1s ease-in-out infinite; }
        .pb-frame .dot.d4 { offset-path: path("M -20,140 Q 200,320 460,150"); animation: pb-run 3.3s ease-in-out infinite reverse; opacity: 0.25; }
        @keyframes pb-run { 0% { offset-distance: 0%; } 50% { offset-distance: 100%; } 100% { offset-distance: 0%; } }

        .pb-frame .scene {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center;
          padding: 6% 8%; opacity: 0; color: #fff;
        }

        .pb-frame .wordmark {
          font-family: var(--font-pb-display), var(--font-pb-body), sans-serif;
          font-weight: 900; font-size: clamp(2.2rem, 9vw, 4.5rem);
          letter-spacing: -0.02em; display: flex;
        }
        .pb-frame .letter { display: inline-block; opacity: 0; animation: pb-letterIn 21s cubic-bezier(0.22,1,0.36,1) infinite; }
        .pb-frame .letter.top { --fy: -46px; }
        .pb-frame .letter.bot { --fy: 46px; }
        @keyframes pb-letterIn {
          0% { opacity: 0; transform: translateY(var(--fy)) scale(.5); }
          3% { opacity: 1; transform: translateY(-6px) scale(1.1); }
          5% { opacity: 1; transform: translateY(0) scale(1); }
          95% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(var(--fy)) scale(.5); }
        }

        .pb-frame .quote { font-weight: 500; font-size: clamp(1.05rem, 4vw, 2rem); line-height: 1.45; max-width: 80%; letter-spacing: 0.01em; }
        .pb-frame .punchline { display: block; margin-top: 20px; font-weight: 400; font-size: 0.62em; color: #9a9a9a; font-style: italic; letter-spacing: 0.02em; }
        .pb-frame .tagline { font-family: var(--font-pb-body), sans-serif; font-weight: 600; font-size: clamp(1.5rem, 5.8vw, 2.9rem); line-height: 1.3; letter-spacing: -0.01em; max-width: 86%; }
        .pb-frame .closing-word { font-family: var(--font-pb-body), sans-serif; font-weight: 600; font-size: clamp(2.2rem, 9vw, 4.5rem); letter-spacing: -0.02em; }

        .pb-frame .rise-svg { width: 88%; max-width: 560px; overflow: visible; }
        .pb-frame .rise-path { fill: none; stroke: #fff; stroke-width: 5; stroke-linecap: round; }
        .pb-frame .rise-dot { fill: #fff; }
        .pb-frame .impact {
          fill: none; stroke: #fff; stroke-width: 2; opacity: 0;
          transform-origin: center; transform-box: fill-box;
          animation: pb-impactPulse 21s ease-out infinite;
        }
        @keyframes pb-impactPulse {
          0% { opacity: 0; transform: scale(.3); }
          7% { opacity: .7; transform: scale(.5); }
          22% { opacity: 0; transform: scale(1.8); }
          100% { opacity: 0; }
        }

        .pb-frame .vignette {
          position: absolute; inset: 0; pointer-events: none; opacity: 0;
          background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%);
          animation: pb-vignetteAnim 21s ease-in-out infinite; z-index: 5;
        }
        @keyframes pb-vignetteAnim { 0%,54% { opacity: 0; } 60% { opacity: .6; } 65% { opacity: .6; } 68% { opacity: 0; } 100% { opacity: 0; } }

        .pb-frame .letterbox { position: absolute; left: 0; right: 0; background: #000; height: 0; z-index: 6; animation: pb-letterboxAnim 21s cubic-bezier(0.4,0,0.2,1) infinite; }
        .pb-frame .letterbox.top { top: 0; }
        .pb-frame .letterbox.bottom { bottom: 0; }
        @keyframes pb-letterboxAnim { 0%,53% { height: 0; } 57% { height: 9%; } 98% { height: 9%; } 100% { height: 0; } }

        .pb-frame .blur-layer { position: absolute; inset: 0; z-index: 4; backdrop-filter: blur(0px); animation: pb-blurAnim 21s ease-in-out infinite; pointer-events: none; }
        @keyframes pb-blurAnim { 0%,58% { backdrop-filter: blur(0px); } 60% { backdrop-filter: blur(3px); } 62% { backdrop-filter: blur(0px); } 100% { backdrop-filter: blur(0px); } }

        .pb-frame .sA { animation: pb-sAanim 21s linear infinite; }
        @keyframes pb-sAanim { 0% { opacity: 1; } 11% { opacity: 1; } 12% { opacity: 0; } 100% { opacity: 0; } }

        .pb-frame .sB { animation: pb-sBanim 21s cubic-bezier(0.22,1,0.36,1) infinite; }
        @keyframes pb-sBanim {
          0%,11.5% { opacity: 0; transform: translateY(16px); }
          13.5% { opacity: 1; transform: translateY(0); }
          33% { opacity: 1; transform: translateY(0); }
          35% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 0; }
        }
        .pb-frame .sB .punchline { opacity: 0; animation: pb-punchB 21s ease-out infinite; }
        @keyframes pb-punchB { 0%,22% { opacity: 0; transform: translateY(6px); } 25% { opacity: 1; transform: translateY(0); } 33% { opacity: 1; } 35% { opacity: 0; } 100% { opacity: 0; } }

        .pb-frame .sC { animation: pb-sCanim 21s cubic-bezier(0.22,1,0.36,1) infinite; z-index: 2; }
        @keyframes pb-sCanim {
          0%,35% { opacity: 0; transform: scale(0.92); }
          37% { opacity: 1; transform: scale(1); }
          63% { opacity: 1; transform: scale(1); }
          65% { opacity: 0; transform: scale(1.02); }
          100% { opacity: 0; }
        }
        .pb-frame .sC .rise-path { stroke-dasharray: 1800; stroke-dashoffset: 1800; animation: pb-drawRise 21s cubic-bezier(0.3,0,0.2,1) infinite; }
        @keyframes pb-drawRise { 0%,36.5% { stroke-dashoffset: 1800; } 60% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 0; } }
        .pb-frame .sC .rise-dot {
          offset-path: path("M20,378 Q110,220 220,320 Q260,290 300,310 Q390,180 460,270 Q500,250 540,260 Q650,120 710,200 Q760,40 800,-120");
          animation: pb-travelRise 21s cubic-bezier(0.3,0,0.2,1) infinite;
        }
        @keyframes pb-travelRise { 0%,36.5% { offset-distance: 0%; } 60% { offset-distance: 100%; } 100% { offset-distance: 100%; } }
        .pb-frame .sC .rise-svg { animation: pb-zoomFollow 21s cubic-bezier(0.4,0,0.2,1) infinite; }
        @keyframes pb-zoomFollow {
          0%,55% { transform: scale(1) translate(0,0); }
          58% { transform: scale(1.6) translate(-60px,20px); }
          60% { transform: scale(2.2) translate(-120px,55px); }
          64% { transform: scale(2.6) translate(-150px,70px); }
          100% { transform: scale(1) translate(0,0); }
        }
        .pb-frame .impact.i1 { animation-delay: -8.48s; }
        .pb-frame .impact.i2 { animation-delay: -10.13s; }
        .pb-frame .impact.i3 { animation-delay: -11.78s; }

        .pb-frame .sD { animation: pb-sDanim 21s cubic-bezier(0.22,1,0.36,1) infinite; }
        @keyframes pb-sDanim {
          0%,66% { opacity: 0; transform: translateY(16px); }
          68% { opacity: 1; transform: translateY(0); }
          82% { opacity: 1; transform: translateY(0); }
          84% { opacity: 0; transform: translateY(-10px); }
          100% { opacity: 0; }
        }
        .pb-frame .sD .punchline { opacity: 0; animation: pb-punchD 21s ease-out infinite; }
        @keyframes pb-punchD { 0%,76% { opacity: 0; transform: translateY(6px); } 78.5% { opacity: 1; transform: translateY(0); } 82% { opacity: 1; } 84% { opacity: 0; } 100% { opacity: 0; } }

        .pb-frame .sE { animation: pb-sEanim 21s cubic-bezier(0.22,1,0.36,1) infinite; }
        @keyframes pb-sEanim {
          0%,84% { opacity: 0; transform: scale(0.9); }
          87% { opacity: 1; transform: scale(1); }
          91.5% { opacity: 1; transform: scale(1); }
          93.5% { opacity: 0; transform: scale(1.04); }
          100% { opacity: 0; }
        }

        .pb-frame .sF { animation: pb-sFanim 21s cubic-bezier(0.22,1,0.36,1) infinite; }
        @keyframes pb-sFanim {
          0%,93.5% { opacity: 0; transform: translateY(14px); }
          96% { opacity: 1; transform: translateY(0); }
          99.5% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }

        .pb-frame.paused, .pb-frame.paused * {
          animation-play-state: paused !important;
        }
        .pb-frame.paused .pb-replay {
          animation-play-state: running !important;
        }

        .pb-replay {
          position: absolute; right: 18px; bottom: 15%; z-index: 7;
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.92); color: #111;
          box-shadow: 0 4px 16px rgba(0,0,0,0.45);
          cursor: pointer;
          animation: pb-replayIn 0.4s ease both;
        }
        .pb-replay:hover { background: #fff; transform: scale(1.06); }
        @keyframes pb-replayIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

        @media (prefers-reduced-motion: reduce) {
          .pb-frame * { animation: none !important; }
          .pb-frame .scene.sF { opacity: 1 !important; }
          .pb-frame .scene:not(.sF) { opacity: 0 !important; }
          .pb-frame .letterbox { height: 9% !important; }
        }
      `}</style>
    </div>
  );
}
