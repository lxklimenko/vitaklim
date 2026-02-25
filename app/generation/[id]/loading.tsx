export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white animate-pulse">
      <div className="w-full aspect-square bg-white/5" />

      <div className="max-w-4xl mx-auto px-6 mt-6 space-y-4">
        <div className="h-6 w-32 bg-white/5 rounded" />
        <div className="h-24 bg-white/5 rounded-xl" />
        <div className="h-10 w-10 bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}