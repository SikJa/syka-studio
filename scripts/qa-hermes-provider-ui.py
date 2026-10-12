"""Exercise real Syka views with the explicitly simulated provider QA host.

Requires a running Vite preview and apps/web/qa/provider-host.ts. It does not
start/stop Vite, open OAuth, execute model turns or access user projects/accounts.
Generated fixtures/screenshots stay in the named QA directories.
"""
import argparse
import json
from pathlib import Path
import sys
from urllib.parse import quote, urlsplit


ROOT = Path(__file__).resolve().parent.parent


def prepare(qa_root, base_url):
    endpoint = json.loads((qa_root / "endpoint.json").read_text(encoding="utf-8"))["url"]
    parsed = urlsplit(endpoint)
    if parsed.scheme != "ws" or parsed.hostname not in ("localhost", "127.0.0.1"):
        raise ValueError("Only the local simulated QA endpoint is allowed")
    fixture = qa_root / "provider-validation.tsx"
    fixture.write_text("""import {render} from 'solid-js/web';
import {Router,Route} from '@solidjs/router';
import {createEffect,createSignal,Show} from 'solid-js';
import {AuthProvider} from '/src/context/auth.tsx';
import {Composer} from '/src/agent-chat/mirel-composer.tsx';
import {currentModel,setStoredModel} from '/src/agent-chat/store.ts';
import {ProviderSettings} from '/src/components/dashboard/provider-settings.tsx';
import {DashboardHomeView} from '/src/components/dashboard/home-view.tsx';
import '/src/index.css';
function QA(){
 const [tab,setTab]=createSignal('chat'),[text,setText]=createSignal(''),[files,setFiles]=createSignal([]);
 createEffect(()=>{window.__sykaQA.selection=currentModel()});
 return <main style={{padding:'20px',color:'#eee',background:'#101011','min-height':'100vh'}}>
  <p style={{'font-size':'12px',color:'#aaa','margin-bottom':'12px'}}>QA SIMULADA · UI real · cuentas y catálogo ficticios · sin OAuth ni inferencia</p>
  <nav style={{display:'flex',gap:'16px','margin-bottom':'16px'}}><button onClick={()=>setTab('chat')}>Chat</button><button onClick={()=>setTab('home')}>Inicio</button><button onClick={()=>setTab('settings')}>Configuración</button></nav>
  <Show when={tab()==='settings'}><div style={{'max-width':'800px'}}><ProviderSettings/></div></Show>
  <Show when={tab()==='home'}><DashboardHomeView/></Show>
  <Show when={tab()==='chat'}><section class="syka-agent-chat" style={{display:'flex','flex-direction':'column',height:'380px',width:'min(350px,100%)',overflow:'hidden'}}>
   <div style={{flex:1,padding:'16px'}}>Conversación simulada; no se envían turnos.</div>
   <Composer projectDir="" chatKey="qa-hermes-ui" text={text()} onText={setText} attachments={files()} onAttachments={setFiles} model={currentModel()} onModel={setStoredModel} running={false} waiting={false} blocked={null} onSend={()=>{throw Error('QA no ejecuta turnos')}} onStop={()=>{}}/>
  </section></Show>
 </main>;
}
render(()=><AuthProvider><Router><Route path="*all" component={QA}/></Router></AuthProvider>,document.getElementById('root')!);
""", encoding="utf-8")
    shim = """const listeners=new Map();
window.__sykaQA={external:[],requests:[]};
window.desktop={platform:'win32',on(channel,fn){const group=listeners.get(channel)||new Set();group.add(fn);listeners.set(channel,group);return()=>group.delete(fn);},send(channel,request){
 if(channel!=='main:request')return;
 window.__sykaQA.requests.push(request.channel);
 let data;
 if(request.channel==='agent-chat:endpoint')data={url:QA_ENDPOINT};
 else if(request.channel==='app:open-external'){window.__sykaQA.external.push(request.data.url);data=undefined;}
 else if(request.channel==='projects:scan')data=[];
 else if(request.channel==='projects:default-root'||request.channel==='projects:pick-root'||request.channel==='projects:pick-folder')data=null;
 else if(request.channel==='syka-groq:status')data={configured:false};
 queueMicrotask(()=>{for(const fn of listeners.get('main:response')||[])fn({id:request.id,ok:true,data});});
}};
""".replace("QA_ENDPOINT", json.dumps(endpoint))
    page = qa_root / "provider-validation.html"
    page.write_text("<!doctype html><html lang=\"es\" data-kb-theme=\"dark\"><head><meta charset=\"UTF-8\"><title>Syka · Hermes y conexión · QA SIMULADA</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body><div id=\"root\"></div><script>" + shim + "</script><script type=\"module\" src=\"./provider-validation.tsx\"></script></body></html>", encoding="utf-8")
    return base_url.rstrip("/") + "/@fs/" + quote(page.as_posix(), safe="/:")


def run(url, output):
    # Reuse the existing task-local Python Playwright package; bundled Python is
    # isolated and does not automatically pick up PYTHONPATH.
    existing = ROOT / ".runtime/token-usage-review/python"
    if existing.is_dir():
        sys.path.insert(0, str(existing))
    from playwright.sync_api import sync_playwright, expect
    checks, errors = [], []

    def check(name, passed, detail=None):
        checks.append({"name": name, "passed": bool(passed), **({"detail": detail} if detail else {})})

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1100, "height": 900}, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        # Browser UI only: prevent fonts/telemetry or accidental live login.
        page.route("https://**/*", lambda route: route.abort())
        try:
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            expect(page.get_by_text("QA SIMULADA · UI real", exact=False)).to_be_visible()
            expect(page.get_by_role("button", name="Elegir modelo y esfuerzo")).to_be_visible()
            page.get_by_role("button", name="Configuración", exact=True).click()
            antigravity = page.locator('[data-provider="antigravity"]')
            expect(antigravity.get_by_text("Conexión disponible", exact=True)).to_be_visible()
            antigravity.get_by_role("button", name="Elegir modelo", exact=True).click()
            expect(antigravity.get_by_role("button", name="Modelo de prueba Elegir", exact=False)).to_be_visible()
            expect(antigravity.get_by_role("button", name="Conectar otra cuenta", exact=True)).to_have_count(0)
            expect(antigravity.locator('.syka-provider-auth-methods')).to_have_count(0)
            check("Antigravity conectado conserva modelos y no ofrece un cambio de cuenta desde Syka", True)
            expect(antigravity.get_by_text("Usás la cuenta conectada en Antigravity.", exact=False)).to_be_visible()
            antigravity.get_by_role("button", name="Volver a comprobar", exact=True).click()
            expect(antigravity.get_by_text("Conexión disponible", exact=True)).to_be_visible()
            expect(antigravity.locator('.syka-provider-login')).to_have_count(0)
            check("Antigravity permite comprobar su cuenta existente sin iniciar otro login", True)
            page.screenshot(path=str(output / "00-antigravity-cuenta-existente.png"), full_page=True)
            antigravity.get_by_role("button", name="Elegir modelo", exact=True).click()
            hermes = page.locator('[data-provider="hermes"]')
            expect(hermes.get_by_role("button", name="Conectar Hermes", exact=True)).to_be_visible()
            hermes.get_by_role("button", name="Conectar Hermes", exact=True).click()
            expect(hermes.get_by_role("button", name="Nous Portal · código (simulado)", exact=True)).to_be_visible()
            hermes.get_by_role("button", name="Nous Portal · código (simulado)", exact=True).click()
            panel = hermes.locator('.syka-provider-login[data-auth-phase="waiting"]')
            expect(panel.get_by_text("QA12-AB34", exact=True)).to_be_visible()
            link = panel.get_by_role("link", name="Abrir inicio de sesión oficial", exact=False)
            expect(link).to_have_attribute("href", "https://portal.nousresearch.com/device?syka_qa=simulado")
            link.click()
            check("el enlace abre el IPC de navegador con la URL del proveedor", page.evaluate("window.__sykaQA.external.at(-1)") == "https://portal.nousresearch.com/device?syka_qa=simulado")
            check("conectar muestra código y estado simulado", "SIMULADO" in panel.inner_text())
            page.screenshot(path=str(output / "01-login-simulado.png"), full_page=True)
            panel.get_by_role("button", name="Cancelar conexión", exact=True).click()
            expect(hermes.locator('[data-auth-phase="cancelled"]')).to_be_visible()
            expect(hermes.get_by_role("button", name="Conectar Hermes", exact=True)).to_be_enabled()
            check("cancelar restaura la opción de conectar", True)

            hermes.get_by_role("button", name="Conectar Hermes", exact=True).click()
            hermes.get_by_role("button", name="ChatGPT / Codex · código (simulado)", exact=True).click()
            panel = hermes.locator('.syka-provider-login[data-auth-phase="waiting"]')
            expect(panel.get_by_text("QA12-AB34", exact=True)).to_be_visible()
            panel.get_by_role("textbox", name="Código de autorización", exact=True).fill("APROBAR")
            panel.get_by_role("button", name="Verificar código", exact=True).click()
            expect(hermes.locator('[data-auth-phase="connected"]')).to_be_visible()
            expect(hermes.get_by_role("button", name="Elegir modelo", exact=True)).to_be_visible()
            check("auth.respond completa la autorización ficticia", True)
            choose_models = hermes.get_by_role("button", name="Elegir modelo", exact=True)
            if choose_models.get_attribute("aria-expanded") != "true":
                choose_models.click()
            expect(hermes.get_by_role("button", name="GPT-5.6-Sol Elegir", exact=False)).to_be_visible()
            check("Hermes muestra nombres de modelos específicos en configuración", "ChatGPT or Codex Subscription" not in hermes.inner_text() and "Hermes 4 70B" in hermes.inner_text())
            page.screenshot(path=str(output / "02-modelos-configuracion.png"), full_page=True)

            page.get_by_role("button", name="Chat", exact=True).click()
            trigger = page.get_by_role("button", name="Elegir modelo y esfuerzo", exact=True)
            trigger.click()
            menu = page.get_by_role("dialog", name="Ajustes de modelo", exact=True)
            radio = menu.get_by_role("radio").filter(has=page.locator('[data-provider="hermes"]')).filter(has_text="GPT-5.6-Sol")
            expect(radio).to_have_count(1)
            radio.click()
            expect(trigger).to_contain_text("GPT-5.6-Sol")
            expect(radio).to_have_attribute("aria-checked", "true")
            effort = menu.get_by_role("slider", name="Esfuerzo", exact=True)
            expect(effort).to_be_enabled()
            effort.focus(); effort.press("End")
            expect(effort).to_have_attribute("aria-valuetext", "Máximo")
            current = page.evaluate("window.__sykaQA.selection")
            check("chat conserva el modelo y el esfuerzo elegidos en el estado real", current and current.get("harness") == "hermes" and current.get("model") == "openai-codex:gpt-5.6-sol" and current.get("effort") == "max", current)
            check("selector muestra solamente modelos en el catálogo desplazable", menu.locator('.agent-composer-provider-statuses button').count() == 0)
            check("las filas Hermes tienen logo y nombre específicos", radio.locator('svg').count() > 0 and "ChatGPT or Codex Subscription" not in radio.inner_text())
            check("acceso a configuración queda fuera de la lista desplazable", menu.locator('.agent-composer-model-catalog .agent-composer-configure').count() == 0 and menu.get_by_role("button", name="Configurar agentes y modelos", exact=False).is_visible())
            bounds = menu.bounding_box()
            check("popover del chat queda entero en la ventana", bounds and bounds["x"] >= 0 and bounds["y"] >= 0 and bounds["x"] + bounds["width"] <= 1100 and bounds["y"] + bounds["height"] <= 900)
            page.screenshot(path=str(output / "03-chat-hermes-esfuerzo.png"), full_page=True)
            trigger.click()

            page.get_by_role("button", name="Inicio", exact=True).click()
            home_trigger = page.get_by_role("button", name="Elegir modelo y esfuerzo", exact=True)
            expect(home_trigger).to_contain_text("GPT-5.6-Sol")
            home_trigger.click()
            home_menu = page.get_by_role("dialog", name="Ajustes de modelo", exact=True)
            expect(home_menu.get_by_role("slider", name="Esfuerzo", exact=True)).to_have_attribute("aria-valuetext", "Máximo")
            check("Inicio usa el mismo modelo y esfuerzo que Chat", True)
            page.screenshot(path=str(output / "04-inicio-hermes-esfuerzo.png"), full_page=True)
            home_trigger.click()

            page.set_viewport_size({"width": 430, "height": 700})
            page.get_by_role("button", name="Chat", exact=True).click()
            trigger = page.get_by_role("button", name="Elegir modelo y esfuerzo", exact=True)
            trigger.click()
            menu = page.get_by_role("dialog", name="Ajustes de modelo", exact=True)
            bounds = menu.bounding_box()
            check("popover completo en ventana angosta", bounds and bounds["x"] >= 0 and bounds["y"] >= 0 and bounds["x"] + bounds["width"] <= 430 and bounds["y"] + bounds["height"] <= 700)
            page.screenshot(path=str(output / "05-chat-angosto.png"), full_page=True)
            check("sin errores JavaScript en las vistas reales", not errors, errors or None)
        except Exception as error:
            check("recorrido UI completado", False, str(error))
            page.screenshot(path=str(output / "failure.png"), full_page=True)
        finally:
            browser.close()
    result = {"simulated": True, "oauthStarted": False, "inferenceStarted": False, "uiUrl": url, "checks": checks, "pageErrors": errors}
    (output / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"simulated": True, "passed": sum(item["passed"] for item in checks), "total": len(checks), "output": str(output), "uiUrl": url}, ensure_ascii=False))
    return 0 if checks and all(item["passed"] for item in checks) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:5188")
    parser.add_argument("--qa-root", type=Path, default=ROOT / ".runtime/hermes-provider-ui-qa")
    parser.add_argument("--output", type=Path, default=ROOT / "output/hermes-provider-ui-qa-20261011")
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    url = prepare(args.qa_root.resolve(), args.base_url)
    if args.prepare_only:
        print(json.dumps({"simulated": True, "uiUrl": url}, ensure_ascii=False)); return 0
    return run(url, args.output.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
