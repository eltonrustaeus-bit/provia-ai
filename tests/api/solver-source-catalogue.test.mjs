import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const S = require('../../api/_solver.js');
const { filterSourceReferences } = require('../../api/_source-references.cjs');
const question = { id: 'q', type: 'mc', question: 'Vilken process kan ske både dag och natt?',
  options: ['Fotosyntes', 'Cellandning', 'Diffusion'], correct_index: 1 };
function verdict(ids, change = {}) {
  return { id: 'q', source_check: { premise_supported: true, independent_answer: 'Cellandning',
    basis: 'source_fact', evidence_source_ids: ids, option_matches: [false, true, false] },
    option_verdicts: [false, true, false], option_plausibility: [true, true, true],
    index: 1, confidence: 1, reason: 'Synthetic verdict', ...change };
}
async function call(material, item, inspect = () => {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, request) => {
    inspect(JSON.parse(request.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify({ results: [item] }) }));
  };
  try { return await S.solveQuestions([question], { apiKey: 'synthetic', model: 'synthetic', lang: 'sv', material }); }
  finally { globalThis.fetch = original; }
}

test('source units preserve full words, Unicode, decimal and whitespace boundaries without invented text', () => {
  const material = ('Vid pH 7.4 sker detta bara om villkoret gäller. Åäö e\u0301 🔬.\n\t').repeat(30);
  const units = S.buildSourceUnits(material);
  assert.ok(units.length > 1);
  assert.equal(units.map(unit => unit.text).join(' ').replace(/\s+/gu, ' ').trim(), material.replace(/\s+/gu, ' ').trim());
  for (const [index, unit] of units.entries()) {
    assert.equal(unit.id, index);
    assert.ok(unit.text.length <= 500);
    assert.ok(material.includes(unit.text));
    assert.equal(filterSourceReferences(material, [unit.text]).length, 1);
  }
  assert.deepEqual(S.buildSourceUnits('  \n\t '), []);
  assert.deepEqual(S.buildSourceUnits('x'.repeat(501)), []);
  assert.deepEqual(S.buildSourceUnits('Först. ' + 'x'.repeat(501) + ' Sist.'),
    [{ id: 0, text: 'Först.' }, { id: 1, text: 'Sist.' }]);
});

test('wire indices resolve to exact request excerpts and cannot invent or duplicate provenance', async () => {
  const unit = ('Testfakta '.repeat(49) + 'Källa.').padEnd(500, ' ');
  const material = unit + '\n' + unit;
  const units = S.buildSourceUnits(material);
  assert.equal(units.length, 2);
  assert.equal(units[0].text, units[1].text);
  const duplicate = await call(material, verdict([0, 1]));
  assert.equal(duplicate.callOk, false);
  assert.equal(duplicate.contractFailure, 'source_quote_duplicate');
  const compactSource = JSON.stringify({ padding: 'x'.repeat(501), fuel: 'glucose' });
  const compactUnits = S.buildSourceUnits(compactSource);
  const fuel = compactUnits.find(unit => unit.text.includes('fuel') && unit.text.includes('glucose'));
  assert.ok(fuel, 'long whitespace-free JSON retains its citable property');
  assert.equal(filterSourceReferences(compactSource, [fuel.text]).length, 1);
  const compact = await call(compactSource, verdict([fuel.id]));
  assert.equal(compact.callOk, true);
  assert.deepEqual(compact.perQuestion.get('q').source_check.evidence_quotes, [fuel.text]);
  const empty = await call('', verdict([0]));
  assert.equal(empty.callOk, false);
  assert.equal(empty.contractFailure, 'source_id_range');
  const success = await call('Ånga kan kondensera.\nVatten kan frysa.', verdict([0]), body => {
    const content = body.input.find(item => item.role === 'user').content;
    const [source, rest] = content.split('\n\nKällutdrag:\n');
    assert.equal(source, 'Material:\nÅnga kan kondensera.\nVatten kan frysa.');
    assert.deepEqual(JSON.parse(rest.split('\n\nFrågor:\n')[0]), S.buildSourceUnits(source.slice('Material:\n'.length)));
    assert.equal(content.includes('correct_index'), false, 'answer key stays hidden from solver');
  });
  assert.equal(success.callOk, true);
  assert.deepEqual(success.perQuestion.get('q').source_check.evidence_quotes, ['Ånga kan kondensera.\nVatten kan frysa.']);
});

test('valid source references never override multiple correct options or uncertainty', async () => {
  const material = 'Cellandning kan ske både dag och natt. Diffusion beror på koncentrationsskillnader.';
  for (const change of [
    { source_check: { premise_supported: true, independent_answer: 'Cellandning och diffusion', basis: 'source_fact',
      evidence_source_ids: [0], option_matches: [false, true, true] }, option_verdicts: [false, true, true], index: -1 },
    { index: -2 },
  ]) {
    const result = await call(material, verdict([0], change));
    assert.equal(result.callOk, true, 'complete wire audit is parsed');
    assert.equal(S.decideKeep(result.perQuestion.get('q'), question, material).keep, false);
  }
  // This tests response handling, not whether a real model finds the ambiguity.
});
