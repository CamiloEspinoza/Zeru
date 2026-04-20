import { loadPrompt, renderPrompt } from './prompt-loader';

describe('loadPrompt', () => {
  it('loads a prompt file by key', () => {
    const tpl = loadPrompt('_example');
    expect(tpl.key).toBe('_example');
    expect(tpl.body).toContain('{{ruleId}}');
    expect(tpl.body).toContain('{{reportText}}');
  });

  it('throws when the prompt file does not exist', () => {
    expect(() => loadPrompt('does-not-exist')).toThrow(/prompt file not found/i);
  });

  it('rejects keys that escape the prompts directory', () => {
    expect(() => loadPrompt('../../etc/passwd')).toThrow(/invalid prompt key/i);
    expect(() => loadPrompt('sub/nested')).toThrow(/invalid prompt key/i);
  });
});

describe('renderPrompt', () => {
  it('interpolates variables surrounded by {{ }}', () => {
    const out = renderPrompt('Hello {{name}}, rule {{ruleId}}.', {
      name: 'Camilo',
      ruleId: 'V001',
    });
    expect(out).toBe('Hello Camilo, rule V001.');
  });

  it('leaves unknown placeholders intact but emits a dev warning', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const out = renderPrompt('Hello {{name}}, missing {{foo}}.', { name: 'x' });
    expect(out).toBe('Hello x, missing {{foo}}.');
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/unresolved placeholder/i));
    spy.mockRestore();
  });

  it('escapes {{ }} inside values to prevent re-interpolation', () => {
    const out = renderPrompt('{{a}}', { a: '{{b}}' });
    expect(out).toBe('{{b}}');
    // render again to prove it is treated as literal
    const again = renderPrompt(out, { b: 'ESCAPED' });
    expect(again).toBe('{{b}}'); // no re-expansion because body comes as-is
  });
});
