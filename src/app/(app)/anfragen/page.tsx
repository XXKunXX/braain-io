import { getRequests } from "@/actions/requests";
import { getContacts } from "@/actions/contacts";
import { RequestList } from "@/components/requests/request-list";

export default async function AnfragenPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [requests, contacts, params] = await Promise.all([
    getRequests(),
    getContacts(),
    searchParams,
  ]);
  const initialStatus = params.status;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Anfragen</h1>
        <p className="text-sm text-gray-400 mt-0.5">{requests.length} Anfragen</p>
      </div>
      <RequestList requests={requests} initialStatus={initialStatus} contacts={contacts} />
    </div>
  );
}
