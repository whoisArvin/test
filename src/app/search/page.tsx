import { Suspense } from 'react';
import { SearchResults } from '@/components/search-results';
export default function Page() {
  return (
    <Suspense fallback={<div className="container page-pad">در حال جستجو…</div>}>
      <SearchResults />
    </Suspense>
  );
}
