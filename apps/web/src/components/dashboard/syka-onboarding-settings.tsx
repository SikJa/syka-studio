import {
  createResource,
  createSignal,
  For,
  Show,
  createUniqueId,
  type JSX,
} from "solid-js";
import { MAIN_CHANNELS } from "@desktop/main-channels";
import {
  newBrandKit,
  publicationStatus,
  type BrandKit,
  type BrandRequest,
  type BrandResponse,
  type ConnectionStatus,
  type Answers,
  type AnswerKey,
} from "@desktop/syka-onboarding-contract";
import { mainBridge } from "@/lib/ipc";
import { openSettings } from "@/components/settings/state";
import "./syka-onboarding.css";

export type OnboardingClient = (
  request: BrandRequest,
) => Promise<BrandResponse>;
const desktopClient: OnboardingClient = (request) =>
  mainBridge.call(MAIN_CHANNELS.SYKA_ONBOARDING, request);

export function OnboardingDisclosure(props: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: JSX.Element;
}) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  const panel = createUniqueId();
  return (
    <div class="t-acc syka-guide" data-open={String(open())}>
      <button
        class="t-acc-head"
        aria-expanded={open()}
        aria-controls={panel}
        onClick={() => setOpen(!open())}
      >
        <span>
          {props.title}
          <Show when={props.description}>
            <small>{props.description}</small>
          </Show>
        </span>
        <span class="t-acc-chevron">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
          >
            <path d="M4 6.5L8 10.5L12 6.5" />
          </svg>
        </span>
      </button>
      <div id={panel} class="t-acc-panel" inert={!open()} aria-hidden={!open()}>
        <div class="t-acc-panel-inner">
          <div class="syka-guide-content">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export function OfficialLink(props: { href: string; children: JSX.Element }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (window.desktop) {
          event.preventDefault();
          void mainBridge.call(MAIN_CHANNELS.APP_OPEN_EXTERNAL, {
            url: props.href,
          });
        }
      }}
    >
      {props.children} ↗
    </a>
  );
}

const connectionLabels = {
  unknown: "Pendiente de integración",
  unconfigured: "Sin configurar",
  configured: "Configurado · sin comprobar",
  verified: "Acceso comprobado",
  error: "Revisar conexión",
};
const questions: { key: AnswerKey; label: string; placeholder: string }[] = [
  {
    key: "purpose",
    label: "Qué buscás con tus videos",
    placeholder: "Ej. explicar productos con ejemplos concretos",
  },
  {
    key: "destination",
    label: "Destino habitual",
    placeholder: "Ej. YouTube; cada proyecto puede cambiarlo",
  },
  {
    key: "reference",
    label: "Referencia de video (opcional)",
    placeholder: "https://…",
  },
  {
    key: "referenceAspect",
    label: "Qué te interesa de la referencia",
    placeholder: "Ej. ritmo, encuadre o uso del texto",
  },
];

export function SykaOnboardingSettings(props: {
  client?: OnboardingClient;
  publication?: ConnectionStatus;
  preview?: boolean;
}) {
  const call = props.client ?? desktopClient;
  const [data, { mutate, refetch }] = createResource(() =>
    call({ action: "get" }),
  );
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  const [error, setError] = createSignal("");
  const [draft, setDraft] = createSignal<BrandKit>();
  const [dirty, setDirty] = createSignal(false);
  const [colors, setColors] = createSignal("");
  const [fonts, setFonts] = createSignal("");
  const [refs, setRefs] = createSignal("");
  const [makeDefault, setDefault] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const state = () => (data.error ? undefined : data()?.state);
  const revision = () => state()?.revision ?? 0;
  const select = (kit: BrandKit) => {
    setDraft(structuredClone(kit));
    setColors(kit.colors.join(", "));
    setFonts(kit.fonts.join(", "));
    setRefs(kit.references.join("\n"));
    setDefault(state()?.defaultKitId === kit.id);
    setDirty(false);
    setDeleting(false);
    setError("");
  };
  const edit = (key: "name" | "tone" | "notes", value: string) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
  };
  const run = async (request: BrandRequest, success: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await call(request);
      mutate(result);
      if (!result.cancelled) {
        setMessage(
          result.projectName
            ? `Kit guardado en «${result.projectName}».`
            : success,
        );
        if (
          draft() &&
          ["save", "import", "remove-asset", "delete"].includes(request.action)
        ) {
          const saved = result.state.kits.find((k) => k.id === draft()!.id);
          if (saved) select(saved);
          else if (request.action === "delete") setDraft(undefined);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const kit = draft();
    if (!kit) return;
    void run(
      {
        action: "save",
        revision: revision(),
        kit: {
          ...kit,
          colors: colors()
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          fonts: fonts()
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          references: refs()
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean),
        },
        makeDefault: makeDefault(),
      },
      "Brand Kit guardado.",
    );
  };
  const answer = (
    key: AnswerKey,
    status: "accepted" | "unknown" | "skipped",
    value?: string,
  ) => {
    const answers: Answers = {
      ...state()?.answers,
      [key]: { state: status, value, updatedAt: new Date().toISOString() },
    };
    void run(
      { action: "answers", revision: revision(), answers },
      "Preferencia guardada. Podés cambiarla cuando quieras.",
    );
  };
  return (
    <div class="syka-onboarding">
      <Show when={props.preview}>
        <p class="syka-preview-label">
          PREVIEW AISLADA · datos de prueba · sin proveedores
        </p>
      </Show>
      <Show when={data.loading}>
        <p role="status">Cargando tu configuración…</p>
      </Show>
      <Show when={data.error}>
        <div role="alert" class="syka-error">
          No se pudo abrir la configuración.{" "}
          <button onClick={() => void refetch()}>Reintentar</button>
        </div>
      </Show>
      <Show when={state()}>
        <section class="syka-setup-intro">
          <div>
            <span class="syka-eyebrow">TU ESPACIO DE EDICIÓN</span>
            <h2>
              {state()?.dismissed
                ? "A tu ritmo"
                : "Empezá por lo que necesitás"}
            </h2>
            <p>
              Podés editar y exportar sin conectar servicios ni cargar una
              marca.
            </p>
          </div>
          <button
            disabled={busy()}
            onClick={() =>
              void run(
                {
                  action: "dismiss",
                  revision: revision(),
                  dismissed: !state()?.dismissed,
                },
                state()?.dismissed
                  ? "Guía retomada."
                  : "Guía omitida. Sigue disponible acá.",
              )
            }
          >
            {state()?.dismissed ? "Retomar guía" : "Omitir por ahora"}
          </button>
        </section>
        <Show when={!state()?.dismissed}>
          <OnboardingDisclosure
            title="Conexiones opcionales"
            description="Transcribir con Groq · publicar con Zernio"
          >
            <div class="syka-service">
              <strong>Groq · transcripción</strong>
              <p>
                Convertí audio en texto y subtítulos con tu cuenta propia. La
                configuración segura está en Configuración → Tools → Groq.
              </p>
              <button type="button" onClick={() => openSettings('groq')}>Configurar Groq</button>
            </div>
            <div class="syka-service">
              <strong>Zernio · publicación</strong>
              <span class="syka-state">
                {
                  connectionLabels[
                    (props.publication ?? publicationStatus()).state
                  ]
                }
              </span>
              <p>
                Necesitás una cuenta Zernio, una clave de su API y autorizar las
                cuentas sociales que quieras usar. La autorización depende de
                cada plataforma.
              </p>
              <p>
                La conexión se configura en Configuración → Zernio.
                No pegues claves acá ni en el chat. Una conexión de Codex no
                conecta automáticamente Syka.
              </p>
              <button type="button" onClick={() => openSettings('zernio')}>Configurar Zernio</button>
              <OfficialLink href="https://docs.zernio.com">
                Guía oficial de conexión
              </OfficialLink>
              <p>
                La comprobación debe leer el estado de tu cuenta desde
                Publicación. Guardar una clave no prueba acceso, y exportar no
                publica nada.
              </p>
            </div>
          </OnboardingDisclosure>
        </Show>
        <section class="syka-kit-section">
          <header>
            <div>
              <span class="syka-eyebrow">IDENTIDAD VISUAL</span>
              <h2>Brand Kit</h2>
              <p>Tu marca, disponible cuando la edición la necesita.</p>
            </div>
            <button
              disabled={busy() || dirty()}
              onClick={() => {
                select(newBrandKit());
                setDirty(true);
              }}
            >
              + Nuevo kit
            </button>
          </header>
          <div class="syka-kit-layout">
            <nav aria-label="Kits de marca">
              <Show
                when={state()!.kits.length}
                fallback={
                  <p class="syka-empty">
                    Sin kits todavía.
                    <br />
                    Podés seguir editando así.
                  </p>
                }
              >
                <For each={state()!.kits}>
                  {(kit) => (
                    <button
                      class="syka-kit-choice"
                      aria-pressed={draft()?.id === kit.id}
                      disabled={busy() || dirty()}
                      onClick={() => select(kit)}
                    >
                      <span
                        class="syka-swatch"
                        style={{ background: kit.colors[0] ?? "#3488ff" }}
                      />
                      <span>
                        {kit.name}
                        <small>
                          {state()?.defaultKitId === kit.id
                            ? "Predeterminado"
                            : `${kit.assets.length} recursos`}
                        </small>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
            </nav>
            <Show
              when={draft()}
              fallback={
                <div class="syka-kit-placeholder">
                  <span class="syka-brand-mark">
                    Aa<span>●</span>
                  </span>
                  <h3>Una identidad que podés reutilizar</h3>
                  <p>
                    Logos propios, colores, tipografías y referencias.
                    <br />
                    Elegí un kit o creá el primero.
                  </p>
                </div>
              }
            >
              <div class="syka-kit-editor">
                <fieldset disabled={busy()}>
                  <label>
                    Nombre del kit
                    <input
                      value={draft()!.name}
                      maxlength={100}
                      placeholder="Ej. Estudio Norte"
                      onInput={(e) => edit("name", e.currentTarget.value)}
                    />
                  </label>
                  <div class="syka-field-pair">
                    <label>
                      Paleta · HEX separados por comas
                      <input
                        value={colors()}
                        placeholder="#3488FF, #111318"
                        onInput={(e) => {
                          setColors(e.currentTarget.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                    <label>
                      Tipografías · nombres separados por comas
                      <input
                        value={fonts()}
                        placeholder="Inter, Georgia"
                        onInput={(e) => {
                          setFonts(e.currentTarget.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                  </div>
                  <div
                    class="syka-palette"
                    aria-label="Previsualización de colores"
                  >
                    <For
                      each={colors()
                        .split(",")
                        .map((c) => c.trim())
                        .filter((c) => /^#[\da-f]{6}$/i.test(c))}
                    >
                      {(color) => (
                        <span style={{ background: color }} title={color} />
                      )}
                    </For>
                  </div>
                  <p
                    class="syka-font-preview"
                    style={{
                      "font-family": fonts().split(",")[0] || "inherit",
                    }}
                  >
                    Una historia con tu voz.
                  </p>
                  <small>
                    Vista previa con fuentes disponibles en este equipo; no se
                    descargan tipografías.
                  </small>
                  <OnboardingDisclosure
                    title="Referencias, tono y notas"
                    description="Opcional · para orientar futuras decisiones"
                  >
                    <label>
                      Referencias · un enlace HTTPS por línea
                      <textarea
                        value={refs()}
                        placeholder="https://…"
                        onInput={(e) => {
                          setRefs(e.currentTarget.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                    <p>
                      Se guardan como referencia. Ver un video o pedir su
                      transcript requiere una solicitud posterior; guardar no
                      analiza ni sube materiales.
                    </p>
                    <label>
                      Tono
                      <input
                        value={draft()!.tone}
                        onInput={(e) => edit("tone", e.currentTarget.value)}
                        placeholder="Ej. cercano, claro y sin exageraciones"
                      />
                    </label>
                    <label>
                      Notas
                      <textarea
                        value={draft()!.notes}
                        onInput={(e) => edit("notes", e.currentTarget.value)}
                        placeholder="Qué mantener y qué evitar"
                      />
                    </label>
                  </OnboardingDisclosure>
                  <label class="syka-checkbox">
                    <input
                      type="checkbox"
                      checked={makeDefault()}
                      onChange={(e) => {
                        setDefault(e.currentTarget.checked);
                        setDirty(true);
                      }}
                    />
                    Usar como kit predeterminado
                  </label>
                  <div class="syka-actions">
                    <button
                      class="syka-primary"
                      disabled={!dirty()}
                      onClick={save}
                    >
                      {busy() ? "Guardando…" : "Guardar kit"}
                    </button>
                    <Show when={dirty()}>
                      <button
                        onClick={() => {
                          const saved = state()?.kits.find(
                            (k) => k.id === draft()?.id,
                          );
                          if (saved) select(saved);
                          else {
                            setDraft(undefined);
                            setDirty(false);
                          }
                        }}
                      >
                        Descartar cambios
                      </button>
                    </Show>
                  </div>
                  <div class="syka-assets-heading">
                    <div>
                      <h3>Logos y variantes propias</h3>
                      <small>
                        PNG, JPEG, WebP o SVG estático · hasta 5 MB cada uno
                      </small>
                    </div>
                    <button
                      disabled={
                        dirty() ||
                        !state()?.kits.some((k) => k.id === draft()?.id)
                      }
                      onClick={() =>
                        void run(
                          {
                            action: "import",
                            revision: revision(),
                            id: draft()!.id,
                          },
                          "Recurso copiado al kit.",
                        )
                      }
                    >
                      Agregar recurso
                    </button>
                  </div>
                  <Show when={dirty()}>
                    <small>
                      Guardá los cambios antes de agregar recursos o elegir un
                      proyecto.
                    </small>
                  </Show>
                  <div class="syka-assets">
                    <For each={draft()!.assets}>
                      {(asset) => (
                        <figure>
                          <Show
                            when={!asset.missing}
                            fallback={
                              <div class="syka-error">
                                Recurso faltante o alterado
                              </div>
                            }
                          >
                            <img src={asset.preview} alt={asset.name} />
                          </Show>
                          <figcaption>
                            {asset.name}
                            <small>
                              {Math.ceil(asset.bytes / 1024)} KB · copia del kit
                            </small>
                          </figcaption>
                          <button
                            disabled={dirty()}
                            aria-label={`Quitar ${asset.name}`}
                            onClick={() =>
                              void run(
                                {
                                  action: "remove-asset",
                                  revision: revision(),
                                  id: draft()!.id,
                                  assetId: asset.id,
                                },
                                "Recurso quitado del kit.",
                              )
                            }
                          >
                            Quitar
                          </button>
                        </figure>
                      )}
                    </For>
                  </div>
                  <p>
                    Los logos oficiales de otras marcas siguen en Biblioteca.
                    Estos recursos son tu identidad propia.
                  </p>
                  <div class="syka-actions">
                    <button
                      disabled={
                        dirty() ||
                        !state()?.kits.some((k) => k.id === draft()?.id)
                      }
                      onClick={() =>
                        void run(
                          {
                            action: "project",
                            revision: revision(),
                            id: draft()!.id,
                          },
                          "Kit asignado.",
                        )
                      }
                    >
                      Usar en un proyecto…
                    </button>
                    <button
                      disabled={dirty()}
                      onClick={() => setDeleting(!deleting())}
                    >
                      Eliminar kit…
                    </button>
                  </div>
                  <Show when={deleting()}>
                    <div class="syka-delete">
                      <p>
                        Se elimina de esta lista. Las copias ya guardadas en
                        proyectos se conservan.
                      </p>
                      <button
                        onClick={() =>
                          void run(
                            {
                              action: "delete",
                              revision: revision(),
                              id: draft()!.id,
                            },
                            "Kit eliminado.",
                          )
                        }
                      >
                        Confirmar eliminación
                      </button>
                      <button onClick={() => setDeleting(false)}>
                        Cancelar
                      </button>
                    </div>
                  </Show>
                </fieldset>
              </div>
            </Show>
          </div>
          <p class="syka-kit-footnote">
            Cada proyecto recibe una copia portable del kit elegido. Cambiar el
            original no modifica ediciones anteriores.
          </p>
          <button
            disabled={busy() || dirty()}
            onClick={() =>
              void run(
                { action: "project", revision: revision(), id: null },
                "Proyecto sin marca.",
              )
            }
          >
            Dejar un proyecto sin marca…
          </button>
        </section>
        <OnboardingDisclosure
          title="Preferencias de edición"
          description="Respuestas aprobadas · siempre corregibles"
        >
          <p>
            Guardá sólo lo que quieras reutilizar. «Omitir» y «No sé» evitan
            repetir la pregunta; podés corregirlo acá. Las decisiones del
            proyecto tienen prioridad.
          </p>
          <p>
            Este contexto queda preparado para el agente. Su lectura automática
            todavía requiere integrar el contrato en el chat.
          </p>
          <For each={questions}>
            {(question) => {
              const [value, setValue] = createSignal(
                state()?.answers[question.key]?.value ?? "",
              );
              return (
                <div class="syka-preference">
                  <label>
                    {question.label}
                    <input
                      value={value()}
                      placeholder={question.placeholder}
                      onInput={(e) => setValue(e.currentTarget.value)}
                    />
                  </label>
                  <small>
                    Estado:{" "}
                    {
                      (
                        {
                          accepted: "aprobado",
                          proposed: "propuesto, sin aprobar",
                          skipped: "omitido",
                          unknown: "no sé",
                          unanswered: "sin responder",
                        } as const
                      )[state()?.answers[question.key]?.state ?? "unanswered"]
                    }
                  </small>
                  <div class="syka-actions">
                    <button
                      disabled={busy() || !value().trim()}
                      onClick={() =>
                        answer(question.key, "accepted", value().trim())
                      }
                    >
                      Guardar respuesta
                    </button>
                    <button
                      disabled={busy()}
                      onClick={() => answer(question.key, "skipped")}
                    >
                      Omitir
                    </button>
                    <button
                      disabled={busy()}
                      onClick={() => answer(question.key, "unknown")}
                    >
                      No sé
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </OnboardingDisclosure>
        <Show when={message()}>
          <p role="status" class="syka-feedback">
            {message()}
          </p>
        </Show>
        <Show when={error()}>
          <div role="alert" class="syka-error">
            {error()}{" "}
            <button
              onClick={() => {
                void refetch();
                setError("");
              }}
            >
              Recargar
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}
