import ChatBubble from "@/components/interview/ChatBubble";

export default function PsFrameStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        As you go through these statements, try to think about your
        experience on the team broadly — not just with the people you work
        most closely with. It might help to especially think about how you
        feel in full team settings: a shared channel, an all-hands meeting,
        a group call where everyone is present. That&apos;s the
        psychological safety I&apos;m trying to understand.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        For each statement, you&apos;ll choose how much you agree, from
        Strongly Disagree to Strongly Agree.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        There are no right answers. I&apos;m looking for your honest read of
        how things actually are — not how you&apos;d want them to be.
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-6">
        Let&apos;s begin
      </button>
    </div>
  );
}
