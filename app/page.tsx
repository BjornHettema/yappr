import Link from "next/link";

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
        <aside className="card postcard">
          <div className="meta">Live with Baan Suan · Bangkok · Thai</div>
          <div className="wave" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <p className="original">มีโต๊ะสำหรับสองท่าน เวลา 19:00 ค่ะ ติดหน้าต่างได้ไหมคะ</p>
          <p className="translation">Table for two at 7:00pm — is a window seat possible?</p>
        </aside>
      </section>

      <section id="how" className="features">
        <article className="feature">
          <h3>You brief. Yappr talks.</h3>
          <p>Name, number, and a plain-language request. The live model speaks for you on the line.</p>
        </article>
        <article className="feature">
          <h3>Transcript as it happens</h3>
          <p>Follow the original speech and a translation in your language. Listen live if you want the audio.</p>
        </article>
        <article className="feature">
          <h3>A summary you can act on</h3>
          <p>Times, prices, names, and next steps — written for you, not for the person who already speaks Thai.</p>
        </article>
      </section>
    </main>
  );
}
