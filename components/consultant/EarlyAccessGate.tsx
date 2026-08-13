import Link from "next/link";

type Props = {
  feature: string;
  detail?: string;
  compact?: boolean;
};

/**
 * A friendly explanation for a feature that is also protected by a
 * server-side early-access entitlement. It prevents the gated interface from
 * mounting and points the consultant to the safe redemption flow.
 */
export default function EarlyAccessGate({ feature, detail, compact = false }: Props) {
  return (
    <section
      className={`rounded-2xl border border-[var(--color-purple)]/25 bg-[var(--color-purple)]/[0.045] ${compact ? "px-4 py-4" : "px-6 py-7"}`}
      aria-labelledby="early-access-heading"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-purple)]">
        Wavelength beta · early access
      </p>
      <h2 id="early-access-heading" className={compact ? "text-lg" : "text-2xl"}>
        {feature} is not unlocked for this account yet.
      </h2>
      <p className={`max-w-2xl leading-relaxed text-[var(--color-grey)] ${compact ? "mt-2 text-sm" : "mt-3"}`}>
        {detail ?? "Your account can continue to set up teams, invite participants, collect assessments, and view the standard results. Enter an early-access code to unlock this beta feature."}
      </p>
      <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link href="/early-access" className="btn-primary text-center">
          Enter an early-access code
        </Link>
        <a
          href="mailto:contact@wavelength.team?subject=Early%20access%20for%20Otis"
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[var(--color-purple)] underline underline-offset-2"
        >
          Contact Wavelength for access
        </a>
      </div>
    </section>
  );
}
