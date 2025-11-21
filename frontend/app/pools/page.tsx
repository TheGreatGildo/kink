import { Suspense } from 'react';
import Pools from '../../components/Pools';

export default function PoolsPage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-10">
      <Suspense fallback={<div className="flex justify-center py-20">Loading...</div>}>
        <Pools />
      </Suspense>
    </div>
  );
}
