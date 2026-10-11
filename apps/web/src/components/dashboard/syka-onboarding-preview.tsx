/** Explicit QA entry, not imported by the product. Uses a real isolated disk store. */
import { render } from "solid-js/web";
import {
  SykaOnboardingSettings,
  type OnboardingClient,
} from "./syka-onboarding-settings";
import { GroqSettings } from "./syka-groq-settings";
import "../../index.css";
const scenario = new URLSearchParams(location.search).get("case") || "empty";
const client: OnboardingClient = async (request) => {
  const response = await fetch(`/onboarding-qa/${scenario}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
};
document.body.style.cssText =
  "background:var(--background);color:var(--foreground);font-family:Inter,sans-serif;margin:0;overflow:auto";
render(
  () => (
    <main style={{ "max-width": "980px", margin: "0 auto", padding: "24px" }}>
      <div
        style={{
          "font-size": "12px",
          color: "var(--muted-foreground)",
          "margin-bottom": "20px",
        }}
      >
        SYKA CLIPS / Configuración
      </div>
      <SykaOnboardingSettings client={client} preview />
      <GroqSettings />
    </main>
  ),
  document.getElementById("root")!,
);
