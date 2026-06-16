import ChatBubble from "@/components/interview/ChatBubble";

// Temporary terminal step for this pass — the dead fish patterns step
// replaces this in the next pass.
export default function EndOfPass1Step({
  readAloud,
}: {
  readAloud: boolean;
}) {
  return (
    <div>
      <ChatBubble readAloud={readAloud}>
        Thanks for walking through that with me. The next part — some
        common team challenges — is coming soon.
      </ChatBubble>
    </div>
  );
}
