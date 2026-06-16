// Wavelength's side of the conversation — small octopus avatar beside a
// calm message bubble. Member responses (inputs/buttons) render below,
// outside this component.
export default function ChatBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="chat-bubble-in flex items-start gap-3 mb-4">
      <img
        src="/logo-octopus.png"
        alt=""
        className="h-10 w-10 rounded flex-shrink-0 object-cover"
      />
      <div className="card py-3 px-5 max-w-[480px]">
        <p>{children}</p>
      </div>
    </div>
  );
}
