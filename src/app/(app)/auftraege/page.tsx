import { getOrders } from "@/actions/orders";
import { OrderList } from "@/components/orders/order-list";
import { CreateOrderButton } from "@/components/orders/create-order-button";

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
    <div className="flex flex-col min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Aufträge</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} Aufträge</p>
        </div>
        <CreateOrderButton />
      </div>
      <div className="flex-1 p-4 md:p-6">
        <OrderList orders={orders} />
      </div>
    </div>
  );
}
