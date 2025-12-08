export function StarqIcon({ className }: { className?: string }) {
  return (
    <span style={{ width: '1em', height: '1em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '2px' }}>
      <img
        src="/starq-q-icon.svg"
        alt="STARQ"
        className={className}
        style={{ width: '1.575em', height: '1.575em', margin: '-0.25em' }}
      />
    </span>
  );
}
