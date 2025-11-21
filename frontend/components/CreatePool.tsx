"use client";

import { useMemo, useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { FACTORY_ADDRESS } from "../config/chains";
import { Button } from "./ui/button";
import { CreateIcon } from "./Icons";
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

  // Fixed Liquidity D for preview visualization
  const D = 2000;

  const { points, equilibriumPoints, priceA0, priceA1 } = useMemo(() => {
    const mid = D / 2;
    const newPoints: { x: number; y: number }[] = [];
    const numSteps = 300;

    // Part 1: Left of equilibrium (x < mid, so y > x, use A1)
    // We need to ensure points are sorted by x for Chart.js to draw lines correctly

    // Generate Part 1 points (x from 0 to mid)
    for (let i = 0; i <= numSteps / 2; i++) {
      const t = i / (numSteps / 2);
      let x = t * mid;
      if (x < 0.01) x = 0.01; // Avoid 0

      const y = get_y_D(A1, 1, [x, 0], D);
      newPoints.push({ x, y });
    }

    // Part 2: Right of equilibrium (x > mid, so x > y, use A0)
    let x = mid;
    // Avoid duplicate point at mid if already added
    if (newPoints.length > 0 && Math.abs(newPoints[newPoints.length - 1].x - x) < 0.001) {
        x += D / 100;
    }

    let y = get_y_D(A0, 1, [x, 0], D);
    let step = D / 100;
    const maxSteps = 500;
    let count = 0;

    // Continue generating points
    while (y > 1 && count < maxSteps) {
      count++;
      // Calculate y first before pushing to ensure valid pair
      y = get_y_D(A0, 1, [x, 0], D);
      newPoints.push({ x, y });

      x += step;
      if (count > 50) step = D / 50;
      if (count > 100) step = D / 20;
    }

    const newEquilibriumPoints = [
      { x: 0, y: 0 },
      { x: Math.max(mid * 2.5, D), y: Math.max(mid * 2.5, D) },
    ];

    // Prices
    const x_a1 = D * 0.25;
    const p_a1 = calculatePrice(x_a1, A1, D);

    const x_a0 = D * 0.75;
    const p_a0 = calculatePrice(x_a0, A0, D);

      return {
      points: newPoints,
      equilibriumPoints: newEquilibriumPoints,
      priceA1: p_a1,
      priceA0: p_a0,
    };
  }, [A0, A1, D]);

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
      {
        label: "Invariant Curve",
        data: points,
        borderColor: "rgb(0, 255, 255)", // Cyan #00ffff
        backgroundColor: "rgba(0, 255, 255, 0.1)",
        showLine: true,
        pointRadius: 1, // Increase from 0 to 1 to make it visible
        borderWidth: 3,
        tension: 0.2,
        spanGaps: true, // Ensure lines are connected if there are any gaps
      },
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
        <CreateIcon className="w-12 h-12 text-[#ff00ff]" />
        <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center">
          Create Kinky Pool
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* Full width graph */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6 w-full overflow-hidden relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-[#00ffff]">
            Kink Curve Preview
          </h3>
            <div className="flex gap-4 text-sm">
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground">Price (A1 Zone)</span>
                <span className="font-mono font-bold text-[#ff00ff]">
                  {priceA1.toFixed(4)}
                </span>
                  </div>
              <div className="flex flex-col items-end">
                <span className="text-muted-foreground">Price (A0 Zone)</span>
                <span className="font-mono font-bold text-[#00ffff]">
                  {priceA0.toFixed(4)}
                </span>
                  </div>
                  </div>
                </div>

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
                      className="w-full accent-[#00ffff]"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      Applied when bringing the pool to Equilibrium
                    </div>
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
                  min="2"
                  max="1000"
                  value={A0}
                  onChange={(e) => setA0(Number(e.target.value))}
                  className="w-full accent-[#00ffff]"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>2</span>
                  <span className="text-muted-foreground/70">
                    More stable when A is heavy
                  </span>
                  <span>1000</span>
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
                  min="2"
                  max="1000"
                  value={A1}
                  onChange={(e) => setA1(Number(e.target.value))}
                  className="w-full accent-[#ff00ff]"
                />
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>2</span>
                  <span className="text-muted-foreground/70">
                    More stable when B is heavy
                  </span>
                  <span>1000</span>
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
