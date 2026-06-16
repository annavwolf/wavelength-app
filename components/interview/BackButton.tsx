export default function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-[var(--color-grey)] mb-6 inline-block hover:text-[var(--color-ink)]"
    >
      ← Back
    </button>
  );
}
