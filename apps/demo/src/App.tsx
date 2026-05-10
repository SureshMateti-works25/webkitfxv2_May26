import { useEffect, useState } from "react";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { sampleForm } from "./sampleForm.js";

export function App() {
  const [lastSubmit, setLastSubmit] = useState<Record<string, unknown> | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("demo--dark", dark);
    return () => document.body.classList.remove("demo--dark");
  }, [dark]);

  return (
    <div className="demo-shell">
      <div className="demo-panel">
        <header className="demo-header">
          <div>
            <h1 className="demo-title">webkitfxv2 demo</h1>
            <p className="demo-lede">
              Live <code>JsonForm</code> with themed default controls and validation over a sample{" "}
              <code>FormDefinition</code>.
            </p>
          </div>
          <button
            type="button"
            className="demo-theme-btn"
            onClick={() => setDark((d) => !d)}
            aria-pressed={dark}
          >
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </header>

        <JsonForm
          form={sampleForm}
          className={dark ? "webkitfx-theme--dark" : undefined}
          onSubmit={(values) => setLastSubmit({ ...values })}
        >
          <div className="webkitfx-form-actions">
            <button type="submit">Submit</button>
          </div>
        </JsonForm>

        {lastSubmit ? (
          <section className="demo-output">
            <h2>Last submit</h2>
            <pre>{JSON.stringify(lastSubmit, null, 2)}</pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
