// Minimal hand-rolled icons (no icon library dependency) for the
// interview's voice controls.

export function SpeakerIcon({
  muted = false,
  className = "h-4 w-4",
}: {
  muted?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon
        points="4 9 4 15 8 15 13 19 13 5 8 9 4 9"
        fill="currentColor"
        stroke="none"
      />
      {muted ? (
        <path d="M18 9l-4 4m0-4l4 4" />
      ) : (
        <>
          <path d="M16.2 8.5a4.8 4.8 0 0 1 0 7" />
          <path d="M18.8 6a8 8 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

export function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}
