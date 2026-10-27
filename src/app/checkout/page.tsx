import { Suspense } from 'react';
import { Checkout } from '@/components/checkout';
export default function Page() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
