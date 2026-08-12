import './styles/operator-credentials.css';

type ProviderKind = 'password' | 'text' | 'email' | 'url';
type Provider = { id: string; key: string; name: string; group: string; hint: string; kind: ProviderKind };
type ProviderStatus = Record<string, { configured: boolean }>;

const form = document.querySelector<HTMLFormElement>('#credential-form');
const result = document.querySelector<HTMLElement>('#result');
const groups = document.querySelector<HTMLElement>('#provider-groups');
const search = document.querySelector<HTMLInputElement>('#provider-search');
const summary = document.querySelector<HTMLElement>('#catalog-summary');
let catalog: Provider[] = [];
let status: ProviderStatus = {};

function setResult(message: string, error = false): void {
  if (!result) return;
  result.textContent = message;
  result.dataset.state = error ? 'error' : 'ok';
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}
function render(): void {
  if (!groups || !summary) return;
  const query = search?.value.trim().toLocaleLowerCase() || '';
  const visible = catalog.filter((provider) => !query || `${provider.name} ${provider.group} ${provider.hint} ${provider.key}`.toLocaleLowerCase().includes(query));
  const grouped = new Map<string, Provider[]>();
  for (const provider of visible) grouped.set(provider.group, [...(grouped.get(provider.group) || []), provider]);
  groups.innerHTML = [...grouped.entries()].map(([group, providers]) => `
    <section class="provider-group"><h2>${escapeHtml(group)}</h2><div class="provider-grid">
      ${providers.map((provider) => {
        const configured = status[provider.id]?.configured === true;
        const type = provider.kind === 'password' ? 'password' : provider.kind;
        return `<article class="provider-card">
          <div class="provider-heading"><h3>${escapeHtml(provider.name)}</h3><span class="status ${configured ? 'configured' : 'unconfigured'}">${configured ? 'Configured' : 'Not configured'}</span></div>
          <p>${escapeHtml(provider.hint)}</p>
          <label for="${escapeHtml(provider.id)}">Replacement value</label>
          <input id="${escapeHtml(provider.id)}" name="${escapeHtml(provider.key)}" type="${type}" autocomplete="off" spellcheck="false" maxlength="4096" />
        </article>`;
      }).join('')}
    </div></section>`).join('');
  summary.textContent = `${visible.length} of ${catalog.length} credential-backed integrations shown.`;
}
async function refreshStatus(): Promise<void> {
  try {
    const response = await fetch('/operator-credentials-api/status', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('status unavailable');
    const data = await response.json() as { providers: ProviderStatus; catalog: Provider[] };
    if (!Array.isArray(data.catalog) || !data.catalog.every((provider) => typeof provider?.id === 'string' && typeof provider?.key === 'string')) throw new Error('invalid catalog');
    catalog = data.catalog;
    status = data.providers || {};
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    setResult(message === 'status unavailable'
      ? 'The provider catalog is temporarily unavailable. Refresh once; if it persists, contact the operator.'
      : 'Unable to read the provider catalog. Your authenticated session may have expired.', true);
  }
}
search?.addEventListener('input', render);
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const entries = catalog.flatMap((provider) => {
    const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(provider.id)}`);
    const value = input?.value.trim() || '';
    return value ? [{ key: provider.key, value }] : [];
  });
  if (entries.length === 0) return setResult('Enter at least one replacement credential.', true);
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  setResult(`Saving ${entries.length} credential${entries.length === 1 ? '' : 's'}…`);
  try {
    const response = await fetch('/operator-credentials-api', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries }),
    });
    if (!response.ok) throw new Error('save failed');
    for (const provider of catalog) {
      const input = document.querySelector<HTMLInputElement>(`#${CSS.escape(provider.id)}`);
      if (input) input.value = '';
    }
    setResult('Saved. Credential values are not available for read-back.');
    await refreshStatus();
  } catch {
    setResult('The credential update was not accepted. Nothing was confirmed saved.', true);
  } finally {
    if (button) button.disabled = false;
  }
});
void refreshStatus();
