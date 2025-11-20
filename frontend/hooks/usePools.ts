'use client';

import { usePublicClient } from 'wagmi';
import { useEffect, useState } from 'react';
import { DEPLOYED_POOL } from '../config/chains';
import { getTokenInfo, type TokenInfo } from '../lib/tokens';

export interface Pool {
  token0: string;
  token1: string;
  poolAddress: string;
  A0: bigint;
  A1: bigint;
  baseFee: bigint;
  kinkingFee: bigint;
  token0Info?: TokenInfo;
  token1Info?: TokenInfo;
}

type Address = `0x${string}`;

type PoolCreatedLog = {
  args: {
    token0: Address;
    token1: Address;
    pool: Address;
    A0: bigint;
    A1: bigint;
    baseFee: bigint;
    kinkingFee: bigint;
  };
};

function formatPoolEntry(params: {
  token0: string;
  token1: string;
  poolAddress: string;
  A0: bigint;
  A1: bigint;
  baseFee: bigint;
  kinkingFee: bigint;
}): Pool {
  const token0Lower = params.token0.toLowerCase();
  const token1Lower = params.token1.toLowerCase();
  return {
    token0: token0Lower,
    token1: token1Lower,
    poolAddress: params.poolAddress,
    A0: params.A0,
    A1: params.A1,
    baseFee: params.baseFee,
    kinkingFee: params.kinkingFee,
    token0Info: getTokenInfo(token0Lower),
    token1Info: getTokenInfo(token1Lower),
  };
}

export function usePools(factoryAddress: string) {
  const publicClient = usePublicClient();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !factoryAddress) {
      // If no factory address, try to use deployed pool directly
      if (DEPLOYED_POOL.address) {
        setPools([
          formatPoolEntry({
            token0: DEPLOYED_POOL.token0,
            token1: DEPLOYED_POOL.token1,
            poolAddress: DEPLOYED_POOL.address,
            A0: BigInt(DEPLOYED_POOL.A0),
            A1: BigInt(DEPLOYED_POOL.A1),
            baseFee: BigInt(DEPLOYED_POOL.baseFee),
            kinkingFee: BigInt(DEPLOYED_POOL.kinkingFee),
          }),
        ]);
      }
      setLoading(false);
      return;
    }

    async function fetchPools() {
      try {
        // First, add the deployed pool if it exists
        const poolList: Pool[] = [];

        if (DEPLOYED_POOL.address) {
          poolList.push(
            formatPoolEntry({
              token0: DEPLOYED_POOL.token0,
              token1: DEPLOYED_POOL.token1,
              poolAddress: DEPLOYED_POOL.address,
              A0: BigInt(DEPLOYED_POOL.A0),
              A1: BigInt(DEPLOYED_POOL.A1),
              baseFee: BigInt(DEPLOYED_POOL.baseFee),
              kinkingFee: BigInt(DEPLOYED_POOL.kinkingFee),
            })
          );
        }

        // Get logs for PoolCreated events from factory
        try {
          const logs = (await publicClient.getLogs({
            address: factoryAddress as `0x${string}`,
            event: {
              type: 'event',
              name: 'PoolCreated',
              inputs: [
                { type: 'address', indexed: true, name: 'token0' },
                { type: 'address', indexed: true, name: 'token1' },
                { type: 'address', indexed: true, name: 'pool' },
                { type: 'uint256', indexed: false, name: 'A0' },
                { type: 'uint256', indexed: false, name: 'A1' },
                { type: 'uint256', indexed: false, name: 'baseFee' },
                { type: 'uint256', indexed: false, name: 'kinkingFee' },
              ],
            },
          })) as PoolCreatedLog[];

          // Add pools from events, avoiding duplicates
          const existingAddresses = new Set(poolList.map((p) => p.poolAddress.toLowerCase()));

          logs.forEach((log) => {
            const poolAddress = log.args.pool.toLowerCase();
            if (!existingAddresses.has(poolAddress)) {
              poolList.push(
                formatPoolEntry({
                  token0: log.args.token0,
                  token1: log.args.token1,
                  poolAddress: log.args.pool,
                  A0: log.args.A0,
                  A1: log.args.A1,
                  baseFee: log.args.baseFee,
                  kinkingFee: log.args.kinkingFee,
                })
              );
              existingAddresses.add(poolAddress);
            }
          });
        } catch (logError) {
          console.warn('Could not fetch pools from events, using deployed pool only:', logError);
        }

        setPools(poolList);
      } catch (error) {
        console.error('Error fetching pools:', error);
        // Fallback to deployed pool if available
        if (DEPLOYED_POOL.address) {
          setPools([
            formatPoolEntry({
              token0: DEPLOYED_POOL.token0,
              token1: DEPLOYED_POOL.token1,
              poolAddress: DEPLOYED_POOL.address,
              A0: BigInt(DEPLOYED_POOL.A0),
              A1: BigInt(DEPLOYED_POOL.A1),
              baseFee: BigInt(DEPLOYED_POOL.baseFee),
              kinkingFee: BigInt(DEPLOYED_POOL.kinkingFee),
            }),
          ]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPools();
  }, [publicClient, factoryAddress]);

  return { pools, loading };
}

