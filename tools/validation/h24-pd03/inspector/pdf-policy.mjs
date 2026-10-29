export class PolicyRejection extends Error {}
const reject = () => { throw new PolicyRejection('PDF_POLICY_REJECTED'); };
const dict = value => !!value && typeof value === 'object' && !Array.isArray(value);
const reference = value => typeof value === 'string' && /^[1-9]\d* \d+ R$/.test(value);

// Operates on qpdf JSON v2 objects, never on raw PDF strings/streams.
export function validatePdfPolicy(json) {
  if (!dict(json) || !Array.isArray(json.qpdf) || json.qpdf.length !== 2 || json.qpdf[0]?.jsonversion !== 2) reject();
  const objects = json.qpdf[1];
  if (!dict(objects) || Object.keys(objects).length > 10_000) reject();
  const resolve = value => {
    const seen = new Set();
    while (reference(value)) {
      if (seen.has(value) || seen.size >= 64) reject();
      seen.add(value);
      const obj = objects[`obj:${value}`];
      if (!dict(obj) || !Object.hasOwn(obj, 'value')) reject();
      value = obj.value;
    }
    return value;
  };
  const allowedActions = new WeakSet();
  function action(value, httpsAllowed) {
    const target = resolve(value);
    if (!dict(target) || Object.hasOwn(target, '/Next')) reject();
    const type = resolve(target['/S']);
    if (type === '/GoTo') {
      const dest = resolve(target['/D']);
      if (!(typeof dest === 'string' || Array.isArray(dest))) reject();
      if (Object.keys(target).some(k => !['/Type', '/S', '/D'].includes(k))) reject();
    } else if (type === '/URI' && httpsAllowed) {
      const uri = resolve(target['/URI']);
      if (typeof uri !== 'string' || !uri.startsWith('u:https://') || /[\x00-\x20\x7f]/.test(uri)) reject();
      let url;
      try { url = new URL(uri.slice(2)); } catch { reject(); }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || uri.includes('\\')) reject();
      if (Object.keys(target).some(k => !['/Type', '/S', '/URI'].includes(k))) reject();
    } else reject();
    allowedActions.add(target);
  }
  const forbidden = new Set(['/JS', '/JavaScript', '/AA', '/XFA', '/EF', '/EmbeddedFiles', '/Collection',
    '/RichMediaContent', '/RichMediaSettings', '/3DD', '/3DA', '/Movie', '/Sound', '/Rendition', '/OPI', '/Ref',
    '/AlternatePresentations', '/PresSteps', '/SpiderInfo', '/Requirements', '/AF', '/Next']);
  const forbiddenTypes = new Set(['/Filespec', '/EmbeddedFile', '/RichMedia', '/Movie', '/Sound', '/Screen', '/3D', '/FileAttachment']);
  const forbiddenActions = new Set(['/JavaScript', '/Launch', '/SubmitForm', '/ImportData', '/GoToR', '/GoToE',
    '/Rendition', '/Movie', '/Sound', '/Named', '/SetOCGState', '/Hide', '/ResetForm', '/Trans', '/GoTo3DView']);
  let count = 0;
  const dictionaries = [];
  function walk(value, depth = 0, stream = false) {
    if (++count > 150_000 || depth > 64) reject();
    if (reference(value)) { if (!Object.hasOwn(objects, `obj:${value}`)) reject(); return; }
    if (Array.isArray(value)) { for (const child of value) walk(child, depth + 1); return; }
    if (!dict(value)) return;
    dictionaries.push(value);
    for (const key of Object.keys(value)) if (forbidden.has(key)) reject();
    const type = resolve(value['/Type']);
    const subtype = resolve(value['/Subtype']);
    if (forbiddenTypes.has(type) || forbiddenTypes.has(subtype) || forbiddenActions.has(resolve(value['/S']))) reject();
    if (stream && ['/F', '/FFilter', '/FDecodeParms'].some(k => Object.hasOwn(value, k))) reject();
    if (Object.hasOwn(value, '/FT') && !['/Tx', '/Btn', '/Ch', '/Sig'].includes(resolve(value['/FT']))) reject();
    if (Object.hasOwn(value, '/A')) action(value['/A'], type === '/Annot' && subtype === '/Link');
    if (Object.hasOwn(value, '/OpenAction')) {
      const open = resolve(value['/OpenAction']);
      if (Array.isArray(open)) { if (!open.length) reject(); }
      else action(open, false);
    }
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  // Scan all objects, including unreferenced objects, without following cyclic page parents.
  for (const [key, object] of Object.entries(objects)) {
    if (key !== 'trailer' && !/^obj:[1-9]\d* \d+ R$/.test(key)) reject();
    if (!dict(object)) reject();
    if (Object.hasOwn(object, 'value')) walk(object.value);
    else if (dict(object.stream) && dict(object.stream.dict)) walk(object.stream.dict, 0, true);
    else reject();
  }
  for (const value of dictionaries) {
    if ((resolve(value['/Type']) === '/Action' || Object.hasOwn(value, '/URI') || resolve(value['/S']) === '/URI') &&
        !allowedActions.has(value)) reject();
  }
}
