import { Suspense } from 'react';
import { Account } from '@/components/account';
export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
