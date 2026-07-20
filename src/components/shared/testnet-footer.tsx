/**
 * Permanent demo disclaimer. Pacy mints real tokens on a real chain — just not
 * mainnet — so the UI has to say so everywhere, all the time.
 */
export function TestnetFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface-raised px-4 py-3 text-center text-xs text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-info-strong"
        />
        Cardano Preprod Testnet — demo. Not for real prescriptions.
      </span>
    </footer>
  );
}
