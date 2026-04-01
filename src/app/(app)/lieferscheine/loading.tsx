export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="animate-pulse space-y-1">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-20 bg-gray-100 rounded" />
      </div>
      <div className="animate-pulse flex gap-2">
        <div className="h-9 flex-1 max-w-xs bg-gray-100 rounded-md" />
        <div className="h-9 w-36 bg-gray-100 rounded-md" />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i !== 7 ? "border-b border-gray-100" : ""}`}>
            <div className="w-7 h-7 rounded-md bg-gray-100 flex-shrink-0" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="hidden md:block w-28 h-4 bg-gray-100 rounded" />
            <div className="hidden md:block w-20 h-5 bg-gray-100 rounded-full" />
            <div className="hidden md:block w-24 h-4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
