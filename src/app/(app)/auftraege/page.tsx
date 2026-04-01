import { getOrders } from "@/actions/orders";
import { OrderList } from "@/components/orders/order-list";

export default async function AuftraegePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const rawOrders = await getOrders(params.status);

  const orders = rawOrders.map((o) => ({
    ...o,
    quote: o.quote ? { ...o.quote, totalPrice: o.quote.totalPrice.toNumber() } : null,
  })) as unknown as typeof rawOrders;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Aufträge</h1>
        <p className="text-sm text-gray-400 mt-0.5">{orders.length} Aufträge</p>
      </div>
      <OrderList orders={orders} />
    </div>
  );
}
