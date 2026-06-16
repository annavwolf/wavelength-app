import ChatBubble from "@/components/interview/ChatBubble";

export default function PsIntroCloseStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <img
        src="/octopus-logo.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <ChatBubble readAloud={readAloud}>
        Psychological safety is felt at the group level — it&apos;s about
        what&apos;s possible when the whole team is together. Research shows
        it&apos;s the strongest predictor of how well a team performs, and in
        virtual teams it&apos;s harder to build and easier to lose. So
        here&apos;s what I want to understand:
      </ChatBubble>

      <p
        className="accent text-2xl sm:text-3xl leading-snug mt-6 mb-10"
        style={{ fontFamily: "Playfair Display, serif" }}
      >
        How deep into this ocean does your team feel safe going right now?
      </p>

      <button type="button" onClick={onAdvance} className="btn-primary">
        Let&apos;s find out
      </button>
    </div>
  );
}
