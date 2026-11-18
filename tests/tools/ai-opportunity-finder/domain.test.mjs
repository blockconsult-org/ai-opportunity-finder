import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, rank, explain, buildReport } from '../../../tools/ai-opportunity-finder/engine.ts';
import { emptyModel, newCandidate, fields, validateModel, parseModel, modelJson, DataError, STORAGE_KEY } from '../../../tools/ai-opportunity-finder/model.ts';
import { preset, templates } from '../../../tools/ai-opportunity-finder/catalog.ts';
import { encodeShare, decodeShare, shareModel, MAX_ENCODED, MAX_DECODED, HASH_PREFIX, saveLocal, loadLocal, deleteLocal, importFile } from '../../../tools/ai-opportunity-finder/persistence.ts';
import { summaryLines } from '../../../tools/ai-opportunity-finder/exports.ts';
const ready = (id = 'ready') => ({ ...preset(0).candidates[0], id });
const model = (...candidates) => ({ ...emptyModel(), candidates });
const bad = value => assert.throws(() => validateModel(value), DataError);

test('high-value, low-effort ready workflow outranks low-value expensive workflow', () => {
  const good = ready('good'), poor = ready('poor');
  Object.assign(poor.answers, { frequency: 0, burden: 0, reach: 0, dependencies: 2, integration: 2, exceptions: 1 });
  assert.equal(rank(model(poor, good))[0].candidate.id, 'good');
  assert.ok(assess(good).priority > assess(poor).priority);
});
test('critical source permission overrides high value and prevents a live pilot', () => {
  const c = ready(); c.answers.access = 0;
  const result = assess(c);
  assert.equal(result.pilotEligible, false);
  assert.ok(result.blockers.includes('access'));
  assert.equal(result.approach, 'investigate');
  const narrative = explain(result, 'en');
  assert.match(narrative.roadmap[0], /source-use approval/);
  assert.match(narrative.roadmap[1], /no live pilot/);
  const low = ready('low'); Object.assign(low.answers, { frequency: 0, burden: 0, reach: 0 });
  assert.equal(rank(model(c, low))[0].candidate.id, 'low');
});
test('unknown readiness never improves readiness and differs from negative evidence', () => {
  for (const field of ['quality', 'access', 'consistency', 'owner']) {
    for (const answer of [0, 1, 2]) {
      const c = ready(); c.answers[field] = answer; const known = assess(c);
      c.answers[field] = 'unknown'; const unknown = assess(c);
      assert.ok(unknown.readiness <= known.readiness);
      assert.ok(unknown.completeness < known.completeness);
      assert.ok(unknown.unknown.includes(field));
      assert.equal(known.unknown.includes(field), false);
    }
  }
});
test('unknown risk is never treated as low risk, and conflicting readiness cannot override severe risk', () => {
  for (const key of ['sensitivity', 'actions', 'consequence']) {
    for (const answer of [2, 'unknown']) {
      const c = ready(); c.answers[key] = answer;
      assert.equal(assess(c).readiness, 100);
      assert.equal(assess(c).pilotEligible, false);
      assert.ok(assess(c).blockers.includes('risk'));
    }
  }
});
test('ties use stable ids and remain stable under reordered input and redaction', () => {
  const a = ready('a'), b = ready('b');
  assert.deepEqual(rank(model(b,a)).map(x=>x.candidate.id), ['a','b']);
  assert.deepEqual(rank(model(a,b)).map(x=>x.candidate.id), ['a','b']);
  assert.deepEqual(rank(shareModel(model(b,a))).map(x=>x.candidate.id), ['workflow-00','workflow-01']);
});
test('single, ten, empty, all unknown, and no suitable pilot cases are finite and explicit', () => {
  assert.equal(rank(model(ready())).length, 1);
  assert.equal(rank(model(...Array.from({length:10}, (_,i)=>ready(String(i))))).length, 10);
  assert.deepEqual(rank(emptyModel()), []);
  const unknown = newCandidate('custom','u'); const r = assess(unknown);
  assert.equal(r.completeness, 0); assert.equal(r.readiness, 0); assert.equal(r.value, 0);
  assert.equal(r.effort, 100); assert.equal(r.risk, 100); assert.equal(r.pilotEligible, false);
  assert.equal(r.unknown.length, 15);
  assert.ok(rank(model(unknown)).every(x=>!x.pilotEligible));
  assert.ok([r.priority,r.value,r.effort,r.readiness,r.risk].every(Number.isFinite));
});
test('known anchors contribute the published points and weights', () => {
  const c = ready(); Object.assign(c.answers, { frequency:0, burden:1, reach:2, dependencies:1, exceptions:1, integration:1, quality:1, consistency:1, sensitivity:0, actions:'na', consequence:0 });
  const r = assess(c);
  assert.equal(r.value, 50); assert.equal(r.effort,50); assert.equal(r.readiness,75); assert.equal(r.risk,0);
  assert.equal(r.priority,58); assert.equal(r.completeness,100);
  assert.equal(r.contributions.find(x=>x.field==='actions').points,0);
});
test('all five approaches follow evidence rather than defaulting to AI', () => {
  const c = ready(); assert.equal(assess(c).approach,'ai');
  c.task='rules'; assert.equal(assess(c).approach,'automation');
  c.answers.existing=2; assert.equal(assess(c).approach,'existing');
  c.answers.access=1; assert.equal(assess(c).approach,'investigate');
  c.answers.consistency=0; assert.equal(assess(c).approach,'process');
});
test('all templates and fictional presets validate, with no network or runtime randomness', () => {
  assert.equal(Object.keys(templates).length,9);
  for(let i=0;i<3;i++) assert.deepEqual(validateModel(preset(i)), preset(i));
});
test('strict imports reject wrong tools, versions, nonfinite values, unknown keys, enums and bounds', () => {
  for (const update of [ {tool:'token-simulator'}, {schemaVersion:2}, {methodologyVersion:'2.0'}, {name:'a'.repeat(101)}, {functions:['x']}, {pains:['errors','errors']}, {candidates:Array.from({length:11}, (_,i)=>ready(String(i)))}, {extra:1} ]) bad({...model(ready()),...update});
  for (const answer of [NaN, Infinity, -1, 3, '2', null, {}, 'na']) { const c=ready(); c.answers.access=answer; bad(model(c)); }
  for (const update of [{task:'ai'}, {template:'other'}, {notes:'x'.repeat(1201)}, {evidence:'javascript:alert(1)'}, {evidence:'https://user:password@example.com'}, {id:'x y'}, {ownerName:42}]) bad(model({...ready(),...update}));
  const c=ready(); delete c.answers.burden; bad(model(c));
  bad(model(ready(),ready())); bad(null); bad([]);
  assert.throws(()=>parseModel('{'),DataError);
  assert.throws(()=>parseModel(' '.repeat(64001)),/tooLarge/);
});
test('JSON round trip preserves the entire editable model safely', () => {
  const m=preset(1); m.name='<img src=x onerror=alert(1)>'; m.candidates[0].notes='Übung & examples'; m.candidates[0].evidence='https://example.com/evidence';
  assert.deepEqual(parseModel(modelJson(m)),m);
});
test('shared links round trip in both text modes without exposing arbitrary ids by default', () => {
  const m=preset(0); m.name='Private'; m.candidates[0].id='private-client'; m.candidates[0].name='Sensitive'; m.candidates[0].ownerName='Person'; m.candidates[0].notes='Confidential'; m.candidates[0].evidence='https://example.com/private';
  assert.deepEqual(decodeShare(encodeShare(m,true)),m);
  const shared=decodeShare(encodeShare(m));
  for(const text of ['Private','private-client','Sensitive','Person','Confidential','https://example.com/private']) assert.equal(JSON.stringify(shared).includes(text),false);
  assert.deepEqual(rank(shared).map(r=>[r.value,r.effort,r.readiness,r.approach,r.blockers]),rank(m).map(r=>[r.value,r.effort,r.readiness,r.approach,r.blockers]));
  assert.equal(shared.candidates.length,3);
});
test('share codec rejects malformed, wrong-version, corrupt UTF-8 and oversized data before use', () => {
  for(const hash of ['#aof=v2.abc','#m=x',HASH_PREFIX+'!',HASH_PREFIX+'a',HASH_PREFIX+'_w', HASH_PREFIX+'a'.repeat(MAX_ENCODED+1)]) assert.throws(()=>decodeShare(hash),DataError);
  const maximal=model(...Array.from({length:10},(_,i)=>({...ready(String(i)),notes:'ü'.repeat(1200)})));
  assert.throws(()=>encodeShare(maximal,true),/tooLarge/);
  assert.ok(decodeShare(encodeShare(maximal)).candidates.length===10);
  assert.ok(MAX_DECODED*4/3<=MAX_ENCODED);
  const wrong=btoa(JSON.stringify({...emptyModel(),tool:'other'})); assert.throws(()=>decodeShare(HASH_PREFIX+wrong),DataError);
});
test('storage is explicit, isolated and reports unavailable storage instead of corrupting data', () => {
  const entries=new Map([['other-tool','keep']]); const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  assert.equal(loadLocal(storage),null); saveLocal(storage,preset(0)); assert.deepEqual(loadLocal(storage),preset(0));
  decodeShare(encodeShare(preset(1))); assert.deepEqual(loadLocal(storage),preset(0));
  deleteLocal(storage); assert.equal(entries.has(STORAGE_KEY),false); assert.equal(entries.get('other-tool'),'keep');
  assert.throws(()=>saveLocal({setItem(){throw new Error('QuotaExceededError');}},preset(0)),/Quota/);
});
test('file imports enforce size before reading and preserve caller state on failure', async () => {
  let read=false; await assert.rejects(importFile({size:64001,text:async()=>{read=true; return '{}';}}),/tooLarge/); assert.equal(read,false);
  assert.deepEqual(await importFile({size:100,text:async()=>modelJson(preset(0))}),preset(0));
  await assert.rejects(importFile({size:2,text:async()=>'{}'}),DataError);
});
test('export explanations, metrics, roadmap and answer basis match the exact visible calculation', () => {
  for(const locale of ['en','de']) {
    const m=preset(2); const report=buildReport(m,locale); const lines=summaryLines(m,locale).join('\n');
    assert.equal(report.rubric,m.methodologyVersion);
    report.ranked.forEach((r,i)=>{
      const expected=rank(m)[i]; assert.equal(r.value,expected.value); assert.equal(r.effort,expected.effort);
      assert.deepEqual(r.roadmap,explain(expected,locale).roadmap);
      for(const line of [...r.roadmap,...r.reasons,r.metric,...r.inputBasis]) assert.ok(lines.includes(line),line);
      assert.equal(r.inputBasis.length,fields.length+1);
    });
    const before=summaryLines(m,locale); m.candidates[0].answers.access=0; const changed=summaryLines(m,locale); assert.notDeepEqual(changed,before);
  }
});
