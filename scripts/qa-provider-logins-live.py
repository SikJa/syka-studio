"""Validate the real provider preview, without model turns or account changes.

An optional --login-links starts then cancels Codex/Claude's own browser login.
Only URL host/path and code presence are recorded; no credentials or OAuth state.
"""
import argparse
import json
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '.runtime/token-usage-review/python'))
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--login-links', action='store_true')
args = parser.parse_args()
output = ROOT / 'output/provider-logins-live-20261011'
output.mkdir(parents=True, exist_ok=True)
checks, errors, native = [], [], []

def check(name, passed):
    checks.append({'name': name, 'passed': bool(passed)})
    if not passed:
        raise AssertionError(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1100, 'height': 1000}, reduced_motion='reduce')
    page.on('pageerror', lambda error: errors.append(str(error)))
    # Block remote requests from this inspection browser. Native provider
    # processes still negotiate real authorization with their own service.
    page.route('https://**/*', lambda route: route.abort())
    def record(message):
        try:
            payload = json.loads(message)
            if payload.get('t') == 'harnesses':
                native[:] = payload['harnesses']
        except Exception:
            pass
    page.on('websocket', lambda socket: socket.on('framereceived', record))
    try:
        page.goto('http://localhost:5188/qa/providers-live.html', wait_until='domcontentloaded')
        page.wait_for_load_state('networkidle')
        # Inspect the real mounted DOM before clicking controls.
        page.screenshot(path=str(output / '01-overview.png'), full_page=True)
        expect(page.locator('[data-live-connection="open"]')).to_be_visible(timeout=15000)
        check('preview connects to the real backend', True)
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline and (len(native) < 7 or any(h['status'] == 'checking' for h in native if h['id'] != 'muse')):
            page.wait_for_timeout(250)
        check('all active provider rows are present', page.locator('.syka-model-card[data-provider]').count() == 7)
        check('connection controls precede visibility preferences', page.locator('.syka-model-card').first.bounding_box()['y'] < page.get_by_text('Modelos visibles', exact=True).bounding_box()['y'])
        check('connection screen contains no documentation links or command walkthroughs', page.locator('.syka-model-card a').count() == 0 and page.locator('.syka-model-card ol').count() == 0)
        check('catalog is not the simulated QA catalog', not any(h.get('version') == 'fixture' or 'simulada' in h.get('detail', '').lower() or any(m['id'] == 'qa-model' for m in h['models']) for h in native))
        summary = [{'id': h['id'], 'status': h['status'], 'version': h.get('version'), 'modelCount': len(h['models']), 'authMethods': [m['id'] for m in h.get('authMethods', [])]} for h in native if h['id'] != 'muse']
        (output / 'provider-status.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        page.screenshot(path=str(output / '02-native-status.png'), full_page=True)
        if args.login_links:
            for provider, allowed in [('codex', {'auth.openai.com', 'chatgpt.com', 'auth.chatgpt.com'}), ('claude', {'claude.ai', 'claude.com', 'platform.claude.com', 'console.anthropic.com'})]:
                row = page.locator(f'[data-provider="{provider}"]')
                ready = row.locator('[data-ready="true"]').count() > 0
                if ready:
                    row.get_by_role('button', name='Elegir modelo', exact=True).click()
                    row.get_by_role('button', name='Conectar otra cuenta', exact=True).click()
                    row.get_by_role('button', name='Vincular con un código' if provider == 'codex' else 'Login oficial de Claude Code', exact=True).click()
                else:
                    row.get_by_role('button', name='Vincular con un código de ChatGPT' if provider == 'codex' else 'Conectar Claude', exact=True).click()
                panel = row.locator('.syka-provider-login')
                try:
                    expect(panel.locator('a')).to_be_visible(timeout=150000)
                    url = urlsplit(panel.locator('a').get_attribute('href'))
                    check(provider + ' publishes a real official authorization URL', url.scheme == 'https' and url.hostname in allowed and '/docs' not in url.path)
                    check(provider + ' login flow does not require commands or documentation', row.locator('ol').count() == 0 and row.locator('a').count() == 1)
                    flow = {'provider': provider, 'phase': panel.get_attribute('data-auth-phase'), 'authorizationHost': url.hostname, 'authorizationPath': url.path, 'deviceCodePresent': panel.locator('.syka-provider-device-code strong').count() > 0, 'authorizationInputPresent': panel.locator('input[aria-label="Código de autorización"]').count() > 0, 'completedLogin': False, 'inference': False}
                    (output / (provider + '-authorization.json')).write_text(json.dumps(flow, ensure_ascii=False, indent=2), encoding='utf-8')
                finally:
                    cancel = panel.get_by_role('button', name='Cancelar conexión', exact=True)
                    if cancel.count() > 0:
                        cancel.click()
                        expect(panel).to_have_attribute('data-auth-phase', 'cancelled', timeout=15000)
                check(provider + ' login can be canceled from the app', panel.get_attribute('data-auth-phase') == 'cancelled')
                if ready:
                    check(provider + ' cancellation preserves its existing connection', row.locator('[data-ready="true"]').count() > 0)
        check('no browser runtime errors', not errors)
        page.screenshot(path=str(output / '03-final.png'), full_page=True)
    finally:
        browser.close()
        result_name = 'auth-ui-result.json' if args.login_links else 'ui-result.json'
        (output / result_name).write_text(json.dumps({'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': sum(c['passed'] for c in checks), 'total': len(checks), 'errors': errors}, ensure_ascii=False))
