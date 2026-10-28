import { beforeEach, describe, expect, it, vi } from 'vitest';
const child = vi.hoisted(() => ({ exec: vi.fn(), input: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: child.exec }));
import { createLocalDocumentRunner } from '../lib/document-security.js';
const settings = { parser: `sha256:${'a'.repeat(64)}`, scanner: `sha256:${'b'.repeat(64)}`, signatures: 'h24-pd03-signatures-test' };

beforeEach(() => {
  vi.resetAllMocks();
  child.exec.mockImplementation((_exe, args, _options, callback) => {
    queueMicrotask(() => callback(null, args.includes('run') ? 'synthetic verdict' : '', ''));
    return { stdin: { on: vi.fn(), end: child.input } };
  });
});
describe('isolated document transport lifecycle', () => {
  it.each(['pdf', 'av'] as const)('isolates %s and does not place file data in command arguments', async kind => {
    const bytes = Buffer.from('synthetic secret file');
    await createLocalDocumentRunner(settings)(kind, bytes);
    const [, args, options] = child.exec.mock.calls[0];
    expect(args).toEqual(expect.arrayContaining(['--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pull', 'never']));
    expect(args).toContain(kind === 'pdf' ? settings.parser : settings.scanner);
    expect(args).toContain(kind === 'pdf' ? '1000:1000' : '100:101');
    expect(args).not.toContain('synthetic secret file');
    expect(args).not.toContain('-p');
    expect(args).not.toContain('-v');
    expect(options.shell).toBe(false);
    expect(options.env).not.toHaveProperty('DB_PASSWORD');
    expect(options.env).not.toHaveProperty('GOOGLE_APPLICATION_CREDENTIALS');
    expect(child.input).toHaveBeenCalledWith(bytes);
    const name = args[args.indexOf('--name') + 1];
    expect(child.exec.mock.calls[1][1]).toEqual(['--context', 'desktop-linux', 'rm', '-f', '-v', name]);
  });
  it('removes the container even when the CLI deadline fires', async () => {
    child.exec.mockImplementationOnce((_exe, _args, _options, callback) => {
      queueMicrotask(() => callback({ killed: true }, '', 'private diagnostic'));
      return { stdin: { on: vi.fn(), end: child.input } };
    });
    await expect(createLocalDocumentRunner(settings)('pdf', Buffer.from('x'))).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE' });
    expect(child.exec).toHaveBeenCalledTimes(2);
    expect(child.exec.mock.calls[1][1]).toContain('rm');
  });
  it('does not accept a verdict when cleanup failed', async () => {
    child.exec.mockImplementation((_exe, args, _options, callback) => {
      queueMicrotask(() => callback(args.includes('rm') ? { code: 1 } : null, '', args.includes('rm') ? 'Docker unavailable' : ''));
      return { stdin: { on: vi.fn(), end: child.input } };
    });
    await expect(createLocalDocumentRunner(settings)('av', Buffer.from('x'))).rejects.toMatchObject({ code: 'DOCUMENT_SECURITY_UNAVAILABLE' });
  });
});
