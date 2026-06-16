import ChatBubble from "@/components/interview/ChatBubble";

// Temporary terminal step for this pass — the PS diagnostic and fish
// patterns steps replace this in the next pass.
export default function EndOfPass1Step() {
  return (
    <div>
      <ChatBubble>
        Thank you. That&apos;s a great start. The next part — how safe your
        team feels — is coming next.
      </ChatBubble>
    </div>
  );
}
