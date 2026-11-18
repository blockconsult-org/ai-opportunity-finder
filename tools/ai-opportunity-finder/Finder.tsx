"use client";

import { ToolHeader } from "@/components/tools/ToolHeader";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/Container";
import { SelectField } from "@/simulator/components/fields/select-field";
import { localeHref } from "@/content/i18n";
import { type Locale, type Model, type Candidate, type Answer, DataError, emptyModel, functions, pains, templateIds, naFields, newCandidate, modelJson, validEvidence, RUBRIC_VERSION } from "./model";
import { candidateName, fieldCopy, functionLabels, groups, painLabels, preset, presetNames, taskLabels, templates } from "./catalog";
import { assess, assumptions } from "./engine";
import { decodeShare, deleteLocal, encodeShare, importFile, loadLocal, saveLocal, shareModel } from "./persistence";
import { download, summaryPng } from "./exports";
import { manifest } from "./manifest";
import { ActionsMenu } from "./ActionsMenu";
import { Results } from "./Results";
import styles from "./finder.module.css";

type Notice = "saved" | "loaded" | "deleted" | "empty" | "storage" | "invalid" | "version" | "tooLarge" | "snapshot" | "copied" | "copy" | "imported" | "download" | "reset";
const messages: Record<Notice, { en: string; de: string }> = {
  saved: { en: "Saved in this browser. Future saves replace this one saved scenario.", de: "In diesem Browser gespeichert. Weitere Speicherungen ersetzen dieses Szenario." },
  loaded: { en: "Saved scenario loaded for editing.", de: "Gespeichertes Szenario zur Bearbeitung geladen." },
  deleted: { en: "Local save deleted. The scenario on screen is unchanged.", de: "Lokale Speicherung gelöscht. Das angezeigte Szenario bleibt erhalten." },
  empty: { en: "There is no saved scenario in this browser.", de: "In diesem Browser ist kein Szenario gespeichert." },
  storage: { en: "Browser storage is unavailable or full. You can continue and export a JSON file.", de: "Browserspeicher ist nicht verfügbar oder voll. Sie können fortfahren und eine JSON-Datei exportieren." },
  invalid: { en: "This is not a valid opportunity scenario or link. Current work is preserved. Check the file, link and evidence URLs.", de: "Dies ist kein gültiges Chancenszenario oder kein gültiger Link. Ihre Arbeit bleibt erhalten. Datei, Link und Beleg-URLs prüfen." },
  version: { en: "Unsupported schema, rubric or link version. Current work is preserved.", de: "Nicht unterstützte Schema-, Bewertungs- oder Linkversion. Ihre Arbeit bleibt erhalten." },
  tooLarge: { en: "This payload is too large. For sharing, export the JSON file instead (imports: up to 64 KB).", de: "Diese Datenmenge ist zu gross. Teilen Sie stattdessen die JSON-Datei (Import: bis 64 KB)." },
  snapshot: { en: "Read-only shared snapshot. Your editable work and local save are unchanged.", de: "Geteilte Momentaufnahme, nur lesbar. Ihre bearbeitbare Arbeit und lokale Speicherung bleiben erhalten." },
  copied: { en: "Link copied. Anyone with the link can read the included answers.", de: "Link kopiert. Alle mit dem Link können die enthaltenen Antworten lesen." },
  copy: { en: "Editable copy created. Nothing has been saved automatically.", de: "Bearbeitbare Kopie erstellt. Nichts wurde automatisch gespeichert." },
  imported: { en: "JSON scenario imported. Review the answers before using the recommendations.", de: "JSON-Szenario importiert. Prüfen Sie die Antworten vor der Nutzung der Empfehlungen." },
  download: { en: "The image could not be created. Use Print / Save as PDF or export JSON.", de: "Das Bild konnte nicht erstellt werden. Nutzen Sie Drucken / Als PDF speichern oder den JSON-Export." },
  reset: { en: "Started a blank scenario. Your local save is unchanged.", de: "Leeres Szenario gestartet. Ihre lokale Speicherung bleibt erhalten." },
};
export function Finder({ locale: initialLocale }: { locale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  useEffect(() => { window.dispatchEvent(new CustomEvent('bc:locale', { detail: locale })); }, [locale]);
  const [draft, setDraft] = useState<Model>(emptyModel);
  const [snapshot, setSnapshot] = useState<Model | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sharing, setSharing] = useState(false);
  const [includeText, setIncludeText] = useState(false);
  const [link, setLink] = useState("");
  const [clipboardFailed, setClipboardFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [example, setExample] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const [undo, setUndo] = useState<Model | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const model = snapshot ?? draft;
  const readOnly = snapshot !== null;
  const de = locale === "de", L = (en: string, german: string) => de ? german : en;
  const invalid = model.candidates.some(c => !validEvidence(c.evidence));
  const fail = (e: unknown) => setNotice(e instanceof DataError ? e.code : "invalid");

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash;
      if (!hash) { setSnapshot(null); setLink(""); return; }
      // Site skip links and ordinary anchors are not scenario payloads.
      if (["#main", "#finder-context", "#finder-workflows", "#finder-assess", "#opportunity-results"].includes(hash)) return;
      try { setSnapshot(decodeShare(hash)); setStage(2); setNotice("snapshot"); setLink(""); }
      catch (e) { setNotice(e instanceof DataError ? e.code : "invalid"); }
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    const opened: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      document.querySelectorAll<HTMLDetailsElement>("[data-testid='report'] details:not([open])").forEach(el => { opened.push(el); el.open = true; });
    };
    const afterPrint = () => { opened.splice(0).forEach(el => { el.open = false; }); };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { window.removeEventListener("hashchange", readHash); window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);

  function edit(next: Model) { if (readOnly) return; setUndo(null); setDraft(next); setLink(""); setNotice(null); setExample(null); }
  function updateCandidate(id: string, change: Partial<Candidate>) { edit({ ...draft, candidates: draft.candidates.map(c => c.id === id ? { ...c, ...change } : c) }); }
  function replace(next: Model) { edit(next); setUndo(draft); setIncludeText(false); setActive(next.candidates[0]?.id ?? null); setStage(next.candidates.length ? 1 : 0); }
  function go(next: number, targetId = `finder-panel-${next}`) {
    const origin = document.activeElement;
    setStage(next);
    requestAnimationFrame(() => {
      // Preserve a visitor's newer focus choice while the panel is rendering.
      if (document.activeElement !== origin && document.activeElement !== document.body) return;
      const target = document.getElementById(targetId);
      const focus = target?.matches("details") ? target.querySelector("summary") : document.getElementById(`finder-tab-${next}`);
      (focus as HTMLElement | null)?.focus({ preventScroll: true });
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 152, behavior: "instant" });
    });
  }
  function clearHash() { window.history.replaceState(null, "", window.location.pathname + window.location.search); }
  function makeCopy() { if (!snapshot) return; setUndo(draft); setIncludeText(false); setDraft(structuredClone(snapshot)); setSnapshot(null); setActive(snapshot.candidates[0]?.id ?? null); setStage(1); setNotice("copy"); setExample(null); clearHash(); setLink(""); }
  function leaveSnapshot() { setActive(draft.candidates[0]?.id ?? null); setStage(draft.candidates.length ? 1 : 0); setSnapshot(null); clearHash(); setNotice(null); setLink(""); }
  function store(action: "save" | "load" | "delete") {
    try {
      if (action === "save") { saveLocal(window.localStorage, model); setNotice("saved"); }
      if (action === "load") { const saved = loadLocal(window.localStorage); if (saved) replace(saved); setNotice(saved ? "loaded" : "empty"); }
      if (action === "delete") { deleteLocal(window.localStorage); setNotice("deleted"); }
    } catch (e) { setNotice(e instanceof DataError ? e.code : "storage"); }
  }
  function add(template: Candidate["template"]) {
    if (draft.candidates.length >= 10) return;
    const c = newCandidate(template, crypto.randomUUID());
    edit({ ...draft, candidates: [...draft.candidates, c] }); setActive(c.id);
  }
  const match = (id: Candidate["template"]) => model.functions.includes(templates[id].fn) || model.pains.includes(templates[id].pain);
  const sortedTemplates = [...templateIds].filter(id => id !== "custom").sort((a, b) => Number(match(b)) - Number(match(a)));

  return <><ToolHeader tool="ai-opportunity-finder" locale={locale} title={manifest.title[locale]} titleId="finder-title" lead={L("Find the workflow worth improving first. Compare opportunities, clarify blockers and build a practical 30/60/90-day plan.", "Finden Sie den Workflow, der zuerst verbessert werden sollte. Vergleichen Sie Chancen, klären Sie Hürden und erstellen Sie einen 30/60/90-Tage-Plan.")} printTitle /><div className={styles.root} data-opportunity-finder lang={locale}>
    <Container>
      <div className={styles.toolbar}>
        <div className={styles.workspaceControls}>
          <label className={styles.label}>{L("Scenario name (optional)", "Szenarioname (optional)")}<input value={model.name} maxLength={100} disabled={readOnly} onChange={e => edit({ ...draft, name: e.target.value })} placeholder={L("My opportunity shortlist", "Meine Chancenauswahl")} /></label>
          <SelectField<string> id="fictional-example" label={L("Fictional example", "Fiktives Beispiel")} value={example === null ? "none" : String(example)} disabled={readOnly} options={[{ value: "none", label: L("Choose an example…", "Beispiel auswählen…") }, ...presetNames.map((name, i) => ({ value: String(i), label: name[locale] }))]} onChange={value => { if (value !== "none") { replace(preset(Number(value))); setExample(Number(value)); } }} />
          <div className={styles.actions}>
            <button disabled={readOnly || invalid} onClick={() => store("save")}>{L("Save locally", "Lokal speichern")}</button>
            <ActionsMenu label={L("Scenario actions", "Aktionen")} actions={[
              { label: L("Load local save", "Lokale Speicherung laden"), disabled: readOnly, run: () => store("load") },
              { label: L("Import JSON", "JSON importieren"), disabled: readOnly, run: () => inputRef.current?.click() },
              { label: L("Export JSON", "JSON exportieren"), disabled: invalid, run: () => { try { download(new Blob([modelJson(model)], { type: "application/json" }), "ai-opportunity-finder.json"); } catch (e) { fail(e); } } },
              { label: L("Reset", "Zurücksetzen"), disabled: readOnly, destructive: true, run: () => { replace(emptyModel()); setNotice("reset"); } },
              { label: L("Delete local save", "Lokale Speicherung löschen"), disabled: readOnly, destructive: true, run: () => store("delete") },
            ]} />
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".json,application/json" hidden aria-label={L("Import scenario file", "Szenariodatei importieren")} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { replace(await importFile(file)); setNotice("imported"); } catch (e) { fail(e); } }} />
        <div className={styles.toolbarFoot}><p className={styles.small}>{example !== null ? L("Fictional example. Review the illustrative answers for your business.", "Fiktives Beispiel. Prüfen Sie die illustrativen Antworten für Ihr Unternehmen.") : L("Nothing is saved automatically. Save locally or export your work before leaving.", "Nichts wird automatisch gespeichert. Vor dem Verlassen lokal speichern oder exportieren.")}</p><div className={styles.actions}>
          {undo && !readOnly && <button className={styles.textButton} onClick={() => { const previous = undo; replace(previous); setUndo(null); }}>{L("Undo replacement / removal", "Ersetzen / Entfernen rückgängig")}</button>}
          <button className={styles.textButton} title={L("Tool language · keeps your inputs", "Werkzeugsprache · Eingaben bleiben")} onClick={() => { setLocale(de ? "en" : "de"); setLink(""); }} lang={de ? "en" : "de"}>{de ? "English" : "Deutsch"}</button>
        </div></div>
      </div>
      <div role="status" aria-live="polite" className={notice ? styles.notice : styles.status}>{notice ? messages[notice][locale] : <span className={styles.srOnly}>{model.candidates.length} {L("workflows in your assessment", "Workflows in Ihrer Bewertung")}</span>}</div>
      {invalid && <div className={styles.notice} role="alert"><p>{L("An evidence URL needs attention. Correct it to save, share or export this scenario.", "Eine Beleg-URL muss korrigiert werden, bevor Sie dieses Szenario speichern, teilen oder exportieren können.")}</p><button onClick={() => {
        const candidate = model.candidates.find(c => !validEvidence(c.evidence));
        if (!candidate) return;
        setActive(candidate.id); setStage(1);
        requestAnimationFrame(() => {
          const details = document.getElementById(`evidence-notes-${candidate.id}`) as HTMLDetailsElement | null;
          if (details) details.open = true;
          const input = document.getElementById(`evidence-${candidate.id}`);
          input?.focus({ preventScroll: true }); input?.scrollIntoView({ block: "center" });
        });
      }}>{L("Fix evidence URL", "Beleg-URL korrigieren")}</button></div>}
      {readOnly && <div className={styles.snapshot}><strong>{L("Read-only snapshot", "Momentaufnahme, nur lesbar")}</strong><p>{L("Make a copy to edit. It will not replace your saved draft until you explicitly save it.", "Erstellen Sie zum Bearbeiten eine Kopie. Sie ersetzt Ihre lokale Speicherung erst bei ausdrücklichem Speichern.")}</p><div className={styles.actions}><button onClick={makeCopy}>{L("Make a copy", "Kopie erstellen")}</button><button onClick={leaveSnapshot}>{L("Return to my work", "Zurück zu meiner Arbeit")}</button></div></div>}
      <div className={styles.steps} role="tablist" aria-label={L("Tool steps", "Werkzeugschritte")}>
        {[L("Choose", "Auswählen"), L("Assess", "Bewerten"), L("Compare", "Vergleichen")].map((label, i) => <button key={i} role="tab" id={`finder-tab-${i}`} aria-controls={`finder-panel-${i}`} aria-selected={stage === i} tabIndex={stage === i ? 0 : -1} onClick={() => go(i)} onKeyDown={e => {
          const next = e.key === "ArrowRight" ? (i + 1) % 3 : e.key === "ArrowLeft" ? (i + 2) % 3 : e.key === "Home" ? 0 : e.key === "End" ? 2 : -1;
          if (next >= 0) { e.preventDefault(); go(next); }
        }}><span className={styles.stepNumber}>{i + 1}.</span> {label}</button>)}
      </div>
      <div className={styles.editor} role="tabpanel" id="finder-panel-0" aria-labelledby="finder-tab-0" hidden={stage !== 0}>

        <details id="finder-context" className={styles.context}><summary>{L("Focus your search", "Suche eingrenzen")} <span className={styles.small}>{L("Optional · highlight relevant templates", "Optional · passende Vorlagen hervorheben")}</span></summary><p className={styles.small}>{L("Choose the functions and friction you want to explore. These highlight templates; they do not change scores.", "Wählen Sie Bereiche und Probleme. Diese markieren Vorlagen; die Bewertung bleibt davon unabhängig.")}</p>
          <div className={styles.twoColumns}><fieldset disabled={readOnly}><legend>{L("Business functions", "Geschäftsbereiche")}</legend>{functions.map(key => <label className={styles.check} key={key}><input type="checkbox" checked={model.functions.includes(key)} onChange={e => edit({ ...draft, functions: e.target.checked ? [...draft.functions, key] : draft.functions.filter(x => x !== key) })} />{functionLabels[key][locale]}</label>)}</fieldset><fieldset disabled={readOnly}><legend>{L("Common pain points", "Typische Probleme")}</legend>{pains.map(key => <label className={styles.check} key={key}><input type="checkbox" checked={model.pains.includes(key)} onChange={e => edit({ ...draft, pains: e.target.checked ? [...draft.pains, key] : draft.pains.filter(x => x !== key) })} />{painLabels[key][locale]}</label>)}</fieldset></div>
        </details>
        <section id="finder-workflows" className={styles.section} aria-labelledby="workflows-title"><div className={styles.sectionHead}><h2 id="workflows-title">{L("Build your candidate list", "Ihre Kandidatenliste erstellen")}</h2><p>{L("Add up to ten workflows. Templates start with unknown answers so you can assess your actual situation.", "Bis zu zehn Workflows hinzufügen. Vorlagen starten mit unbekannten Antworten für die Bewertung Ihrer tatsächlichen Situation.")}</p></div>
          <div className={styles.templates}>{sortedTemplates.map(id => <article className={styles.template} key={id}><div><h3>{templates[id].title[locale]}</h3><p>{templates[id].description[locale]}</p>{model.candidates.some(c => c.template === id) && <span className={styles.small}>{model.candidates.filter(c => c.template === id).length} {L("added", "hinzugefügt")}</span>}{match(id) && <span className={styles.tag}>{L("Matches your context", "Passt zu Ihrem Kontext")}</span>}</div><button disabled={readOnly || model.candidates.length >= 10} onClick={() => add(id)} aria-label={`${L("Add", "Hinzufügen")}: ${templates[id].title[locale]}`}>+ {L("Add", "Hinzufügen")}</button></article>)}</div>
          <div className={styles.row}><button disabled={readOnly || model.candidates.length >= 10} onClick={() => add("custom")}>+ {L("Custom workflow", "Eigener Workflow")}</button><span>{model.candidates.length}/10 {L("candidates", "Kandidaten")}</span></div><div className={styles.stageFooter}><p className={styles.small}>{L("Added workflows stay in your assessment. You can return here to add more.", "Hinzugefügte Workflows bleiben in Ihrer Bewertung. Weitere können Sie hier ergänzen.")}</p><button className={styles.primary} disabled={!model.candidates.length} onClick={() => go(1)}>{L("Assess workflows", "Workflows bewerten")} ({model.candidates.length}) →</button></div>
        </section>
      </div>
      <div className={styles.editor} role="tabpanel" id="finder-panel-1" aria-labelledby="finder-tab-1" hidden={stage !== 1}>
        <section id="finder-assess" className={styles.section} aria-labelledby="assess-title"><div className={styles.sectionHead}><h2 id="assess-title" tabIndex={-1}>{L("What do you know about the work?", "Was wissen Sie über die Arbeit?")}</h2><p>{L("Use evidence where you have it. Leave unknowns visible. A missing answer is different from a negative answer.", "Nutzen Sie vorhandene Belege. Lassen Sie Unbekanntes sichtbar. Eine fehlende Antwort unterscheidet sich von einer negativen Antwort.")}</p></div>
          {!model.candidates.length && <p>{L("Choose a workflow in step 1 to begin.", "Wählen Sie in Schritt 1 einen Workflow, um zu beginnen.")}</p>}
          {model.candidates.map((c, index) => <details id={`candidate-${c.id}`} className={styles.candidate} key={c.id} open={active === c.id} onToggle={e => { if (e.currentTarget.open && active !== c.id) setActive(c.id); }}><summary onClick={e => { e.preventDefault(); setActive(active === c.id ? null : c.id); }}><span>{String(index + 1).padStart(2, "0")} · {candidateName(c, locale)}</span><span>{assess(c).completeness}% {L("answered", "beantwortet")}</span></summary>
            <div className={styles.candidateBody}><div className={styles.twoColumns}><label className={styles.label}>{L("Workflow name (optional)", "Workflowname (optional)")}<input value={c.name} maxLength={100} disabled={readOnly} onChange={e => updateCandidate(c.id, { name: e.target.value })} /></label><label className={styles.label}>{L("Owner name / role (optional)", "Name / Rolle der Verantwortung (optional)")}<input value={c.ownerName} maxLength={100} disabled={readOnly} onChange={e => updateCandidate(c.id, { ownerName: e.target.value })} /></label></div>
              <p className={styles.small}>{L("The ownership answer records your attestation that a named person accepted. Their actual name is optional and excluded from share links by default.", "Die Verantwortungsantwort ist Ihre Angabe, dass eine benannte Person zugesagt hat. Ihr Name ist optional und standardmässig nicht im geteilten Link enthalten.")}</p>
              {groups.map(group => <fieldset key={group.title.en}><legend>{group.title[locale]}</legend><div className={group.keys.length === 3 ? styles.fieldsThree : styles.fields}>{group.keys.map(key => <SelectField<string> key={key} id={`aof-${c.id}-${key}`} label={fieldCopy[key].label[locale]} value={String(c.answers[key])} disabled={readOnly} onChange={value => updateCandidate(c.id, { answers: { ...c.answers, [key]: value === "unknown" || value === "na" ? value : Number(value) as Answer } })} options={[
                { value: "unknown", label: L("Unknown", "Unbekannt") }, ...fieldCopy[key].anchors.map((anchor, i) => ({ value: String(i), label: anchor[locale] })), ...(naFields.includes(key) ? [{ value: "na", label: L("Not applicable (no effort or action)", "Nicht zutreffend (kein Aufwand oder keine Aktion)") }] : []),
              ]} />)}</div></fieldset>)}
              <SelectField<Candidate["task"]> id={`aof-${c.id}-task`} label={L("Task type", "Aufgabentyp")} value={c.task} disabled={readOnly} options={(Object.keys(taskLabels) as Candidate["task"][]).map(value => ({ value, label: taskLabels[value][locale] }))} onChange={task => updateCandidate(c.id, { task })} />
              <details className={styles.evidence} id={`evidence-notes-${c.id}`}><summary>{L("Evidence & notes", "Belege & Notizen")} <span className={styles.small}>{c.notes || c.evidence ? L("Added", "Ergänzt") : L("Optional", "Optional")}</span></summary><div className={styles.twoColumns}><label className={styles.label}>{L("Evidence notes (optional)", "Belegnotizen (optional)")}<textarea rows={3} maxLength={1200} value={c.notes} disabled={readOnly} onChange={e => updateCandidate(c.id, { notes: e.target.value })} /></label><div><label className={styles.label}>{L("Evidence URL (optional, http / https)", "Beleg-URL (optional, http / https)")}<input id={`evidence-${c.id}`} type="url" maxLength={500} value={c.evidence} disabled={readOnly} aria-invalid={!validEvidence(c.evidence)} aria-describedby={`evidence-error-${c.id}`} onChange={e => updateCandidate(c.id, { evidence: e.target.value })} /></label><span id={`evidence-error-${c.id}`} role="status">{!validEvidence(c.evidence) && L("Enter a full http or https URL without embedded credentials, or leave this empty.", "Vollständige http- oder https-URL ohne Zugangsdaten eingeben oder leer lassen.")}</span></div></div>
              <p className={styles.small}>{L("Notes and links document your basis; they are not independently verified or scored. Links are not fetched.", "Notizen und Links dokumentieren Ihre Grundlage; sie werden nicht unabhängig geprüft oder bewertet. Links werden nicht abgerufen.")}</p></details>
              <button className={styles.destructive} disabled={readOnly} onClick={() => { const remaining = draft.candidates.filter(x => x.id !== c.id); edit({ ...draft, candidates: remaining }); setUndo(draft); setActive(remaining[0]?.id ?? null); requestAnimationFrame(() => document.getElementById("assess-title")?.focus()); }}>{L("Remove workflow", "Workflow entfernen")}</button>
            </div>
          </details>)}
          <div className={styles.stageFooter}><button onClick={() => go(0)}>← {L("Add workflows", "Workflows ergänzen")}</button><button className={styles.primary} onClick={() => go(2)}>{L("Compare & plan", "Vergleichen & planen")} →</button></div>
        </section>
      </div>
      <div role="tabpanel" id="finder-panel-2" aria-labelledby="finder-tab-2" className={styles.comparePanel} data-inactive={stage !== 2 || undefined}>
      <Results model={model} locale={locale} onAssess={id => { setActive(id); go(1, `candidate-${id}`); }} onChoose={() => go(0)} />
      <section className={styles.exportPanel} aria-labelledby="export-title"><h2 id="export-title">{L("Save your next steps", "Nächste Schritte mitnehmen")}</h2><div className={styles.actions}><button className={styles.primary} disabled={invalid} onClick={() => setSharing(!sharing)} aria-expanded={sharing}>{L("Share this scenario", "Dieses Szenario teilen")}</button><button onClick={() => window.print()}>{L("Print / Save as PDF", "Drucken / Als PDF speichern")}</button><button disabled={busy || invalid} onClick={async () => { setBusy(true); try { download(await summaryPng(model, locale), `ai-opportunity-finder-${locale}.png`); } catch { setNotice("download"); } finally { setBusy(false); } }}>{busy ? L("Creating image…", "Bild wird erstellt…") : L("Download PNG summary", "PNG-Zusammenfassung herunterladen")}</button></div>
        {sharing && <div className={styles.sharePanel}><h3>{L("Preview what you will share", "Vorschau der geteilten Inhalte")}</h3><p>{L("The link includes function and pain-point selections, workflow templates, every scored answer, task types, and schema/rubric versions. Results are recalculated from that snapshot. Anyone with the link can read it; it is not encrypted.", "Der Link enthält Bereiche, Probleme, Workflowvorlagen, alle Bewertungsantworten, Aufgabentypen und Schema-/Bewertungsversionen. Ergebnisse werden daraus neu berechnet. Alle mit dem Link können ihn lesen; er ist nicht verschlüsselt.")}</p><label className={styles.check}><input type="checkbox" checked={includeText} onChange={e => { setIncludeText(e.target.checked); setLink(""); }} />{L("Also include scenario/workflow names, owner names, evidence notes and links", "Auch Szenario-/Workflownamen, Verantwortliche, Belegnotizen und Links einschliessen")}</label><p className={styles.small}>{includeText ? L("All authored text is included. Review it before creating the link.", "Alle selbst verfassten Texte sind enthalten. Vor dem Erstellen des Links prüfen.") : L("All free text and evidence links are excluded. Custom workflows use a generic label. Scores and ordering are preserved.", "Alle Freitexte und Beleglinks sind ausgeschlossen. Eigene Workflows erhalten eine allgemeine Bezeichnung. Bewertung und Reihenfolge bleiben erhalten.")}</p>
          <details><summary>{L("Inspect the exact included data", "Exakte enthaltene Daten prüfen")}</summary><pre>{invalid ? messages.invalid[locale] : modelJson(shareModel(model, includeText))}</pre></details>
          <button disabled={invalid} onClick={() => { try { setLink(`${"https://www.blockconsult.org"}${localeHref(locale, manifest.publicPath)}${encodeShare(model, includeText)}`); setClipboardFailed(false); } catch (e) { fail(e); } }}>{L("Create share link", "Link erstellen")}</button>
          {link && <><label className={styles.label}>{L("Share link", "Link zum Teilen")}<textarea readOnly value={link} rows={3} onFocus={e => e.target.select()} /></label><button onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice("copied"); setClipboardFailed(false); } catch { setClipboardFailed(true); } }}>{L("Copy link", "Link kopieren")}</button>{clipboardFailed && <p role="status">{L("Clipboard access is unavailable. Select the link above and copy it manually with Ctrl/Cmd+C.", "Zwischenablage nicht verfügbar. Link oben auswählen und mit Strg/Cmd+C kopieren.")}</p>}</>}
        </div>}
      </section>
      </div>
      <details className={styles.methodology}><summary>{L("Methodology & assumptions", "Methodik & Annahmen")} · {RUBRIC_VERSION}</summary><p>{assumptions[locale]}</p><p>{L("Each anchored answer contributes 0, 1 or 2 points in the displayed order. Value averages frequency, time burden and reach. Effort averages systems, exceptions and integration. Readiness averages source quality, source permission, consistency and ownership. Risk averages sensitivity, external actions and error consequences. Each dimension is points ÷ maximum points × 100, rounded to an integer. Existing software and task type select the approach, not the score.", "Jede verankerte Antwort zählt in der gezeigten Reihenfolge 0, 1 oder 2 Punkte. Nutzen mittelt Häufigkeit, Zeitaufwand und Reichweite. Aufwand mittelt Systeme, Ausnahmen und Integration. Bereitschaft mittelt Quellqualität, Freigabe, Konsistenz und Verantwortung. Risiko mittelt Sensibilität, externe Aktionen und Fehlerfolgen. Jede Dimension ist Punkte ÷ Maximalpunkte × 100, ganzzahlig gerundet. Vorhandene Software und Aufgabentyp bestimmen den Ansatz, nicht den Wert.")}</p><p>{L("Unknown contributes 0 to value/readiness and 2 to effort/risk; it always remains unknown in the input basis. Completeness is answered fields out of 15, including task type. Not applicable is available only for systems, integration and external action: it explicitly means no such effort/action and counts as an answered zero, not missing evidence.", "Unbekannt zählt bei Nutzen/Bereitschaft als 0 und bei Aufwand/Risiko als 2 und bleibt in der Eingabebasis unbekannt. Vollständigkeit ist der Anteil beantworteter Felder von 15 einschliesslich Aufgabentyp. Nicht zutreffend ist nur für Systeme, Integration und externe Aktionen möglich: Es bedeutet ausdrücklich keinen solchen Aufwand/keine Aktion und zählt als beantwortete Null, nicht als fehlender Beleg.")}</p><p>{L("Pilot eligibility requires every answer to be known, source access and ownership both at 2, source quality and consistency at least 1, exceptions below 2, and all risk answers below 2. Eligible candidates rank first; within each group the score is 45% value + 25% (100 − effort) + 30% readiness. Ties use the candidate's stable ID in ascending order. Risk gates cannot be offset by value.", "Pilotberechtigung verlangt bekannte Antworten, Zugriff und Verantwortung jeweils 2, Quellqualität und Konsistenz mindestens 1, Ausnahmen unter 2 und alle Risikoantworten unter 2. Berechtigte Kandidaten stehen zuerst; je Gruppe zählt 45 % Nutzen + 25 % (100 − Aufwand) + 30 % Bereitschaft. Gleichstände werden nach stabiler Kandidaten-ID aufsteigend sortiert. Nutzen kann Risikosperren nicht aufheben.")}</p><p>{L("Approach order: unreliable sources, inconsistent process or frequent exceptions → improve the process; remaining blockers or unknowns → investigate; otherwise an available software feature → configure it; rules-based work → conventional automation; language/mixed work → AI assistance with review. Changing the scope or controls requires a fresh assessment.", "Reihenfolge der Ansätze: unzuverlässige Quellen, inkonsistenter Prozess oder häufige Ausnahmen → Prozess verbessern; übrige Sperren oder Unbekanntes → untersuchen; sonst vorhandene Softwarefunktion → konfigurieren; regelbasierte Arbeit → klassische Automatisierung; Sprache/Mischform → KI-Unterstützung mit Prüfung. Änderungen an Umfang oder Kontrollen erfordern eine neue Bewertung.")}</p><p>{L("No uploaded data is sent to a model, chat or contact service. Sharing uses an encoded URL fragment, which is not sent with the page request. Recipients and software handling the URL can still read it. JSON files contain the complete editable model. The PNG contains the top three opportunities and their answer basis. Print includes all candidates.", "Keine hochgeladenen Daten werden an Modelle, Chats oder Kontaktservices gesendet. Geteilt wird über ein kodiertes URL-Fragment, das nicht mit der Seitenanfrage gesendet wird. Empfänger und Software, die den Link verarbeitet, können es dennoch lesen. JSON-Dateien enthalten das vollständige bearbeitbare Modell. Das PNG enthält die drei besten Chancen mit Eingabebasis. Der Druck enthält alle Kandidaten.")}</p></details>
      <aside className={styles.service}><p>{L("Turn a shortlist into an evidence-based decision.", "Aus einer Auswahl eine belegte Entscheidung machen.")}</p><Link href={localeHref(locale, "/services/ai-readiness")}>{L("Explore the AI readiness service", "KI-Readiness-Angebot ansehen")} →</Link></aside>
    </Container>
  </div></>;
}
