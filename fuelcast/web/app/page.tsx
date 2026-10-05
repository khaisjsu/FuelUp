import Link from "next/link";

const STEPS = [
  { title: "Sense", body: "Reads the watch, ring or glucose sensor you already wear: calories burned, heart rate, HRV and glucose trend." },
  { title: "Predict", body: "Fuses those signals into one hunger score and spots your hunger window 30 to 45 minutes ahead." },
  { title: "Choose", body: "Picks a meal that fits the calories and protein you need now, your diet, allergies and budget." },
  { title: "Confirm", body: "One tap on your watch says yes. Autopilot users can let it order unless they cancel." },
  { title: "Deliver", body: "A partner kitchen cooks it and a delivery partner brings it as your hunger starts." },
];

const SIGNALS = [
  ["Glucose trend", "Over-the-counter CGM (Stelo, Lingo)", "A dip after a peak often comes right before hunger"],
  ["Calories burned", "Apple Watch, Fitbit, Garmin, Oura, Whoop", "Running energy gap since your last meal"],
  ["Time since eating", "Order history and glucose meal spikes", "The strongest practical predictor of when you eat"],
  ["HRV and sleep", "Watch or ring", "Stress and poor sleep raise appetite"],
];

const SAFEGUARDS = [
  ["Confirm by default", "Nothing is ordered without a tap unless you switch on autopilot."],
  ["Hard limits", "Weekly budget, a daily order cap and a cancel window you set."],
  ["Allergy and diet filters", "Meals with your allergens never get suggested."],
  ["A reason for every order", "\"Glucose falling, 3h 20m since lunch, 460 kcal burned.\""],
  ["Your data stays yours", "Opt in per device. Health data is never sold to restaurants or advertisers."],
];

export default function Home() {
  return (
    <main>
      <section className="container hero">
        <div>
          <div className="eyebrow">Hands-free food ordering</div>
          <h1>Meals that arrive before your energy crashes.</h1>
          <p className="lead">
            Fuelcast reads the signals your watch and glucose sensor already collect, predicts when you&apos;re about
            to get hungry, and has the right meal on its way with one tap on your wrist.
          </p>
          <div className="row" style={{ marginTop: 28 }}>
            <Link href="/dashboard" className="btn btn-primary btn-lg">Try the live demo</Link>
            <a href="#how" className="btn btn-lg">How it works</a>
          </div>
          <p className="subtle" style={{ marginTop: 14 }}>Prototype with simulated sensor data. No real orders are placed.</p>
        </div>
        <div className="grid" style={{ gap: 12 }}>
          <div className="notif">
            <div className="row subtle" style={{ fontSize: 12 }}>
              <span className="logo-mark" style={{ width: 20, height: 20, fontSize: 11 }}>⚡</span> Fuelcast · now
            </div>
            <p style={{ fontWeight: 600, marginTop: 8 }}>Your hunger window opens in about 20 minutes</p>
            <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Glucose falling, 3h 20m since lunch, about 460 kcal burned since then.
            </p>
          </div>
          <div className="notif">
            <p className="subtle" style={{ fontSize: 12 }}>Green Fork Kitchen · 24 min</p>
            <p style={{ fontWeight: 600, marginTop: 4 }}>Salmon quinoa bowl</p>
            <p className="muted" style={{ fontSize: 14 }}>610 kcal · 42 g protein · slow carbs to avoid another crash</p>
            <div className="row" style={{ marginTop: 12 }}>
              <span className="btn btn-primary btn-sm">✓ Tap to order · $19.94</span>
              <span className="btn btn-sm">Not now</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="container section">
        <h2>From body signal to delivered meal</h2>
        <p className="lead">
          Delivery apps don&apos;t know your body, and health apps don&apos;t order food. Fuelcast closes that loop.
        </p>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div className="card step-card" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>No single sensor reads hunger. Several together can predict it.</h2>
        <p className="lead">
          The hunger score combines proxies and learns each person&apos;s pattern. Users without a glucose sensor get the
          same model without that signal.
        </p>
        <div className="card table-wrap" style={{ padding: 6 }}>
          <table className="table">
            <thead><tr><th>Signal</th><th>Where it comes from</th><th>What it tells us</th></tr></thead>
            <tbody>
              {SIGNALS.map(([a, b, c]) => (
                <tr key={a}><td><strong>{a}</strong></td><td className="muted">{b}</td><td className="muted">{c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container section">
        <h2>Built for people who already track</h2>
        <p className="lead">
          We start with CGM wellness users, who already wear the sensor and pay for steady energy, then athletes
          refuelling after training and shift workers who forget to eat.
        </p>
        <div className="grid cols-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            ["Maya, product designer", "Wears a Stelo CGM. Her 3 pm crash shows up as a glucose dip; lunch #2 arrives before it hits."],
            ["Jordan, triathlete", "Autopilot on. A high-protein meal is ordered the minute bike intervals end."],
            ["Priya, ICU nurse", "Skips lunch on busy shifts. A vegetarian meal gets to the ward with one tap."],
          ].map(([t, b]) => (
            <div className="card" key={t}><strong>{t}</strong><p className="muted" style={{ marginTop: 6, fontSize: 14 }}>{b}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Trust is the product</h2>
        <p className="lead">An app that spends money on your behalf has to be predictable. These rules are on by default.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          {SAFEGUARDS.map(([t, b]) => (
            <div className="card" key={t}><strong>{t}</strong><p className="muted" style={{ marginTop: 6, fontSize: 14 }}>{b}</p></div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta-band">
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2>See one afternoon play out</h2>
            <p style={{ marginTop: 6, opacity: 0.85 }}>Watch a glucose dip raise the hunger score, then approve the meal from a simulated watch.</p>
          </div>
          <Link href="/dashboard" className="btn btn-lg">Open the live demo</Link>
        </div>
      </section>
    </main>
  );
}
