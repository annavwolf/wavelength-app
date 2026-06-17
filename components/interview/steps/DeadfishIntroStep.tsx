import ChatBubble from "@/components/interview/ChatBubble";

export default function DeadfishIntroStep({
  readAloud,
  onAdvance,
}: {
  readAloud: boolean;
  onAdvance: () => void;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Now I want to ask about something a little different — and probably
        more familiar than you&apos;d like.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        Every team has patterns that get in the way. Things that happen
        repeatedly, that most people notice, but that nobody quite picks up
        and deals with. We call these dead fish.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        The name comes from an old saying: if you leave a dead fish on the
        table long enough, everyone stops noticing the smell. These are the
        problems your team has learned to work around — or simply stopped
        talking about.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        I&apos;m going to show you a handful of common patterns I see in
        virtual and remote teams. For each one, I just want to know: is
        this happening on your team right now? And if so, how much of an
        issue is it? There&apos;s no right answer — I&apos;m looking for
        your honest read.
      </ChatBubble>
      <ChatBubble readAloud={readAloud}>
        One important thing: these are about the team as a whole, not about
        any individual person. Think about the patterns — not people.
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-6">
        Show me the patterns
      </button>
    </div>
  );
}
