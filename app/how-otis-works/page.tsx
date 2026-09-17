import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import PrintButton from "./PrintButton";
import styles from "./journey.module.css";

export const metadata: Metadata = {
  title: "How Otis works | Wavelength",
  description:
    "Follow a team through Otis: from private reflection and shared patterns to a practical Team Behaviour Agreement and 30-day plan.",
  alternates: {
    canonical: "https://wavelength-app-five.vercel.app/how-otis-works",
  },
};

type JourneyShotProps = {
  src: string;
  width: number;
  height: number;
  alt: string;
  label?: string;
  title: string;
  children: ReactNode;
  className?: string;
  sizes?: string;
};

function JourneyShot({
  src,
  width,
  height,
  alt,
  label,
  title,
  children,
  className = "",
  sizes = "(max-width: 760px) 92vw, 520px",
}: JourneyShotProps) {
  return (
    <figure className={[styles.shot, className].filter(Boolean).join(" ")}>
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={styles.imageLink}
        aria-label={"Open full-size example: " + title}
      >
        <Image
          src={src}
          width={width}
          height={height}
          sizes={sizes}
          quality={90}
          alt={alt}
          className={styles.screenshot}
        />
        <span className={styles.zoomHint}>Open full size ↗</span>
      </a>
      <figcaption className={styles.caption}>
        {label && <span className={styles.captionLabel}>{label}</span>}
        <h3>{title}</h3>
        <p>{children}</p>
      </figcaption>
    </figure>
  );
}

function Chapter({
  id,
  number,
  eyebrow,
  title,
  summary,
  children,
}: {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.chapter}>
      <div className={styles.chapterMarker} aria-hidden="true">
        {number}
      </div>
      <header className={styles.chapterHeader}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <p className={styles.chapterSummary}>{summary}</p>
      </header>
      {children}
    </section>
  );
}

export default function HowOtisWorksPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>The Otis team journey</p>
          <h1>
            From private reflection to a team agreement people can{" "}
            <em>actually use.</em>
          </h1>
          <p className={styles.heroLead}>
            Otis helps a team see how safe it feels to belong, speak freely,
            and innovate—then turns that insight into specific behaviours the
            team can practise together.
          </p>
          <div className={styles.heroActions}>
            <a href="#start" className={styles.primaryAction}>
              Follow the journey
            </a>
            <PrintButton />
          </div>
          <p className={styles.betaNote}>
            Screens are illustrative of the current beta and may evolve.
          </p>
        </div>

        <div className={styles.heroVisual} aria-label="The three depths of psychological safety">
          <div className={styles.heroImageFrame}>
            <Image
              src="/otis-journey/06-safety-depths.png"
              width={522}
              height={761}
              sizes="(max-width: 760px) 82vw, 430px"
              quality={92}
              priority
              alt="Otis illustration showing three depths of psychological safety: safe to belong, safe to speak freely, and safe to innovate."
              className={styles.heroImage}
            />
          </div>
          <div className={[styles.depthNote, styles.depthNoteOne].join(" ")}>Belong</div>
          <div className={[styles.depthNote, styles.depthNoteTwo].join(" ")}>Speak freely</div>
          <div className={[styles.depthNote, styles.depthNoteThree].join(" ")}>Innovate</div>
        </div>
      </section>

      <section className={styles.route} aria-label="Otis journey at a glance">
        <div>
          <span>Private input</span>
          <p>Each person reflects in their own space.</p>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>Shared patterns</span>
          <p>The team sees themes, never named answers.</p>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>Team-owned practice</span>
          <p>Insight becomes an agreement and routine.</p>
        </div>
      </section>

      <nav className={styles.chapterNav} aria-label="Journey chapters">
        <a href="#start">01 Start</a>
        <a href="#reflect">02 Reflect</a>
        <a href="#patterns">03 Patterns</a>
        <a href="#focus">04 Focus</a>
        <a href="#behaviours">05 Behaviours</a>
        <a href="#agreement">06 Agreement</a>
        <a href="#practice">07 Practice</a>
      </nav>

      <div className={styles.story}>
        <Chapter
          id="start"
          number="01"
          eyebrow="Set up and invite"
          title="Bring the team into one shared journey."
          summary="A consultant, manager, facilitator, or team lead creates the team, adds its members, and sends each person a private invitation."
        >
          <div className={styles.mosaicStart}>
            <JourneyShot
              src="/otis-journey/01-account.png"
              width={802}
              height={647}
              alt="Wavelength sign-in and account creation screen."
              label="Consultant view"
              title="Create the account"
            >
              The person guiding the process creates a Wavelength account and
              starts a team.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/02-team-roster.png"
              width={935}
              height={420}
              alt="Otis team dashboard showing a team roster and invitation status."
              label="Consultant view"
              title="Add the team"
              className={styles.wideShot}
              sizes="(max-width: 760px) 92vw, 760px"
            >
              A simple roster shows who has been invited and who has completed
              the assessment—without exposing anyone&apos;s answers.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/03-private-invitation-redacted.png"
              width={1958}
              height={804}
              alt="Example email inviting a team member to begin a private Otis assessment; the private link is redacted."
              label="Team member view"
              title="Receive a private link"
              className={styles.wideShot}
              sizes="(max-width: 760px) 92vw, 760px"
            >
              Every member receives their own secure invitation. The example
              link shown here has been deliberately redacted.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/04-assessment-intro.png"
              width={746}
              height={448}
              alt="Otis introducing a private team assessment to a participant."
              label="Team member view"
              title="Meet Otis"
            >
              Otis explains what the conversation will cover before the first
              question appears.
            </JourneyShot>
          </div>
        </Chapter>

        <Chapter
          id="reflect"
          number="02"
          eyebrow="Individual assessment"
          title="Make space for honest answers."
          summary="Each person completes a guided assessment about their role, the team’s purpose, how work happens, and three levels of psychological safety."
        >
          <div className={styles.reflectLayout}>
            <JourneyShot
              src="/otis-journey/05-privacy-choice.png"
              width={491}
              height={230}
              alt="Otis privacy choice offering summaries only or short non-attributed exact excerpts."
              label="Before the assessment"
              title="Choose how words may be used"
            >
              Summaries are the default. A member can separately allow short,
              non-attributed exact excerpts—and can change that choice later.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/07-private-assessment.png"
              width={1025}
              height={617}
              alt="An Otis assessment question with a response scale."
              label="Private reflection"
              title="Respond individually"
              className={styles.wideShot}
              sizes="(max-width: 760px) 92vw, 720px"
            >
              Members respond on their own, so the team picture is built from
              independent perspectives rather than a public group discussion.
            </JourneyShot>
          </div>
          <aside className={styles.principle}>
            <span>The principle</span>
            <p>
              Otis asks about behaviour and experience—not who is “the
              problem.” That keeps the work specific, fair, and useful.
            </p>
          </aside>
        </Chapter>

        <Chapter
          id="patterns"
          number="03"
          eyebrow="Results and sense-checking"
          title="Turn many viewpoints into one team picture."
          summary="Otis looks across the team’s responses for agreement, differences, and patterns in shared purpose and psychological safety."
        >
          <div className={styles.splitViews}>
            <JourneyShot
              src="/otis-journey/08-team-patterns.png"
              width={735}
              height={500}
              alt="Otis consultant dashboard summarising a team’s psychological safety patterns."
              label="Consultant view"
              title="See the team-level pattern"
            >
              The team report brings the three safety levels together without
              turning individual responses into a performance scorecard.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/09-member-results.png"
              width={515}
              height={572}
              alt="A team member reviewing Otis results and giving feedback on the interpretation."
              label="Team member view"
              title="Check Otis&apos;s interpretation"
            >
              Each member sees the result and can say whether Otis has read the
              team accurately. The interpretation is a starting point, not a
              verdict.
            </JourneyShot>
          </div>
        </Chapter>

        <Chapter
          id="focus"
          number="04"
          eyebrow="One area to improve"
          title="Focus the conversation where it can matter most."
          summary="Rather than hand the team an overwhelming list, Otis identifies one area of psychological safety to explore more deeply."
        >
          <div className={styles.splitViews}>
            <JourneyShot
              src="/otis-journey/10-focus-area.png"
              width={536}
              height={478}
              alt="Otis introducing one psychological safety focus area."
              label="Shared focus"
              title="Name one opportunity"
            >
              The next activity starts from a clear, bounded opportunity the
              whole team can understand.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/11-private-reflection.png"
              width={542}
              height={572}
              alt="A private Otis conversation asking for a situation or story behind the focus area."
              label="Private reflection"
              title="Understand the situations behind it"
            >
              Members privately describe what gets in the way. Otis steers the
              reflection toward situations and observable behaviour, not blame.
            </JourneyShot>
          </div>
        </Chapter>

        <Chapter
          id="behaviours"
          number="05"
          eyebrow="From insight to action"
          title="Translate the issue into behaviour people can see."
          summary="Every member contributes examples of what the team should ALWAYS do—and what it should NEVER do—to make the focus area safer."
        >
          <div className={styles.boardSequence}>
            <JourneyShot
              src="/otis-journey/12-behaviour-board-start.png"
              width={522}
              height={593}
              alt="An empty Otis Team Agreement board with ALWAYS and NEVER columns."
              label="Step one"
              title="Start with a blank behaviour board"
            >
              The two-column prompt makes the desired culture concrete and easy
              to discuss.
            </JourneyShot>
            <div className={styles.sequenceArrow} aria-hidden="true">→</div>
            <JourneyShot
              src="/otis-journey/13-behaviour-board-complete.png"
              width={507}
              height={550}
              alt="A completed Otis Team Agreement board with example ALWAYS and NEVER behaviours."
              label="Step two"
              title="Contribute specific examples"
            >
              Specific actions—what someone could actually notice in a
              meeting—are more useful than broad values alone.
            </JourneyShot>
          </div>
        </Chapter>

        <Chapter
          id="agreement"
          number="06"
          eyebrow="Draft and decide"
          title="Otis drafts. The team owns the final agreement."
          summary="Otis brings the most useful contributions together into a preliminary Team Behaviour Agreement and a 30-day roadmap."
        >
          <div className={styles.agreementFeature}>
            <JourneyShot
              src="/otis-journey/14-agreement-preview.png"
              width={535}
              height={597}
              alt="Consultant preview of an Otis Team Agreement and 30-day roadmap."
              label="Consultant preview"
              title="Review the draft before release"
            >
              The facilitator can inspect the draft and supporting materials
              before the team receives them.
            </JourneyShot>
            <div className={styles.ownershipCopy}>
              <p className={styles.eyebrow}>A draft—not a decree</p>
              <h3>The agreement only works if it sounds like the team.</h3>
              <p>
                The team reviews the language together, changes what does not
                fit, and agrees how it will put the behaviours into practice.
                Otis organises the input; people make the commitment.
              </p>
              <ul>
                <li>Review the proposed ALWAYS and NEVER behaviours</li>
                <li>Edit language so it is clear and observable</li>
                <li>Choose how to respond when the agreement is tested</li>
                <li>Commit to a 30-day period of practice</li>
              </ul>
            </div>
          </div>
        </Chapter>

        <Chapter
          id="practice"
          number="07"
          eyebrow="The 30-day game plan"
          title="Give the agreement a life after the workshop."
          summary="The final package is not one static report. It is a small set of practical tools that help the team notice, discuss, and reinforce its agreement."
        >
          <div className={styles.artifactGrid}>
            <JourneyShot
              src="/otis-journey/15-team-agreement.png"
              width={533}
              height={642}
              alt="Example Otis 30-Day Game Plan showing a Team Behaviour Agreement."
              label="Example 1"
              title="The Team Behaviour Agreement"
            >
              A concise record of the team&apos;s focus and the ALWAYS and NEVER
              behaviours it has agreed to practise.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/16-response-protocols.png"
              width={552}
              height={562}
              alt="Example strategies for responding to ALWAYS and NEVER behaviours."
              label="Example 2"
              title="How to respond to ALWAYS and NEVER behaviours"
            >
              The team chooses constructive signals for a slip—and simple ways
              to recognise the behaviour it wants more of.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/17-team-check-in.png"
              width={538}
              height={535}
              alt="Example Otis team check-in cadence and 30-day commitment."
              label="Example 3"
              title="The recurring team check-in"
            >
              The group decides when it will check in, where that conversation
              belongs, and who will facilitate it.
            </JourneyShot>
            <JourneyShot
              src="/otis-journey/18-meeting-agenda.png"
              width={558}
              height={631}
              alt="Example Otis meeting protocol with appreciation and improvement prompts."
              label="Example 4"
              title="A practical meeting protocol"
            >
              A repeatable agenda makes room for appreciation, honest review,
              unresolved patterns, and one improvement to try next.
            </JourneyShot>
          </div>

          <div className={styles.reviewPanel}>
            <span aria-hidden="true">30</span>
            <div>
              <p className={styles.eyebrow}>Review and renew</p>
              <h3>After 30 days, the team looks at what changed.</h3>
              <p>
                The review date gives the team a natural moment to keep what is
                working, adjust what is not, and renew the agreement for the
                next stretch of work.
              </p>
            </div>
          </div>
        </Chapter>
      </div>

      <section className={styles.privacyPanel} aria-labelledby="privacy-heading">
        <div>
          <p className={styles.eyebrow}>Privacy by design</p>
          <h2 id="privacy-heading">The team sees patterns—not named answers.</h2>
        </div>
        <div className={styles.privacyCopy}>
          <p>
            Otis stores participant details separately from assessment
            responses. A consultant can see participation and completion, but
            should not see a name attached to a particular answer.
          </p>
          <p>
            Team materials use summaries by default. Short exact excerpts can
            appear only after a member makes a separate affirmative choice,
            and those excerpts are never attached to their name.
          </p>
          <Link href="/privacy">Read the beta privacy notice →</Link>
        </div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.eyebrow}>Ready to begin?</p>
        <h2>Help your team turn honest reflection into better ways of working.</h2>
        <div className={styles.heroActions}>
          <Link href="/login?mode=signup" className={styles.primaryAction}>
            Create an account
          </Link>
          <a
            href="mailto:contact@wavelength.team?subject=I%27d%20like%20to%20learn%20more%20about%20Otis"
            className={styles.textAction}
          >
            Talk with Wavelength →
          </a>
        </div>
      </section>
    </main>
  );
}
