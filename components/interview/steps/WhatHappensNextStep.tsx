import ChatBubble from "@/components/interview/ChatBubble";
import type { Member } from "@/types/database";

export default function WhatHappensNextStep({
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
    <div className="flex flex-col items-center pt-8">
      <img
        src="/octopus-logo.png"
        alt=""
        aria-hidden="true"
        className="otis-float h-32 w-auto mb-10"
      />

      <div className="w-full max-w-xl">
        <ChatBubble readAloud={readAloud} hideAvatar centered>
          {`Thanks, ${firstName}, that's all I need! Here's what happens next. I'm going to speak with everyone on your team and run some analysis. The next time we meet, we'll discuss the results — to pinpoint where psychological safety is lacking, and how to build it up.`}
        </ChatBubble>

        <div className="flex justify-center mt-8">
          <button type="button" onClick={onAdvance} className="btn-primary">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
