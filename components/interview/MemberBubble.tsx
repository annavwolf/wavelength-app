// Displays the member's own submitted text as a persistent right-aligned bubble,
// mirroring Otis's ChatBubble on the left. Shown after a submission so the
// member can see their answer stayed visible while Otis continues.
export default function MemberBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end mb-4">
      <div
        className="rounded-2xl px-5 py-3 max-w-[520px] text-sm leading-relaxed text-white"
        style={{ background: "var(--color-navy)" }}
      >
        <p>{children}</p>
      </div>
    </div>
  );
}
