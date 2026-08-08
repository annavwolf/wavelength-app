import ChatBubble from "@/components/interview/ChatBubble";
import type { Member } from "@/types/database";

export default function PsWhyStep({
  member,
  readAloud,
  onAdvance,
}: {
  member: Member;
  readAloud: boolean;
  onAdvance: () => void;
}) {
  const firstName = member.display_name.split(" ")[0];

  return (
    <div>
      <ChatBubble
        readAloud={readAloud}
        speakText={`Thanks, ${firstName}. Let's talk now about Psychological Safety. I define this as the shared sense that it's safe to be oneself, speak up, and take calculated risks without fearing backlash.`}
      >
        Thanks, {firstName}. Let&apos;s talk now about{" "}
        <strong>Psychological Safety</strong>. I define this as{" "}
        <strong>
          the shared sense that it&apos;s safe to be oneself, speak up, and
          take calculated risks without fearing backlash.
        </strong>
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-8">
        Continue
      </button>
    </div>
  );
}
