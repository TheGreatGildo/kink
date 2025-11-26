"use client";

import { useMemo, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FACTORY_ADDRESS, CEFI_TOKEN_ADDRESS, DEFI_TOKEN_ADDRESS } from "../config/chains";
import { Button } from "./ui/button";
import { CreateIcon } from "./Icons";
import { TokenSelector } from "./TokenSelector";
import { useTokenMetadata } from "../hooks/useTokenMetadata";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import dynamic from "next/dynamic";

// Dynamically import Scatter with no SSR
const Scatter = dynamic(
  () => import("react-chartjs-2").then((mod) => mod.Scatter),
  { ssr: false }
);

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

const FACTORY_ABI = [
  {
    inputs: [
      { internalType: "address", name: "tokenA", type: "address" },
      { internalType: "address", name: "tokenB", type: "address" },
      { internalType: "uint256", name: "_A0", type: "uint256" },
      { internalType: "uint256", name: "_A1", type: "uint256" },
      { internalType: "uint256", name: "_baseFee", type: "uint256" },
      { internalType: "uint256", name: "_kinkingFee", type: "uint256" },
      { internalType: "uint256", name: "_softPeg0", type: "uint256" },
      { internalType: "uint256", name: "_softPeg1", type: "uint256" },
    ],
    name: "createPool",
    outputs: [{ internalType: "address", name: "pool", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const N_COINS = 2;

type Balances = [number, number];

const get_y_D = (A: number, i: number, xp: Balances, D: number) => {
  // i is index to solve for (0 or 1)
  // xp contains balances. We use the one that is NOT i.
  // If i=1 (solve y), input is xp[0] (x).

  let x_input = i === 0 ? xp[1] : xp[0];

  // Safety check for x_input
  if (x_input <= 0) x_input = 0.000001; // Prevent division by zero

  let c = D;
  const S_ = x_input;
  const Ann = A * N_COINS;

  // c = c * D / (x * 2)
  c = (c * D) / (x_input * N_COINS);

  c = (c * D) / (Ann * N_COINS);
  const b = S_ + D / Ann;
  let y = D;

  for (let k = 0; k < 255; k++) {
    const y_prev = y;
    y = (y * y + c) / (2 * y + b - D);
    if (Math.abs(y - y_prev) <= 1) return y; // Tolerance of 1 wei equivalent
  }
  return y;
};

const calculatePrice = (x: number, A: number, D: number, dx = 1) => {
  const y1 = get_y_D(A, 1, [x, 0], D);
  const y2 = get_y_D(A, 1, [x + dx, 0], D);
  const dy = y1 - y2;
  return dy / dx;
};

export default function CreatePool() {
  const [tokenA, setTokenA] = useState(CEFI_TOKEN_ADDRESS);
  const [tokenB, setTokenB] = useState(DEFI_TOKEN_ADDRESS);
  const [A0, setA0] = useState(500);
  const [A1, setA1] = useState(100);
  const [baseFee, setBaseFee] = useState(5); // 0.05%
  const [kinkingFee, setKinkingFee] = useState(25); // 0.25%

  const [softPegA, setSoftPegA] = useState(0.998);
  const [softPegB, setSoftPegB] = useState(0.985);

  // Get token metadata for display
  const tokenAMeta = useTokenMetadata(tokenA);
  const tokenBMeta = useTokenMetadata(tokenB);

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
        BigInt(Math.floor(softPegA * 1e18)),
        BigInt(Math.floor(softPegB * 1e18)),
      ],
    });
  };

  // Fixed Liquidity D for preview visualization
  const D = 2000;

  // Soft peg values for visualization (always enabled)
  const effectiveSoftPegA = softPegA;
  const effectiveSoftPegB = softPegB;

  const { pointsKinkLeft, pointsBaseFee, pointsKinkRight, equilibriumPoints } = useMemo(() => {
    const mid = D / 2;
    const allPoints: { x: number; y: number; priceA: number; priceB: number }[] = [];
    const numSteps = 300;

    // Generate all curve points with their prices
    // Part 1: Left of equilibrium (x < mid, use A1)
    for (let i = 0; i <= numSteps / 2; i++) {
      const t = i / (numSteps / 2);
      let x = t * mid;
      if (x < 0.01) x = 0.01;

      const y = get_y_D(A1, 1, [x, 0], D);
      const priceA = calculatePrice(x, A1, D); // Price of A in terms of B (dy/dx)
      const priceB = priceA > 0 ? 1 / priceA : 0; // Price of B in terms of A
      allPoints.push({ x, y, priceA, priceB });
    }

    // Part 2: Right of equilibrium (x > mid, use A0)
    let x = mid + D / 100;
    let step = D / 100;
    const maxSteps = 500;
    let count = 0;

    while (count < maxSteps) {
      count++;
      const y = get_y_D(A0, 1, [x, 0], D);
      if (y <= 1) break;

      const priceA = calculatePrice(x, A0, D);
      const priceB = priceA > 0 ? 1 / priceA : 0;
      allPoints.push({ x, y, priceA, priceB });

      x += step;
      if (count > 50) step = D / 50;
      if (count > 100) step = D / 20;
    }

    // Split points into three segments based on soft peg prices:
    // - Left kink zone: price of B < softPegB (B is cheap, far left)
    // - Base fee zone: both prices >= soft pegs (middle safe zone)
    // - Right kink zone: price of A < softPegA (A is cheap, far right)
    const kinkLeftPoints: { x: number; y: number }[] = [];
    const baseFeePoints: { x: number; y: number }[] = [];
    const kinkRightPoints: { x: number; y: number }[] = [];

    for (const pt of allPoints) {
      const inKinkZoneA = effectiveSoftPegA > 0 && pt.priceA < effectiveSoftPegA;
      const inKinkZoneB = effectiveSoftPegB > 0 && pt.priceB < effectiveSoftPegB;

      if (inKinkZoneB) {
        // Far left - B is cheap (below soft peg)
        kinkLeftPoints.push({ x: pt.x, y: pt.y });
      } else if (inKinkZoneA) {
        // Far right - A is cheap (below soft peg)
        kinkRightPoints.push({ x: pt.x, y: pt.y });
      } else {
        // Middle - both prices are above soft pegs
        baseFeePoints.push({ x: pt.x, y: pt.y });
      }
    }

    // Add overlap points for continuous line segments
    // Find transition points and add them to adjacent segments
    if (kinkLeftPoints.length > 0 && baseFeePoints.length > 0) {
      const lastKinkLeft = kinkLeftPoints[kinkLeftPoints.length - 1];
      baseFeePoints.unshift({ ...lastKinkLeft });
    }
    if (baseFeePoints.length > 0 && kinkRightPoints.length > 0) {
      const lastBaseFee = baseFeePoints[baseFeePoints.length - 1];
      kinkRightPoints.unshift({ ...lastBaseFee });
    }

    const newEquilibriumPoints = [
      { x: 0, y: 0 },
      { x: Math.max(mid * 2.5, D), y: Math.max(mid * 2.5, D) },
    ];

    return {
      pointsKinkLeft: kinkLeftPoints,
      pointsBaseFee: baseFeePoints,
      pointsKinkRight: kinkRightPoints,
      equilibriumPoints: newEquilibriumPoints,
    };
  }, [A0, A1, D, effectiveSoftPegA, effectiveSoftPegB]);

  const chartOptions: ChartOptions<"scatter"> = {
    responsive: true,
    maintainAspectRatio: true, // Enforce aspect ratio
    aspectRatio: 1, // Square aspect ratio (1:1)
    animation: {
      duration: 0,
    },
    scales: {
      x: {
        type: "linear",
        position: "bottom",
        title: {
          display: true,
          text: "Token A Balance",
          color: "#9ca3af", // text-gray-400
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#9ca3af",
          stepSize: 500,
        },
        min: 0,
        max: 3000,
      },
      y: {
        title: {
          display: true,
          text: "Token B Balance",
          color: "#9ca3af",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "#9ca3af",
          stepSize: 500,
        },
        min: 0,
        max: 3000,
      },
    },
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb", // text-gray-200
        },
      },
        tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        callbacks: {
          label: function (context) {
            const x = context.parsed.x ?? 0;
            const y = context.parsed.y ?? 0;

            // Recalculate local price
            // Determine local A based on position relative to equilibrium
            // If x > y, we are in A0 territory (Token A heavy)
            // If y > x, we are in A1 territory (Token B heavy)
            const isHeavyA = x > y;
            const localA = isHeavyA ? A0 : A1;

            // Calculate price at this exact point
            const price = calculatePrice(x, localA, D);
            const priceInv = price > 0 ? 1 / price : 0;

            return [
              `Bal A: ${x.toFixed(2)}`,
              `Bal B: ${y.toFixed(2)}`,
              `Price A/B: ${price.toFixed(4)}`,
              `Price B/A: ${priceInv.toFixed(4)}`
            ];
          },
        },
      },
    },
  };

  const chartData = {
    datasets: [
      // Kink fee zone - left (Token B below soft peg)
      ...(pointsKinkLeft.length > 0 ? [{
        label: "Depeg Fee Zone (B < Peg)",
        data: pointsKinkLeft,
        borderColor: "rgb(0, 255, 0)", // Green #00ff00
        backgroundColor: "rgba(0, 255, 0, 0.1)",
        showLine: true,
        pointRadius: 1,
        borderWidth: 3,
        tension: 0.2,
        spanGaps: true,
      }] : []),
      // Base fee zone - middle (both prices above soft pegs)
      ...(pointsBaseFee.length > 0 ? [{
        label: "Base Fee Zone",
        data: pointsBaseFee,
        borderColor: "rgb(0, 255, 255)", // Cyan #00ffff
        backgroundColor: "rgba(0, 255, 255, 0.1)",
        showLine: true,
        pointRadius: 1,
        borderWidth: 3,
        tension: 0.2,
        spanGaps: true,
      }] : []),
      // Kink fee zone - right (Token A below soft peg)
      ...(pointsKinkRight.length > 0 ? [{
        label: "Depeg Fee Zone (A < Peg)",
        data: pointsKinkRight,
        borderColor: "rgb(0, 255, 0)", // Green #00ff00
        backgroundColor: "rgba(0, 255, 0, 0.1)",
        showLine: true,
        pointRadius: 1,
        borderWidth: 3,
        tension: 0.2,
        spanGaps: true,
      }] : []),
      {
        label: "Equilibrium (x=y)",
        data: equilibriumPoints,
        borderColor: "rgba(255, 0, 255, 0.5)", // Magenta #ff00ff
        borderDash: [5, 5],
        showLine: true,
        pointRadius: 0,
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="w-full max-w-6xl mx-auto rounded-2xl border border-border/60 bg-card p-6 layered-shadow-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-6 text-center">
        <CreateIcon className="w-12 h-12 text-[#00ffff]" />
        <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center">
          Create Kinky Pool
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Full width graph */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6 w-full overflow-hidden relative">
          <h3 className="text-xl font-semibold text-[#00ffff] mb-4">
            Kink Curve Preview
          </h3>
          <div className="relative w-full max-w-[600px] mx-auto aspect-square">
            <Scatter data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Info card column */}
          <div className="lg:col-span-1">
            <div className="h-full rounded-xl border border-border/50 bg-muted/40 p-6 space-y-4 text-base">
              <div className="flex items-start gap-3">
                <span className="text-[#00ffff] text-xl">●</span>
                <p className="text-foreground">
                  <span className="font-semibold text-[#00ffff]">{tokenAMeta.symbol || 'Token A'}</span>{" "}
                  concentration controls curve when {tokenAMeta.symbol || 'A'} &gt; {tokenBMeta.symbol || 'B'}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[#ff00ff] text-xl">●</span>
                <p className="text-foreground">
                  <span className="font-semibold text-[#ff00ff]">{tokenBMeta.symbol || 'Token B'}</span>{" "}
                  concentration controls curve when {tokenBMeta.symbol || 'B'} &gt; {tokenAMeta.symbol || 'A'}
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
                    <div className="flex justify-between mb-2 items-center">
                      <label className="text-sm font-semibold text-foreground">
                        Base Fee
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(baseFee / 100).toFixed(2)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) setBaseFee(Math.min(100, Math.max(0, Math.round(val * 100))));
                          }}
                          className="w-20 text-right text-lg font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#00ffff] focus:outline-none focus:border-[#00ffff]"
                        />
                        <span className="text-lg font-bold text-[#00ffff]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={baseFee}
                      onChange={(e) => setBaseFee(Number(e.target.value))}
                      className="w-full accent-[#00ffff]"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      Applied when bringing the pool to Equilibrium
                    </div>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <div className="h-full rounded-xl border border-border/60 bg-card/60 p-4">
                    <div className="flex justify-between mb-2 items-center">
                      <label className="text-sm font-semibold text-foreground">
                        Depeg Fee
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={(kinkingFee / 100).toFixed(2)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) setKinkingFee(Math.min(100, Math.max(0, Math.round(val * 100))));
                          }}
                          className="w-20 text-right text-lg font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#ff00ff] focus:outline-none focus:border-[#ff00ff]"
                        />
                        <span className="text-lg font-bold text-[#ff00ff]">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={kinkingFee}
                      onChange={(e) => setKinkingFee(Number(e.target.value))}
                      className="w-full accent-[#ff00ff]"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      Applied when pushing away from Equilibrium
                    </div>
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
                <TokenSelector
                  label="Token A Address (CeFi)"
                  value={tokenA}
                  onChange={setTokenA}
                />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <div className="flex justify-between mb-3 items-center">
                  <label className="text-base font-semibold text-foreground">
                    Liquidity Concentration Level
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10000"
                    step="1"
                    value={A0}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) setA0(Math.min(10000, Math.max(2, val)));
                    }}
                    className="w-24 text-right text-2xl font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#00ffff] focus:outline-none focus:border-[#00ffff]"
                  />
                </div>
                <input
                  type="range"
                  min="2"
                  max="1000"
                  value={Math.min(1000, A0)}
                  onChange={(e) => setA0(Number(e.target.value))}
                  className="w-full accent-[#00ffff]"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>2</span>
                  <span className="text-muted-foreground/70">
                    Higher = more stable
                  </span>
                  <span>1000+</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="flex flex-col gap-4 h-full">
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <TokenSelector
                  label="Token B Address (DeFi)"
                  value={tokenB}
                  onChange={setTokenB}
                />
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                <div className="flex justify-between mb-3 items-center">
                  <label className="text-base font-semibold text-foreground">
                    Liquidity Concentration Level
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10000"
                    step="1"
                    value={A1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) setA1(Math.min(10000, Math.max(2, val)));
                    }}
                    className="w-24 text-right text-2xl font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#ff00ff] focus:outline-none focus:border-[#ff00ff]"
                  />
                </div>
                <input
                  type="range"
                  min="2"
                  max="1000"
                  value={Math.min(1000, A1)}
                  onChange={(e) => setA1(Number(e.target.value))}
                  className="w-full accent-[#ff00ff]"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>2</span>
                  <span className="text-muted-foreground/70">
                    Higher = more stable
                  </span>
                  <span>1000+</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Soft Peg Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            <div className="lg:col-span-1">
                <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                    <div className="flex justify-between mb-3 items-center">
                        <label className="text-base font-semibold text-foreground">
                            Soft Peg (Token A)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="0.9999"
                            step="0.0001"
                            value={softPegA}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) setSoftPegA(Math.min(0.9999, Math.max(0, val)));
                            }}
                            className="w-28 text-right text-2xl font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#00ffff] focus:outline-none focus:border-[#00ffff]"
                        />
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="0.9999"
                        step="0.0001"
                        value={Math.min(0.9999, softPegA)}
                        onChange={(e) => setSoftPegA(Number(e.target.value))}
                        className="w-full accent-[#00ffff]"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0</span>
                        <span>Depeg Fee applied when price &lt; {softPegA.toFixed(4)}</span>
                        <span>0.9999</span>
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1">
                <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
                    <div className="flex justify-between mb-3 items-center">
                        <label className="text-base font-semibold text-foreground">
                            Soft Peg (Token B)
                        </label>
                        <input
                            type="number"
                            min="0"
                            max="0.9999"
                            step="0.0001"
                            value={softPegB}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) setSoftPegB(Math.min(0.9999, Math.max(0, val)));
                            }}
                            className="w-28 text-right text-2xl font-bold bg-transparent border border-border/50 rounded px-2 py-0.5 text-[#ff00ff] focus:outline-none focus:border-[#ff00ff]"
                        />
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="0.9999"
                        step="0.0001"
                        value={Math.min(0.9999, softPegB)}
                        onChange={(e) => setSoftPegB(Number(e.target.value))}
                        className="w-full accent-[#ff00ff]"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0</span>
                        <span>Depeg Fee applied when price &lt; {softPegB.toFixed(4)}</span>
                        <span>0.9999</span>
                    </div>
                </div>
            </div>
        </div>

        <Button
          onClick={handleCreatePool}
          disabled={isPending || isConfirming || !tokenA || !tokenB}
          className="w-full px-4 py-6 text-lg font-bold rounded-xl bg-linear-to-r from-[#00ffff] to-[#ff00ff] text-black hover:opacity-90 transition-opacity dark:text-white dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff]"
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
