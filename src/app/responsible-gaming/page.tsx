import type { Metadata } from "next";
import { Clock, Hand, HeartHandshake, LifeBuoy, PauseCircle, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RevealGroup, RevealItem } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Responsible Gaming" };

const PRINCIPLES = [
  { icon: Wallet, title: "Set a budget", body: "Decide before you start how much you are willing to spend, and stop when you reach it." },
  { icon: Clock, title: "Watch the clock", body: "Set a time limit for each session. Regular breaks help you stay in control." },
  { icon: Hand, title: "Never chase losses", body: "Losses are part of the game. Trying to win them back usually makes them bigger." },
  { icon: PauseCircle, title: "Take a break", body: "If play stops being fun, step away. The tables will still be here." },
];

const SIGNS = [
  "Spending more time or money than you planned",
  "Borrowing money or selling things to gamble",
  "Feeling anxious, irritable or low when you are not playing",
  "Hiding your gambling from friends or family",
  "Neglecting work, study or relationships",
  "Gambling to escape problems or to cope with stress",
];

const FAQ = [
  {
    q: "Is any real money involved?",
    a: "No. Royal Casino runs entirely on your own machine and only uses play-money demo credits. Credits cannot be bought, sold, transferred or withdrawn.",
  },
  {
    q: "Are the games fair?",
    a: "Every game shows its theoretical RTP (return to player). RTP is a long-term average and does not predict the outcome of a single session.",
  },
  {
    q: "Where is my data stored?",
    a: "Everything, including your balance and favourites, is kept in a local SQLite database file on your computer. Nothing is sent to a server.",
  },
  {
    q: "How do I reset my demo balance?",
    a: "Run npm run db:reset in the project folder. This restores the demo player, the catalogue and the promotions to their defaults.",
  },
];

const SUPPORT = [
  { name: "Gamblers Anonymous", body: "Peer support groups held around the world." },
  { name: "GamCare", body: "Free information, advice and support (UK)." },
  { name: "National Council on Problem Gambling", body: "Confidential helpline and resources (US)." },
  { name: "Gambling Therapy", body: "Free multilingual online support." },
];

export default function ResponsibleGamingPage() {
  return (
    <div className="shell-container space-y-14 py-6 sm:py-8">
      <PageHeader
        eyebrow="Play well"
        title={
          <>
            Gaming should always be <span className="italic text-gold-gradient">entertainment</span>
          </>
        }
        description="Royal Casino is a play-money experience built for fun. These guidelines help keep it that way."
        icon={ShieldCheck}
      />

      <section id="limits" className="scroll-mt-28">
        <SectionHeader title="Stay in control" eyebrow="Principles" />
        <RevealGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <div className="h-full rounded-2xl border border-line bg-surface p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-2xl text-ivory">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="text-3xl text-ivory">Warning signs</h2>
          <p className="mt-2 text-sm text-muted">If any of these sound familiar, it may be time to talk to someone.</p>
          <ul className="mt-6 space-y-3">
            {SIGNS.map((s) => (
              <li key={s} className="flex gap-3 text-sm text-ivory/85">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div id="support" className="scroll-mt-28 rounded-2xl border-gold-gradient p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold-gradient text-ink">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <h2 className="text-3xl text-ivory">Where to get help</h2>
          </div>
          <p className="mt-3 text-sm text-muted">
            Independent organisations offer free, confidential support for anyone affected by gambling.
          </p>
          <ul className="mt-6 divide-y divide-line">
            {SUPPORT.map((s) => (
              <li key={s.name} className="flex items-start gap-3 py-3">
                <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-semibold text-ivory">{s.name}</p>
                  <p className="text-xs text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="faq" className="scroll-mt-28">
        <SectionHeader title="Common questions" eyebrow="FAQ" />
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-line bg-surface open:border-gold/30 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-display text-xl text-ivory transition-colors hover:text-gold-light">
                {f.q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/30 text-gold transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mx-auto flex max-w-xl items-center justify-center gap-3 text-center text-xs text-subtle">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-gold/60 text-[0.65rem] font-bold text-gold">
          18+
        </span>
        Royal Casino is intended for adults aged 18 and over.
      </p>
    </div>
  );
}
