import { JournalArticle } from '@/components/info';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <JournalArticle id={(await params).id} />;
}
