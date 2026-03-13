import { getRequests } from "@/actions/requests";
import { RequestList } from "@/components/requests/request-list";
import { CreateRequestButton } from "@/components/requests/create-request-button";

export default async function AnfragenPage() {
  const requests = await getRequests();

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Anfragen</h1>
          <p className="text-sm text-gray-500 mt-0.5">{requests.length} Anfragen</p>
        </div>
        <CreateRequestButton />
      </div>
      <div className="flex-1 p-4 md:p-6">
        <RequestList requests={requests} />
      </div>
    </div>
  );
}
