import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getRequest } from "@/actions/requests";
import { getUsers } from "@/actions/users";
import { RequestDetail } from "@/components/requests/request-detail";

export default async function AnfrageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [request, users, clerkUser] = await Promise.all([getRequest(id), getUsers(), currentUser()]);
  if (!request) notFound();

  const userNames = users.map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);
  const currentUserName = clerkUser ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() : undefined;

  const serializedRequest = {
    ...request,
    quotes: request.quotes.map((q) => ({
      ...q,
      totalPrice: q.totalPrice.toNumber(),
      items: q.items.map((item) => ({
        ...item,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        total: item.total.toNumber(),
      })),
    })),
  } as unknown as typeof request;

  return <RequestDetail request={serializedRequest} userNames={userNames} currentUserName={currentUserName} />;
}
