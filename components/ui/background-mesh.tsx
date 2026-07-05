export default function BackgroundMesh() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      <div
        className="absolute left-0 top-1/4 h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-3xl animate-blob"
        style={{ animationDuration: '18s', animationDelay: '0s' }}
      />
      <div
        className="absolute right-0 top-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-500/20 blur-3xl animate-blob"
        style={{ animationDuration: '22s', animationDelay: '3s' }}
      />
      <div
        className="absolute left-1/2 top-[10%] h-[18rem] w-[18rem] -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl"
      />
    </div>
  );
}
