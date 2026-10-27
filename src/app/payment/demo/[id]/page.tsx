import { PaymentDemo } from '@/components/payment';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PaymentDemo id={(await params).id} />;
}
