"use client";

import { MouseEvent, useMemo, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FACTORY_ADDRESS } from "../config/chains";
import { Button } from "./ui/button";
import { CreateIcon } from "./Icons";

const FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "uint256", name: "_A0", type: "uint256" },
      { internalType: "uint256", name: "_A1", type: "uint256" },
      { internalType: "uint256", name: "_baseFee", type: "uint256" },
      { internalType: "uint256", name: "_kinkingFee", type: "uint256" },
    ],
    name: "createPool",
    outputs: [{ internalType: "address", name: "pool", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const N_COINS = 2;
const MAX_ITERATIONS = 255;
const EPSILON = 1e-9;

type Balances = [number, number];

const getInvariant = (xp: Balances, amp: number) => {
  const S = xp[0] + xp[1];
  if (S === 0) return 0;

  let D = S;
  const Ann = amp * N_COINS;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let D_P = D;
    for (let j = 0; j < N_COINS; j++) {
      const denom = xp[j] * N_COINS + EPSILON;
      D_P = (D_P * D) / denom;
    }
    const D_prev = D;
    const numerator = (Ann * S + D_P * N_COINS) * D;
    const denominator = (Ann - 1) * D + (N_COINS + 1) * D_P;
    D = numerator / (denominator || EPSILON);

    if (Math.abs(D - D_prev) <= EPSILON) {
      break;
    }
  }

  return D;
};

const getY = (i: number, j: number, x: number, xp: Balances, amp: number) => {
  const D = getInvariant(xp, amp);
  if (D === 0) return 0;

  let c = D;
  let S_ = 0;
  const Ann = amp * N_COINS;

  for (let idx = 0; idx < N_COINS; idx++) {
    if (idx === j) continue;
    const _x = idx === i ? x : xp[idx];
    S_ += _x;
    c = (c * D) / (_x * N_COINS + EPSILON);
  }

  c = (c * D) / (Ann * N_COINS + EPSILON);
  const b = S_ + D / Ann;
  let y = D;

  for (let _i = 0; _i < MAX_ITERATIONS; _i++) {
    const y_prev = y;
    y = (y * y + c) / (2 * y + b - D + EPSILON);
    if (Math.abs(y - y_prev) <= EPSILON) {
      break;
    }
  }

  return y;
};

const getPrices = (balances: Balances, amp: number) => {
  const dx = 1e-6;
  const xp: Balances = [balances[0], balances[1]];
  const xNew = xp[0] + dx;
  const yNew = getY(0, 1, xNew, xp, amp);
  const dy = xp[1] - yNew;
  const priceAinB = dy / dx;
  const priceBinA = priceAinB !== 0 ? 1 / priceAinB : 0;

  return {
    priceAinB,
    priceBinA,
  };
};

export default function CreatePool() {
  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [A0, setA0] = useState(100);
  const [A1, setA1] = useState(200);
  const [baseFee, setBaseFee] = useState(4);
  const [kinkingFee, setKinkingFee] = useState(10);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreatePool = () => {
    if (!tokenA || !tokenB) {
      alert("Please enter both token addresses");
      return;
    }

    writeContract({
      address: FACTORY_ADDRESS as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "createPool",
      args: [
        tokenA as `0x${string}`,
        tokenB as `0x${string}`,
        BigInt(A0),
        BigInt(A1),
        BigInt(baseFee),
        BigInt(kinkingFee),
      ],
    });
  };

  const [hoverPoint, setHoverPoint] = useState<{
    xValue: number;
    yValue: number;
    priceAinB: number;
    priceBinA: number;
    x: number;
    y: number;
  } | null>(null);

  const GRAPH_WIDTH = 250;
  const GRAPH_HEIGHT = 250;
  const GRAPH_PADDING = 45;

  const curveData = useMemo(() => {
    const refBalances: Balances = [1, 1]; // D ~= 2
    // Range around equilibrium. x from 0.1 to 2.0 roughly.
    // If D=2, x can go up to nearly 2.
    const samples = 100;
    const minX = 0.05;
    const maxX = 1.95;

    const rawPoints: {
      xValue: number;
      yValue: number;
      priceAinB: number;
      priceBinA: number;
    }[] = [];

    for (let i = 0; i <= samples; i++) {
      const xValue = minX + ((maxX - minX) * i) / samples;
      // Determine amplification based on current x vs implied y
      // We can cheat slightly: calculate y with A0, check ratio, correct if needed.
      // Actually, simpler:
      // If x > 1 (assuming D=2 equilibrium at 1,1), we are heavy A, so use A0.
      // If x < 1, we are heavy B, use A1.
      const amp = xValue >= 1 ? Number(A0) : Number(A1);

      // Calculate y given x and the equilibrium invariant
      const yValue = getY(0, 1, xValue, refBalances, amp);

      const balances: Balances = [xValue, yValue];
      const { priceAinB, priceBinA } = getPrices(balances, amp);
      rawPoints.push({ xValue, yValue, priceAinB, priceBinA });
    }

    // Plot mapping
    // X axis: Token B Balance (0 to 2) - bottom
    // Y axis: Token A Balance (0 to 2) - left
    const rangeX = 2; // slightly larger than D
    const rangeY = 2;

    const EXAGGERATION_FACTOR = 1.2; // Adjust this to tune the effect

    return rawPoints.map((point) => {
      // Swap: xValue (Token A) goes to Y axis, yValue (Token B) goes to X axis
      const xNorm = point.yValue / rangeX; // Token B on X axis
      const yNorm = point.xValue / rangeY; // Token A on Y axis

      const x = GRAPH_PADDING + xNorm * (GRAPH_WIDTH - GRAPH_PADDING * 2);
      // Apply slight exaggeration to Y to emphasize the kink/tail
      const yExaggerated =
        0.5 + (yNorm - 0.5) * EXAGGERATION_FACTOR;

      const y =
        GRAPH_HEIGHT -
        GRAPH_PADDING -
        Math.max(0, Math.min(1, yExaggerated)) * (GRAPH_HEIGHT - GRAPH_PADDING * 2);

      return {
        xValue: point.xValue,
        yValue: point.yValue,
        priceAinB: point.priceAinB,
        priceBinA: point.priceBinA,
        x,
        y,
      };
    });
  }, [A0, A1]);

  const generateKinkPath = () =>
    curveData.length > 0
      ? curveData
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`)
          .join(" ")
      : "";

  return (
    <div className="w-full max-w-6xl mx-auto rounded-2xl border border-border/60 bg-card p-6 layered-shadow-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-6 text-center">
        <CreateIcon className="w-12 h-12 text-[#ff00ff]" />
        <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center">
          Create Kinky Pool
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Full width graph */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6 w-full overflow-hidden relative">
          <h3 className="text-xl font-semibold mb-4 text-[#00ffff]">
            Kink Curve Preview
          </h3>
          <div
            style={{ width: "100%", height: `700px` }}
            className="relative"
          >
            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              style={{ width: "100%", height: "100%" }}
              preserveAspectRatio="none"
            >
              {/* Grid lines */}
              <defs>
                <linearGradient
                  id="kinkGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#00ffff" />
                  <stop offset="100%" stopColor="#ff00ff" />
                </linearGradient>
                <clipPath id="kinkClip">
                  <rect
                    x="5"
                    y="5"
                    width={GRAPH_WIDTH - 10}
                    height={GRAPH_HEIGHT - 30}
                    rx="18"
                  />
                </clipPath>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Axes */}
              {/* X axis (bottom) - Balance B */}
              <line
                x1={GRAPH_PADDING}
                y1={GRAPH_HEIGHT - GRAPH_PADDING}
                x2={GRAPH_WIDTH - GRAPH_PADDING}
                y2={GRAPH_HEIGHT - GRAPH_PADDING}
                stroke="rgba(47,26,60,0.2)"
                strokeWidth="1.5"
              />
              {/* Y axis (left) - Balance A */}
              <line
                x1={GRAPH_PADDING}
                y1={GRAPH_HEIGHT - GRAPH_PADDING}
                x2={GRAPH_PADDING}
                y2={GRAPH_PADDING}
                stroke="rgba(47,26,60,0.2)"
                strokeWidth="1.5"
              />
              {/* X axis label (bottom) - Balance B */}
              <text
                x={GRAPH_WIDTH - GRAPH_PADDING}
                y={GRAPH_HEIGHT - GRAPH_PADDING + 18}
                fill="rgb(236, 64, 37)"
                fontSize="10"
                textAnchor="end"
              >
                Balance B
              </text>
              {/* Y axis label (left) - Balance A */}
              <text
                x={-(GRAPH_HEIGHT / 2)}
                y={GRAPH_PADDING - 12}
                fill="rgb(236, 64, 37)"
                fontSize="10"
                transform="rotate(-90)"
                textAnchor="middle"
              >
                Balance A
              </text>

              {/* The kinked curve */}
              <g clipPath="url(#kinkClip)">
                <path
                  d={generateKinkPath()}
                  stroke="url(#kinkGradient)"
                  strokeWidth="4"
                  fill="none"
                  filter="url(#glow)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
            <div
              className="absolute top-0 left-0 w-full h-full"
              style={{ cursor: "crosshair" }}
              onMouseMove={(event: MouseEvent<HTMLDivElement>) => {
                if (!curveData.length) return;
                const rect = event.currentTarget.getBoundingClientRect();

                // Calculate scale based on actual container size vs SVG viewBox
                // SVG preserves aspect ratio, so we need to account for that
                const containerAspect = rect.width / rect.height;
                const svgAspect = GRAPH_WIDTH / GRAPH_HEIGHT;

                let scaleX: number;
                let scaleY: number;
                let offsetX = 0;
                let offsetY = 0;

                if (containerAspect > svgAspect) {
                  // Container is wider - SVG is letterboxed
                  const scaledHeight = rect.width / svgAspect;
                  offsetY = (scaledHeight - rect.height) / 2;
                  scaleX = GRAPH_WIDTH / rect.width;
                  scaleY = GRAPH_HEIGHT / scaledHeight;
                } else {
                  // Container is taller - SVG is pillarboxed
                  const scaledWidth = rect.height * svgAspect;
                  offsetX = (scaledWidth - rect.width) / 2;
                  scaleX = GRAPH_WIDTH / scaledWidth;
                  scaleY = GRAPH_HEIGHT / rect.height;
                }

                // Convert mouse position to SVG coordinates
                const mouseSvgX = ((event.clientX - rect.left) + offsetX) * scaleX;
                const mouseSvgY = ((event.clientY - rect.top) + offsetY) * scaleY;

                // Find nearest point on curve
                const nearest = curveData.reduce((prev, curr) => {
                  const prevDist =
                    (prev.x - mouseSvgX) ** 2 + (prev.y - mouseSvgY) ** 2;
                  const currDist =
                    (curr.x - mouseSvgX) ** 2 + (curr.y - mouseSvgY) ** 2;
                  return currDist < prevDist ? curr : prev;
                }, curveData[0]);
                setHoverPoint(nearest);
              }}
              onMouseLeave={() => setHoverPoint(null)}
            />
            {hoverPoint && (
              <>
                <svg
                  viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    pointerEvents: "none",
                  }}
                  preserveAspectRatio="none"
                >
                  <circle
                    cx={hoverPoint.x}
                    cy={hoverPoint.y}
                    r={5}
                    fill="#fff"
                    stroke="#ff00ff"
                    strokeWidth="2"
                  />
                </svg>
                <div
                  className="absolute bg-card text-foreground text-sm px-3 py-2 rounded-xl shadow-lg border border-border/50"
                  style={{
                    left: `${Math.min(
                      ((hoverPoint.x + 25) / GRAPH_WIDTH) * 100,
                      ((GRAPH_WIDTH - GRAPH_PADDING) / GRAPH_WIDTH) * 100
                    )}%`,
                    top: `${Math.max(
                      ((hoverPoint.y - 45) / GRAPH_HEIGHT) * 100,
                      (GRAPH_PADDING / 2 / GRAPH_HEIGHT) * 100
                    )}%`,
                  }}
                >
                  <div className="font-semibold text-muted-foreground uppercase text-xs">
                    Snapshot
                  </div>
                  <div>Bal A: {hoverPoint.xValue.toFixed(2)}</div>
                  <div>Bal B: {hoverPoint.yValue.toFixed(2)}</div>
                  <div>
                    Price A→B: {hoverPoint.priceAinB.toFixed(4)}
                  </div>
                  <div>
                    Price B→A: {hoverPoint.priceBinA.toFixed(4)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Info card column */}
          <div className="lg:col-span-1">
            <div className="h-full rounded-xl border border-border/50 bg-muted/40 p-6 space-y-4 text-base">
              <div className="flex items-start gap-3">
                <span className="text-[#00ffff] text-xl">●</span>
                <p className="text-foreground">
                  <span className="font-semibold text-[#00ffff]">A0</span>{" "}
                  controls the curve when Token A &gt; Token B
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#ff00ff] text-xl">●</span>
                <p className="text-foreground">
                  <span className="font-semibold text-[#ff00ff]">A1</span>{" "}
                  controls the curve when Token B &gt; Token A
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#00ff00] text-xl">●</span>
                <p className="text-foreground">
                  The <span className="font-semibold text-[#00ff00]">KINK</span>{" "}
                  occurs at 1:1 equilibrium
                </p>
              </div>
            </div>
          </div>

          {/* Fee sliders column */}
          <div className="lg:col-span-1">
            <div className="h-full rounded-xl border border-border/50 bg-muted/40 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <div className="h-full rounded-xl border border-border/60 bg-card/60 p-4">
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-semibold text-foreground">
                        Base Fee
                      </label>
                      <span className="text-lg font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">
                        {(baseFee / 100).toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={baseFee}
                      onChange={(e) => setBaseFee(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <div className="h-full rounded-xl border border-border/60 bg-card/60 p-4">
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-semibold text-foreground">
                        Kinking Fee
                      </label>
                      <span className="text-lg font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">
                        {(kinkingFee / 100).toFixed(2)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={kinkingFee}
                      onChange={(e) => setKinkingFee(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Token inputs & amplification sliders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="lg:col-span-1">
            <div className="flex flex-col gap-4 h-full">
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <label className="block text-base font-semibold text-foreground mb-3">
                  Token A Address
                </label>
                <input
                  type="text"
                  value={tokenA}
                  onChange={(e) => setTokenA(e.target.value)}
                  className="w-full text-lg bg-input border border-border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                  placeholder="0x..."
                />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <div className="flex justify-between mb-3 items-center">
                  <label className="text-base font-semibold text-foreground">
                    Amplification A0
                  </label>
                  <span className="text-2xl font-bold text-[#00ffff]">{A0}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={A0}
                  onChange={(e) => setA0(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>10</span>
                  <span className="text-muted-foreground/70">More stable when A is heavy</span>
                  <span>500</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="flex flex-col gap-4 h-full">
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <label className="block text-base font-semibold text-foreground mb-3">
                  Token B Address
                </label>
                <input
                  type="text"
                  value={tokenB}
                  onChange={(e) => setTokenB(e.target.value)}
                  className="w-full text-lg bg-input border border-border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                  placeholder="0x..."
                />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <div className="flex justify-between mb-3 items-center">
                  <label className="text-base font-semibold text-foreground">
                    Amplification A1
                  </label>
                  <span className="text-2xl font-bold text-[#ff00ff]">{A1}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={A1}
                  onChange={(e) => setA1(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>10</span>
                  <span className="text-muted-foreground/70">More stable when B is heavy</span>
                  <span>500</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleCreatePool}
          disabled={isPending || isConfirming || !tokenA || !tokenB}
          className="w-full px-4 py-6 text-lg font-bold rounded-xl bg-linear-to-r from-[#00ffff] to-[#ff00ff] text-black hover:opacity-90 transition-opacity"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Creating Pool...
            </span>
          ) : isConfirming ? (
            <span className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Confirming...
            </span>
          ) : isSuccess ? (
            <span className="flex items-center justify-center gap-3">
              ✨ Pool Created!
            </span>
          ) : (
            <span>Create Kinky Pool</span>
          )}
        </Button>

        {/* Success Message */}
        {isSuccess && (
          <div className="rounded-xl border border-green-500/50 bg-green-500/10 p-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div className="flex-1">
                <div className="font-bold text-green-400 mb-2 text-lg">
                  Pool Created Successfully!
                </div>
                <a
                  href={`https://optimistic.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#00ffff] hover:underline font-mono inline-flex items-center gap-1"
                >
                  View on Etherscan →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
