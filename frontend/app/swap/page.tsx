'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import Swap from '../../components/Swap';
import { Button } from '../../components/ui/button';

function SwapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const poolAddress = searchParams.get('pool');

  if (!poolAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">No Pool Selected</h2>
        <p className="text-muted-foreground mb-8">Please select a pool to swap.</p>
        <Button
          onClick={() => router.push('/pools')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Go to Pools
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-10 flex justify-center">
      <Swap poolAddress={poolAddress} />
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20">Loading...</div>}>
      <SwapContent />
    </Suspense>
  );
}

