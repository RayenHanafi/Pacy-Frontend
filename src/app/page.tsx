import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Check,
  CheckCircle2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Stethoscope,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const workflow = [
  {
    step: "01",
    title: "A doctor issues",
    description:
      "A verified doctor creates the prescription and sets exactly how many fills are allowed.",
    icon: Stethoscope,
  },
  {
    step: "02",
    title: "The patient carries",
    description:
      "A rotating QR code gives the patient a simple, private way to share their prescription.",
    icon: QrCode,
  },
  {
    step: "03",
    title: "A pharmacy verifies",
    description:
      "The pharmacy checks the live record and safely spends one fill when medicine is dispensed.",
    icon: Store,
  },
];

const protections = [
  "Cannot be forged",
  "Cannot be over-filled",
  "Cannot be used after expiry",
];

export default function Home() {
  return (
    <main className="overflow-hidden bg-background">
      <header className="relative z-20 border-b border-border-subtle bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 w-full max-w-6xl items-center px-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Pacy home"
          >
            <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-white shadow-sm">
              <Image
                src="/pacy-logo.svg"
                alt=""
                width={40}
                height={40}
                priority
                className="size-full scale-125"
              />
            </span>
            <span>
              <span className="block font-display text-lg font-bold leading-none text-text-strong">
                Pacy
              </span>
              <span className="mt-1 hidden text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-text-muted sm:block">
                Prescription trust network
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm font-medium text-text-muted md:flex">
            <a className="transition-colors hover:text-brand-strong" href="#how-it-works">
              How it works
            </a>
            <a className="transition-colors hover:text-brand-strong" href="#trust">
              Why Pacy
            </a>
          </nav>

          <Button asChild className="ml-auto h-10 rounded-xl px-4 md:ml-8">
            <Link href="/login">
              Sign in
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative isolate">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_76%_25%,rgba(115,179,154,0.28),transparent_35%),radial-gradient(circle_at_5%_0%,rgba(26,163,173,0.13),transparent_28%),linear-gradient(to_bottom,#f6fbfa,white)]"
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-18 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-strong shadow-sm">
              <ShieldCheck aria-hidden className="size-4" />
              Prescription trust, built in
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-text-strong sm:text-5xl lg:text-[3.7rem]">
              One prescription.
              <br />
              One token. <span className="text-brand-strong">One time.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
              Pacy connects doctors, patients, and pharmacies through a secure
              prescription record that cannot be forged, over-filled, or reused
              after expiry.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild className="h-12 rounded-xl px-6 text-base shadow-[0_10px_30px_rgba(16,125,124,0.22)]">
                <Link href="/login">
                  Enter Pacy
                  <ArrowRight aria-hidden className="size-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-xl px-6 text-base">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-muted">
              {protections.map((protection) => (
                <span key={protection} className="inline-flex items-center gap-1.5">
                  <Check aria-hidden className="size-4 text-success-text" strokeWidth={2.5} />
                  {protection}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg lg:mx-0">
            <div
              aria-hidden
              className="absolute -inset-7 -z-10 rounded-[2.5rem] bg-[linear-gradient(135deg,rgba(26,163,173,0.15),rgba(115,179,154,0.24))] blur-2xl"
            />
            <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_24px_70px_rgba(1,67,66,0.14)] backdrop-blur sm:p-6">
              <div className="flex items-center gap-3 border-b border-border-subtle pb-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-success-surface text-success-text">
                  <CheckCircle2 aria-hidden className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-text-muted">
                    Live trust record
                  </p>
                  <p className="mt-0.5 font-display text-lg font-bold text-text-strong">
                    Prescription verified
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-success-surface px-2.5 py-1 text-xs font-semibold text-success-text">
                  Active
                </span>
              </div>

              <div className="grid gap-3 py-5 sm:grid-cols-3">
                {workflow.map(({ title, icon: Icon }, index) => (
                  <div key={title} className="relative rounded-xl bg-surface-raised p-4">
                    <Icon aria-hidden className="size-5 text-brand-strong" />
                    <p className="mt-3 text-xs font-semibold text-text-strong">
                      {index === 0 ? "Issued" : index === 1 ? "Shared" : "Dispensed"}
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-text-muted">
                      {index === 0 ? "Doctor" : index === 1 ? "Patient" : "Pharmacy"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-brand/15 bg-brand-surface p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-strong shadow-sm">
                    <Blocks aria-hidden className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-strong">Anchored on Cardano</p>
                      <span className="size-1.5 rounded-full bg-success" aria-hidden />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      Fill count and validity are independently verifiable, while
                      patient details remain private.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-8 border-y border-border-subtle bg-surface-raised py-20 sm:py-24">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-strong">
              One trusted journey
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.025em] text-text-strong sm:text-4xl">
              Safer at every handoff.
            </h2>
            <p className="mt-4 text-base leading-7 text-text-muted">
              Pacy makes the prescription lifecycle clear for everyone involved,
              without adding friction for the patient.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {workflow.map(({ step, title, description, icon: Icon }) => (
              <article
                key={step}
                className="group rounded-2xl border border-border-subtle bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand-surface text-brand-strong transition-colors group-hover:bg-brand-strong group-hover:text-white">
                    <Icon aria-hidden className="size-6" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-text-muted">{step}</span>
                </div>
                <h3 className="mt-7 font-display text-xl font-bold text-text-strong">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-muted">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="scroll-mt-8 py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
          <div className="brand-gradient relative overflow-hidden rounded-[1.75rem] p-7 text-white shadow-[0_24px_60px_rgba(1,67,66,0.18)] sm:p-10">
            <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full border-[34px] border-white/8" />
            <LockKeyhole aria-hidden className="size-8 text-white" />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              Private by design
            </p>
            <h2 className="mt-3 max-w-md font-display text-3xl font-bold tracking-[-0.025em] text-white sm:text-4xl">
              Clinical details stay private. Trust goes on-chain.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/80 sm:text-base">
              Patient identity and medicine details stay off-chain. Only the proof
              needed to verify the prescription and its remaining fills is anchored
              to Cardano.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-strong">
              Built for confidence
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-[-0.025em] text-text-strong sm:text-4xl">
              One shared source of truth.
            </h2>
            <p className="mt-4 text-base leading-7 text-text-muted">
              Every participant sees the same live prescription state, so the next
              decision is based on what is valid now—not a copy that may be out of date.
            </p>
            <div className="mt-8 space-y-5">
              {[
                [ShieldCheck, "Tamper-resistant", "A prescription cannot be quietly changed or duplicated."],
                [Blocks, "Independently verifiable", "On-chain activity creates a clear, auditable trust signal."],
                [LockKeyhole, "Privacy preserving", "No patient or medication data is written to the blockchain."],
              ].map(([Icon, title, description]) => (
                <div key={title as string} className="flex gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-strong">
                    <Icon aria-hidden className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-strong">{title as string}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{description as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-24">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-7 sm:p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold text-text-strong sm:text-3xl">
              Ready to enter the trust network?
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-muted sm:text-base">
              Sign in to open your doctor, patient, or pharmacy workspace.
            </p>
          </div>
          <Button asChild className="h-12 shrink-0 rounded-xl px-6 text-base">
            <Link href="/login">
              Enter Pacy
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
