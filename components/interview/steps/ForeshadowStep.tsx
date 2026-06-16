import ChatBubble from "@/components/interview/ChatBubble";

const JOURNEY = [
  "We'll talk about your team's purpose and how you work together.",
  "I'll ask how safe it feels to speak up, take risks, and be yourself on this team.",
  "We'll look at some common team challenges and which ones ring true for you.",
  "Later, once everyone's done, I'll share back what I'm seeing and we'll make sense of it together.",
];

export default function ForeshadowStep({ onAdvance }: { onAdvance: () => void }) {
  return (
    <div>
      <ChatBubble>
        Here&apos;s what this process looks like — and what your involvement
        will be.
      </ChatBubble>
      <ChatBubble>
        Today&apos;s conversation — this first one — will take around 20 to
        30 minutes. You can take a break and come back at any point.
      </ChatBubble>

      <div className="space-y-3 mt-6 mb-8">
        {JOURNEY.map((text, i) => (
          <div key={text} className="card flex items-start gap-4 py-4">
            <span className="bg-[var(--color-navy)] text-white text-sm w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
              {i + 1}
            </span>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAdvance} className="btn-primary">
        I&apos;m ready
      </button>
    </div>
  );
}
