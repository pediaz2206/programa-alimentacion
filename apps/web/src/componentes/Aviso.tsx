export function Aviso({ texto }: { texto: string }) {
  return (
    <div className="aviso">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.5l6.5 12h-13z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.2v3.4M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{texto}</span>
    </div>
  );
}
