import ChatBubble from "@/components/interview/ChatBubble";

export default function PsIntroOpenStep({
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
        Before we look at how your team is doing, I want to show you what
        I mean by psychological safety. Think of your team like an ocean —
        and how deep into it you feel safe going together.
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-6">
        Take me down
      </button>
    </div>
  );
}
