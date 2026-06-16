import ChatBubble from "@/components/interview/ChatBubble";

export default function PsIntroStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Before we look at how your team is doing, I want to explain what
        I&apos;m measuring and why it matters.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Psychological safety is the degree to which people on a team feel
        safe to speak up, take risks, and be honest — without fear of being
        judged or punished for it. It&apos;s not the same as trust, which is
        something you feel one-on-one with another person. Psychological
        safety is felt at the group level — it&apos;s about what&apos;s
        possible when the whole team is in the room.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Research shows it&apos;s the strongest predictor of how well a team
        performs. And in virtual teams especially, it&apos;s harder to build
        and easier to lose — because without the informal moments that
        happen in person, people default to caution.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Think of it like depth. Near the surface, it&apos;s safe to show up
        and belong. Deeper down, you can start to say the harder things. At
        the deepest level, teams can challenge each other, take real risks,
        and do things that aren&apos;t possible in the shallows — but only
        if people feel safe enough to go there.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        I want to find out how deep your team can go right now.
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-6">
        I understand
      </button>
    </div>
  );
}
