"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import {
  NO_HOSTED_AUDIO,
  type HostedAudioCapabilities,
} from "@/lib/otisAudio";

type VoiceInputState = {
  allowed: boolean;
  hostedAudio: HostedAudioCapabilities;
  /** True only while an opted-in participant's hosted-audio capability is checked. */
  hostedAudioLoading: boolean;
  /** An optional self-ID used only as a server-side scope cross-check. */
  memberId?: string;
};

const VoiceInputContext = createContext<VoiceInputState>({
  allowed: false,
  hostedAudio: NO_HOSTED_AUDIO,
  hostedAudioLoading: false,
  memberId: undefined,
});

export function VoiceInputProvider({
  allowed,
  memberId,
  children,
}: {
  allowed: boolean;
  memberId?: string;
  children: React.ReactNode;
}) {
  const [hostedAudio, setHostedAudio] = useState<HostedAudioCapabilities>(NO_HOSTED_AUDIO);
  // Start in the checking state when consent is already known at mount. This
  // prevents the first Otis message from choosing the device voice before the
  // optional service has had a chance to answer.
  const [hostedAudioLoading, setHostedAudioLoading] = useState(allowed);

  // When a participant enables enhanced audio while this provider is already
  // mounted (for example, immediately after the privacy screen), flip to the
  // checking state before child effects can auto-read the first message.
  // This does not block the visible conversation; it only delays audio until
  // the privacy-gated capability probe settles.
  useLayoutEffect(() => {
    if (!allowed) {
      setHostedAudio(NO_HOSTED_AUDIO);
      setHostedAudioLoading(false);
      return;
    }
    setHostedAudio(NO_HOSTED_AUDIO);
    setHostedAudioLoading(true);
  }, [allowed, memberId]);

  // The optional hosted audio service is discovered once per participant
  // session. We never even probe those routes until the participant has
  // explicitly enabled voice input; the server independently rechecks that
  // setting before it contacts Deepgram.
  useEffect(() => {
    if (!allowed) return;

    let cancelled = false;
    void Promise.all([
      fetch("/api/audio/transcribe", { cache: "no-store" }),
      fetch("/api/audio/synthesize", { cache: "no-store" }),
    ])
      .then(async ([transcribe, synthesize]) => {
        const [transcribeData, synthesizeData] = await Promise.all([
          transcribe.ok ? transcribe.json().catch(() => ({})) : Promise.resolve({}),
          synthesize.ok ? synthesize.json().catch(() => ({})) : Promise.resolve({}),
        ]);
        if (!cancelled) {
          setHostedAudio({
            transcription: transcribeData?.available === true,
            synthesis: synthesizeData?.available === true,
          });
          setHostedAudioLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHostedAudio(NO_HOSTED_AUDIO);
          setHostedAudioLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allowed, memberId]);

  return (
    <VoiceInputContext.Provider value={{ allowed, hostedAudio, hostedAudioLoading, memberId }}>
      {children}
    </VoiceInputContext.Provider>
  );
}

export function useVoiceInputAllowed() {
  return useContext(VoiceInputContext).allowed;
}

export function useHostedVoiceInputAvailable() {
  const { allowed, hostedAudio } = useContext(VoiceInputContext);
  return allowed && hostedAudio.transcription;
}

export function useHostedSpeechAvailable() {
  const { allowed, hostedAudio } = useContext(VoiceInputContext);
  return allowed && hostedAudio.synthesis;
}

/**
 * Lets read-aloud wait briefly for the opt-in service check rather than
 * speaking the first line in a device voice by accident.
 */
export function useHostedAudioLoading() {
  const { allowed, hostedAudioLoading } = useContext(VoiceInputContext);
  return allowed && hostedAudioLoading;
}

export function useVoiceParticipantMemberId() {
  return useContext(VoiceInputContext).memberId;
}
