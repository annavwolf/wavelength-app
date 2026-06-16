import ChatBubble from "@/components/interview/ChatBubble";

export default function LandingStep({ onAdvance }: { onAdvance: () => void }) {
  return (
    <div>
      <img
        src="/logo-octopus.png"
        alt=""
        className="h-20 w-auto mx-auto mb-8"
      />

      <ChatBubble>
        Hello — I&apos;m Wavelength. I&apos;m an AI that specialises in
        virtual teamwork and psychological safety.
      </ChatBubble>
      <ChatBubble>
        I was created and trained by Dr. Anna Wolf, an organisational
        psychologist who has spent her career studying how people work
        together — in healthcare, military operations, and spaceflight,
        among other settings.
      </ChatBubble>
      <ChatBubble>
        My purpose is to help remote and hybrid teams understand what&apos;s
        getting in the way of working well together — and to open up honest
        conversations about how to change that.
      </ChatBubble>
      <ChatBubble>
        Before we get started, I want to show you how this whole process
        works. It won&apos;t take long — and I think it&apos;ll make
        everything that follows feel a lot clearer.
      </ChatBubble>

      <button type="button" onClick={onAdvance} className="btn-primary mt-6">
        Show me how this works
      </button>
    </div>
  );
}
