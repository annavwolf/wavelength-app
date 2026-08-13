import Link from "next/link";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export default function PrivacyNoticePage() {
  return (
    <main className="px-6 py-16">
      <article className="max-w-3xl mx-auto prose-like space-y-6 leading-relaxed">
        <Link href="/" className="text-sm text-[var(--color-grey)]">← Back</Link>
        <div>
          <p className="text-sm text-[var(--color-grey)]">Otis beta participant privacy notice · {PRIVACY_NOTICE_VERSION}</p>
          <h1 className="text-4xl mt-2" style={{ fontFamily: "Playfair Display, serif" }}>Your privacy in the Otis beta</h1>
        </div>
        <p>Otis helps teams reflect on psychological safety and collaboration. This notice explains what is collected when you take part in a beta assessment, why it is used, and the choices you have.</p>
        <section>
          <h2 className="text-2xl mb-2">What Otis collects</h2>
          <p>Otis stores your name and email separately from your assessment responses. It stores your responses, team role, and, where available, time zone. If you choose to provide a broad work location, Otis uses a recognised city and country to set that time zone automatically where it can; it does not require a street address. The active interview does not request age, gender identity, ethnicity, nationality, or other demographic data.</p>
        </section>
        <section>
          <h2 className="text-2xl mb-2">How team materials are created</h2>
          <p>Team reports are designed to show patterns rather than identify contributors. Your consultant can see whether people have participated and completed the assessment, but should not see a name linked to a particular response. Summaries and paraphrases are the default. Exact excerpts require your separate, affirmative choice and are never attached to your name.</p>
          <p>Small teams and distinctive details can still make a person recognisable. Please avoid including other people&apos;s private information or unnecessary identifying details in free-text answers.</p>
        </section>
        <section>
          <h2 className="text-2xl mb-2">AI and voice input</h2>
          <p>Otis uses external AI services to help analyse de-identified team material. Before external processing, the application removes common direct identifiers such as known participant names, email addresses, phone numbers, handles, and links where possible. This does not guarantee that all contextual details in free text are non-identifying.</p>
          <p>Enhanced audio is optional. When it is available and you opt in, Otis uses Deepgram to turn Otis&apos;s text into speech and a recording you choose to make into an editable transcript. Otis does not record or retain raw microphone audio: it holds the recording only in memory long enough to request a transcript, then discards it. Otis stores only the text you choose to submit.</p>
          <p>Deepgram is an external processor. It may handle request data under its own service terms and privacy practices, including in locations outside your country. You can use text-only input instead, and can change this choice from your profile.</p>
        </section>
        <section>
          <h2 className="text-2xl mb-2">Your choices and withdrawal</h2>
          <p>You must acknowledge this notice before the interview can start. That one acknowledgement covers the beta journey, including the Results &amp; Team Agreement Activity. Before you share stories or behaviours in that activity, Otis asks you to confirm or change your exact-word setting; that is not a second privacy acknowledgement unless this notice changes. The current beta-0.5 notice replaces beta-0.4 because the optional audio processor changed to Deepgram, so participants who acknowledged an earlier version must acknowledge this one before continuing. You can choose summaries only or allow short non-attributed exact excerpts, and change that choice later. You may ask to withdraw future use of your information through your consultant. Once a team report has been generated, it may not be possible to remove material already included in that report.</p>
        </section>
        <section>
          <h2 className="text-2xl mb-2">Retention and questions</h2>
          <p>Beta participant data is reviewed for deletion 12 months after the relevant team&apos;s beta participation ends. For questions about this beta, technical support, or a withdrawal request, email <a href="mailto:contact@wavelength.team?subject=Otis%20privacy%20or%20support%20question" className="underline text-[var(--color-purple)]">contact@wavelength.team</a>. You can also contact the consultant who invited you.</p>
        </section>
      </article>
    </main>
  );
}
