import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePdfPolicy, PolicyRejection } from './pdf-policy.mjs';

const json = values => ({ qpdf: [{ jsonversion: 2 }, Object.fromEntries(values.map((value, index) => [`obj:${index + 1} 0 R`, { value }]))] });
const rejected = value => assert.throws(() => validatePdfPolicy(value), PolicyRejection);
test('valid static objects and cyclic page parents need no recursive reference traversal', () => {
  validatePdfPolicy(json([{ '/Type': '/Catalog', '/Pages': '2 0 R' }, { '/Type': '/Pages', '/Kids': ['3 0 R'] }, { '/Type': '/Page', '/Parent': '2 0 R' }]));
});
test('HTTPS only for an explicit Link annotation action, including indirect values', () => {
  validatePdfPolicy(json([{ '/Type': '/Annot', '/Subtype': '/Link', '/A': '2 0 R' }, { '/S': '/URI', '/URI': '3 0 R' }, 'u:https://example.invalid/test']));
  for (const uri of ['u:http://example.invalid', 'u:file:///tmp/a', 'u:javascript:void(0)', 'u:https://user:pass@example.invalid', 'u:https://example.invalid\n', 'u:https://example.invalid\\x']) {
    rejected(json([{ '/Type': '/Annot', '/Subtype': '/Link', '/A': { '/S': '/URI', '/URI': uri } }]));
  }
});
test('automatic, unknown, chained and orphan URI actions are rejected', () => {
  rejected(json([{ '/OpenAction': { '/S': '/URI', '/URI': 'u:https://example.invalid' } }]));
  rejected(json([{ '/A': { '/S': '/FutureAction' } }]));
  rejected(json([{ '/Type': '/Action', '/S': '/FutureAction' }]));
  rejected(json([{ '/S': '/URI', '/URI': 'u:https://example.invalid' }]));
  rejected(json([{ '/A': { '/S': '/GoTo', '/D': 'u:page', '/Next': {} } }]));
});
test('internal destinations, inert AcroForm and signature dictionaries remain unchanged', () => {
  const value = json([{ '/OpenAction': ['2 0 R', '/Fit'], '/AcroForm': { '/Fields': ['3 0 R'] } },
    { '/Type': '/Page' }, { '/FT': '/Sig', '/V': '4 0 R' }, { '/Type': '/Sig', '/Contents': 'b:0000', '/ByteRange': [0, 1, 2, 3] }]);
  const before = JSON.stringify(value); validatePdfPolicy(value); assert.equal(JSON.stringify(value), before);
});
test('rejects forbidden functions regardless of object reachability', () => {
  for (const key of ['/JS','/JavaScript','/AA','/XFA','/EF','/EmbeddedFiles','/Collection','/AF','/RichMediaContent','/OPI','/Ref']) rejected(json([{ [key]: {} }]));
  for (const action of ['/Launch','/SubmitForm','/ImportData','/GoToR','/GoToE','/Rendition','/Movie','/Sound','/Named']) rejected(json([{ '/S': action }]));
  for (const type of ['/Filespec','/EmbeddedFile','/Screen','/3D','/FileAttachment']) rejected(json([{ '/Type': type }]));
});
test('rejects external stream data', () => {
  rejected({ qpdf: [{ jsonversion: 2 }, { 'obj:1 0 R': { stream: { dict: { '/F': 'u:external' } } } }] });
});
test('malformed, dangling, alias-cycle, excessive depth and object limits fail closed', () => {
  for (const value of [null, {}, { qpdf: [{ jsonversion: 1 }, {}] }, json([{ '/A': '9 0 R' }]), json(['2 0 R', '1 0 R', { '/A': '1 0 R' }])]) rejected(value);
  let deep = {}; for (let i = 0; i < 70; i++) deep = { '/Child': deep };
  rejected(json([deep])); rejected(json(Array(10_001).fill({})));
});
