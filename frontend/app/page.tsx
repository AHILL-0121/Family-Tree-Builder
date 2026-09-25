import Link from "next/link";
import { RelateDemo } from "@/components/landing/RelateDemo";
import { ContactForm } from "@/components/ContactForm";
import { ForceLightTheme } from "@/components/landing/ForceLightTheme";
import { buildPosterSVG, mainRoot } from "@/lib/poster";
import { samplePeople, SAMPLE_NAME } from "@/lib/sample";

function BrandMark() {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-[22px] w-[22px]" aria-hidden>
      <rect x="2" y="2.5" width="7" height="5" rx="1.2" /><rect x="13" y="2.5" width="7" height="5" rx="1.2" />
      <path d="M9 4.2h4M9 5.8h4M11 5v5.5M5.5 10.5h11M5.5 10.5V14M16.5 10.5V14" />
      <rect x="2" y="14" width="7" height="5" rx="1.2" /><rect x="13" y="14" width="7" height="5" rx="1.2" fill="currentColor" />
    </svg>
  );
}

export default function LandingPage() {
  const people = samplePeople();
  const poster = buildPosterSVG(people, {
    title: SAMPLE_NAME, style: "illus", include: "whole", focus: null, rootId: mainRoot(people), dir: "bottom",
    labels: "tamil", anchor: "sample-vishal", size: "a4", orient: "landscape", foliage: "lush",
  });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ForceLightTheme />
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
        <BrandMark />
        <span className="text-sm font-semibold tracking-tight">Family Tree Builder</span>
        <div className="flex-1" />
        <a href="#contact" className="text-[13px] text-ink-2 hover:text-ink">Contact</a>
        <Link href="/editor" className="inline-flex h-8 items-center rounded-lg border border-ink bg-ink px-3 text-[13px] font-medium text-surface hover:opacity-90">Open the editor</Link>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-10">
          <h1 className="max-w-3xl font-serif text-[clamp(2.2rem,5vw,3.6rem)] font-normal leading-[1.05] tracking-tight">
            Write down who everyone is, before no one remembers.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">
            Build your family tree, see exactly how two people are related in English and தமிழ், and print the whole family as a poster. It stays in your browser.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link href="/editor" className="inline-flex h-10 items-center rounded-lg border border-ink bg-ink px-4 text-sm font-medium text-surface hover:opacity-90">Open the editor</Link>
            <a href="#relate" className="text-sm text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink">See how relationships work</a>
          </div>
        </section>

        <section id="relate" className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-20">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Relate · try it</p>
          <RelateDemo />
        </section>

        <section className="border-y border-rule bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Kinship, properly</p>
              <h2 className="font-serif text-3xl font-normal leading-tight">சித்தப்பா or பெரியப்பா? It depends, and the app knows.</h2>
              <p className="mt-4 text-ink-2">
                Tamil kinship words change with who is asking, whose side of the family a relative is on, and who is older.
                A father&apos;s younger brother is சித்தப்பா, an elder one பெரியப்பா; a mother&apos;s brother&apos;s son is a cross cousin, a father&apos;s brother&apos;s son is a brother.
                Add birth years and the right word appears; leave them out and you see both, with a note explaining why.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-rule bg-rule text-sm">
              {[["Father's younger brother", "சித்தப்பா"], ["Mother's brother", "மாமா"], ["Father's sister's son", "அத்தை மகன்"], ["Wife's younger sister", "கொழுந்தியாள்"], ["Husband's sister", "நாத்தனார்"], ["Wife's sister's husband", "சகலை"]].map(([en, ta]) => (
                <div key={en} className="bg-card p-4">
                  <dt className="text-ink-3">{en}</dt>
                  <dd lang="ta" className="mt-1 font-tamil text-lg font-semibold">{ta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Take it with you</p>
            <h2 className="font-serif text-3xl font-normal leading-tight">A poster for the wall, a file for safekeeping.</h2>
            <p className="mt-4 text-ink-2">
              Print the family as a clean register or a grown tree, labelled in Tamil from any one person&apos;s point of view: a gift that says who everyone is to them.
              Back up your data as a file you can open again on any device.
            </p>
          </div>
          <div className="overflow-hidden rounded-[6px] shadow-float [&_svg]:h-auto [&_svg]:w-full" aria-label="Example poster" role="img" dangerouslySetInnerHTML={{ __html: poster }} />
        </section>

        <section className="border-t border-rule bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
            <div>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">Private by default</p>
              <h2 className="font-serif text-3xl font-normal leading-tight">Your family stays on your device.</h2>
              <p className="mt-4 text-ink-2">
                There&apos;s no account and no server copy. Everything saves in this browser as you type; export a backup whenever you like, and import it anywhere.
              </p>
            </div>
            <div id="contact" className="scroll-mt-6">
              <h2 className="mb-4 font-serif text-2xl font-normal">Questions or feedback?</h2>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-8 text-[13px] text-ink-3">
        <span>Family Tree Builder</span>
        <span aria-hidden>·</span>
        <a href="https://github.com/AHILL-0121/Family-Tree-Builder" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Source on GitHub</a>
        <div className="flex-1" />
        <span>Made by <a href="https://github.com/AHILL-0121" target="_blank" rel="noopener noreferrer" className="hover:text-ink">AHILL-0121</a></span>
      </footer>
    </div>
  );
}
