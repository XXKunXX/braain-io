export default function BaustelleLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="md:hidden max-w-lg mx-auto px-4 py-6 animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded mb-6" />
        <div className="h-8 w-56 bg-gray-200 rounded mb-1" />
        <div className="h-4 w-32 bg-gray-100 rounded mb-6" />
        <div className="space-y-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 flex items-start gap-3">
              <div className="w-5 h-5 bg-gray-100 rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-40 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-14 bg-gray-200 rounded-2xl" />
          <div className="h-14 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
