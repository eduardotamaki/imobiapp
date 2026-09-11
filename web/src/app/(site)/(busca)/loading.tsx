export default function Carregando() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <div className="esqueleto h-11 rounded-xl" />
      <div className="mt-4 flex gap-6">
        <div className="esqueleto hidden h-[70vh] w-72 shrink-0 rounded-xl lg:block" />
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="esqueleto aspect-[4/5] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
