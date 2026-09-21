import Link from "next/link";
import LivePostcard from "@/app/components/LivePostcard";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div>
          <span className="kicker">For travelers who need a table, a room, or a yes</span>
          <h1>Call like a local. Understand every word.</h1>
          <p className="lede">
            Type what you need. Yappr dials the shop, clinic, or kitchen in their language,
            shows the conversation as it happens, and leaves you a summary — not a shrug.
          </p>
          <div className="actions">
            <Link className="btn btn-primary" href="/call">
              Place a call
            </Link>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
        </div>
        <LivePostcard />
      </section>

      <section id="how" className="how">
        <div className="section-head">
          <span className="kicker">No talking out loud. No guessing what they said.</span>
          <h2>How it works</h2>
          <p className="lede">Four simple steps. You never have to speak the language, or speak at all.</p>
        </div>
        <ol className="steps">
          <li className="step">
            <span className="step-num">1</span>
            <h3>Type what you need</h3>
            <p>A table, a room, an appointment, a question. Just type it in your own language — no phone call from you, no awkward small talk.</p>
          </li>
          <li className="step">
            <span className="step-num">2</span>
            <h3>Yappr makes the call</h3>
            <p>It dials and speaks their language on the line, like a local would.</p>
          </li>
          <li className="step">
            <span className="step-num">3</span>
            <h3>Watch it happen</h3>
            <p>Every word appears on your screen, translated into your language, while it is being said.</p>
          </li>
          <li className="step">
            <span className="step-num">4</span>
            <h3>Get your answer</h3>
            <p>A short, plain summary when the call ends — what was agreed, and what to do next.</p>
          </li>
        </ol>
      </section>
    </main>
  );
}
