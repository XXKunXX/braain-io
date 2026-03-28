export default function FahrerLoading() {
  return (
    <div className="md:hidden px-4 py-6 max-w-lg mx-auto animate-pulse">
      <div className="mb-5">
        <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
        <div className="h-8 w-48 bg-gray-200 rounded mb-1" />
        <div className="h-3 w-36 bg-gray-200 rounded" />
      </div>
      <div className="bg-white rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="w-8 h-8 bg-gray-100 rounded-lg" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="w-8 h-8 bg-gray-100 rounded-lg" />
      </div>
      <div className="flex gap-2 mb-5">
        {[1, 2, 3].map((i) => <div key={i} className="h-8 w-28 bg-gray-200 rounded-full" />)}
      </div>
      <div className="bg-white rounded-2xl overflow-hidden divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center px-4 py-4 gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-28 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
