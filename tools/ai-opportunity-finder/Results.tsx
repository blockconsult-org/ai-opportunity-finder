import { type Locale, type Model, RUBRIC_VERSION } from "./model";
import { buildReport, assumptions } from "./engine";
import styles from "./finder.module.css";
export function Results({ model, locale, onAssess, onChoose }: { model: Model; locale: Locale; onAssess: (id: string) => void; onChoose: () => void }) {
  const report = buildReport(model, locale), de = locale === "de";
  const L = (en: string, german: string) => de ? german : en;
  return <section className={styles.report} aria-labelledby="opportunity-results" data-testid="report">
    <div className={styles.sectionHead}><h2 id="opportunity-results">{L("Your opportunity map", "Ihre Chancenkarte")}</h2><p>{model.name || L("Compare the work. Then choose the next step.", "Arbeit vergleichen. Dann den nächsten Schritt wählen.")}</p></div>
    <p>{L("Rubric", "Bewertungslogik")} {RUBRIC_VERSION} · {report.ranked.length} {L("candidates", "Kandidaten")}. {L("Input basis", "Eingabebasis")}: {report.basis || L("No function or pain point selected", "Kein Bereich oder Problem ausgewählt")}.</p>
    <p className={styles.small}>{L("Planning scores from your answers. Verify the evidence before making a pilot decision.", "Planungswerte aus Ihren Antworten. Prüfen Sie die Belege vor einer Pilotentscheidung.")}</p>
    {!report.ranked.length ? <div className={styles.empty}><h3>{L("Start with one workflow", "Mit einem Workflow beginnen")}</h3><p>{L("Add a workflow or try a fictional preset to see your map and roadmap.", "Fügen Sie einen Workflow hinzu oder laden Sie ein fiktives Beispiel, um Karte und Plan zu sehen.")}</p><button className={styles.primary} onClick={onChoose}>{L("Choose workflows", "Workflows auswählen")} →</button></div> : <>
      <div className={styles.overview}>
        <div className={styles.overviewStats}>
          <h3>{L("At a glance", "Auf einen Blick")}</h3>
          <dl className={styles.keyFigures}>
            <div><dt>{L("Workflows compared", "Verglichene Workflows")}</dt><dd>{report.ranked.length}</dd></div>
            <div><dt>{L("Ready for verification", "Bereit zur Verifizierung")}</dt><dd>{report.ranked.filter(r => r.pilotEligible).length}<span>{L("before a pilot", "vor einem Pilot")}</span></dd></div>
            <div><dt>{L("Open answers", "Offene Antworten")}</dt><dd>{report.ranked.reduce((n, r) => n + r.unknown.length, 0)}<span>{L("to resolve", "zu klären")}</span></dd></div>
          </dl>
          <p className={styles.small}>{L("Pilot prerequisites take precedence over score. High value cannot offset a blocker.", "Pilotvoraussetzungen haben Vorrang vor dem Wert. Hoher Nutzen hebt keine Sperre auf.")}</p>
        </div>
        <div className={styles.matrixWrap}><h3>{L("Value vs effort", "Nutzen und Aufwand")}</h3>
        <svg viewBox="0 0 480 320" role="img" aria-labelledby="matrix-title matrix-desc" className={styles.matrix}>
          <title id="matrix-title">{L("Value versus effort", "Nutzen im Verhältnis zum Aufwand")}</title><desc id="matrix-desc">{L("Numbers match the ranked table below. Hollow circles are provisional or blocked. Coincident points can overlap; the table lists every candidate.", "Nummern entsprechen der Rangliste darunter. Leere Kreise sind vorläufig oder blockiert. Gleiche Positionen können überlappen; die Tabelle enthält alle Kandidaten.")}</desc>
          <rect x="55" y="25" width="400" height="240" fill="var(--color-surface)" stroke="var(--color-line-strong)" />
          <rect x="55" y="25" width="200" height="120" fill="var(--color-accent)" opacity=".07" />
          <path d="M55 145H455 M255 25V265" stroke="var(--color-line-strong)" strokeDasharray="5 6" />
          <g fill="var(--color-muted)" fontSize="15"><text x="30" y="270">0</text><text x="18" y="30">100</text><text x="425" y="288">100</text><text x="215" y="312">{L("Effort →", "Aufwand →")}</text><text transform="translate(15,195) rotate(-90)">{L("Value →", "Nutzen →")}</text></g>
          {report.ranked.map(r => <g key={r.candidate.id} transform={`translate(${55 + r.effort * 4},${265 - r.value * 2.4})`}><title>{r.rank}. {r.name}: {L("value", "Nutzen")} {r.value}, {L("effort", "Aufwand")} {r.effort}</title><circle r="14" fill={r.pilotEligible ? "var(--color-fg)" : "var(--color-surface)"} stroke="var(--color-fg)" strokeWidth="2" /><text textAnchor="middle" y="5" fontSize="14" fill={r.pilotEligible ? "var(--color-bg)" : "var(--color-fg)"}>{r.rank}</text></g>)}
        </svg>
      </div></div>
      <p className={styles.small}>{L("Filled = pilot prerequisites reported as met. Hollow = provisional or blocked. Unknowns lower value/readiness and raise effort/risk conservatively; these are planning positions, not forecasts.", "Gefüllt = Pilotvoraussetzungen laut Angaben erfüllt. Leer = vorläufig oder blockiert. Unbekanntes senkt Nutzen/Bereitschaft und erhöht Aufwand/Risiko konservativ; dies sind Planungspositionen, keine Prognosen.")}</p>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={L("Opportunity comparison, scroll horizontally if needed", "Chancenvergleich, bei Bedarf horizontal scrollen")}><table><caption>{L("All candidates · scores 0–100 · lower effort and risk are better", "Alle Kandidaten · Werte 0–100 · weniger Aufwand und Risiko sind besser")}</caption><thead><tr>{["#", L("Workflow", "Workflow"), L("Value", "Nutzen"), L("Effort", "Aufwand"), L("Readiness", "Bereitschaft"), L("Risk", "Risiko"), L("Answered", "Beantwortet"), L("Position", "Position")].map(s => <th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{report.ranked.map(r => <tr key={r.candidate.id}><td className={styles.rankCell}>{r.rank}</td><th scope="row">{r.name}</th><td data-label={L("Value", "Nutzen")}>{r.value}</td><td data-label={L("Effort", "Aufwand")}>{r.effort}</td><td data-label={L("Readiness", "Bereitschaft")}>{r.readiness}</td><td data-label={L("Risk", "Risiko")}>{r.risk}</td><td data-label={L("Answered", "Beantwortet")}>{r.completeness}%</td><td className={styles.positionCell}>{r.pilotEligible ? L("Verify, then pilot", "Prüfen, dann Pilot") : r.unknown.length ? L("Provisional · no live pilot", "Vorläufig · kein Live-Pilot") : L("Blocked · no live pilot", "Blockiert · kein Live-Pilot")}</td></tr>)}</tbody></table></div>
      {!report.ranked.some(r => r.pilotEligible) && <p className={styles.notice}>{L("No suitable live pilot yet. Use this shortlist to resolve prerequisites first.", "Noch kein geeigneter Live-Pilot. Klären Sie zuerst die Voraussetzungen dieser Auswahl.")}</p>}
      <h3 className={styles.subheading}>{L("Your shortlist & 30/60/90-day plan", "Ihre Auswahl & Ihr 30/60/90-Tage-Plan")}</h3>
      <div className={styles.shortlist}>{report.ranked.slice(0, 3).map(r => <article className={styles.resultCard} key={r.candidate.id} data-testid="shortlist-card">
        <div className={styles.resultIdentity}><span className={styles.eyebrow}>{String(r.rank).padStart(2, "0")} / {r.pilotEligible ? L("VERIFY & PILOT", "PRÜFEN & PILOT") : L("NO LIVE PILOT", "KEIN LIVE-PILOT")}</span><h3>{r.name}</h3><p className={styles.approach}>{r.approachLabel}</p><p className={styles.small}>{r.reasons.at(-1)}</p><button className={styles.textButton} onClick={() => onAssess(r.candidate.id)}>{L("Review answers", "Antworten prüfen")} →</button></div>
        <div className={styles.resultPlan}><h4>{L("Before you start", "Vor dem Start")}</h4><ul>{r.prerequisites.map(p => <li key={p}>{p}</li>)}</ul>
          <details className={styles.planDetails}><summary>{L("Rationale & 30/60/90-day plan", "Begründung & 30/60/90-Tage-Plan")} <span className={styles.small}>{r.unknown.length ? `${r.unknown.length} ${L("open answers", "offene Antworten")}` : L("All answers provided", "Alle Antworten vorhanden")}</span></summary>
            <h4>{L("Why this approach", "Warum dieser Ansatz")}</h4><ul>{r.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
            <h4>{L("Unresolved questions", "Offene Fragen")}</h4>{r.questions.length ? <ul>{r.questions.map(q => <li key={q}>{q}</li>)}</ul> : <p>{L("No unknown answers. Verify the claims with the owner.", "Keine unbekannten Antworten. Angaben mit der verantwortlichen Person prüfen.")}</p>}
            <h4>{L("Suggested pilot metric", "Vorgeschlagene Pilotkennzahl")}</h4><p>{r.metric}</p>
            <h4>{L("Roadmap", "Fahrplan")}</h4><ol className={styles.roadmap}>{r.roadmap.map((step, i) => <li key={step}><span aria-hidden="true">{["30", "60", "90"][i]}</span><p>{step}</p></li>)}</ol>
          </details>
        </div>
      </article>)}</div>
      <details className={styles.basis}><summary>{L("Input basis and recommendations for every workflow", "Eingabebasis und Empfehlungen für jeden Workflow")}</summary>{report.ranked.map(r => <section key={r.candidate.id}><h3>{r.rank}. {r.name} · {r.approachLabel}</h3><p>{L("Internal ordering score", "Interner Sortierwert")}: {r.priority}/100. {L("Pilot eligibility takes precedence.", "Pilotberechtigung hat Vorrang.")}</p><ul>{r.inputBasis.map(line => <li key={line}>{line}</li>)}</ul>{r.candidate.ownerName && <p>{L("Owner", "Verantwortlich")}: {r.candidate.ownerName}</p>}{r.candidate.notes && <p>{L("Notes", "Notizen")}: {r.candidate.notes}</p>}{r.candidate.evidence && <p>{L("Evidence reference", "Belegreferenz")}: {r.candidate.evidence}</p>}{r.rank > 3 && <><ul>{r.reasons.map(x => <li key={x}>{x}</li>)}</ul><h4>{L("Prerequisites", "Voraussetzungen")}</h4><ul>{r.prerequisites.map(x => <li key={x}>{x}</li>)}</ul><h4>{L("Open questions", "Offene Fragen")}</h4><ul>{r.questions.map(x => <li key={x}>{x}</li>)}</ul><p>{r.metric}</p><ol>{r.roadmap.map(x => <li key={x}>{x}</li>)}</ol></>}</section>)}</details>
    </>}
    <details className={styles.reportAssumptions}><summary>{L("Report assumptions", "Annahmen des Berichts")} · {RUBRIC_VERSION}</summary><p className={styles.small}>{assumptions[locale]}</p></details>
  </section>;
}
