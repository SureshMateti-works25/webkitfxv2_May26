import { useNavigate } from "react-router-dom";
import { JsonForm } from "@webkitfxv2/react-renderer";
import { shopperSignupForm } from "../config/forms/index.js";
import { getShell } from "../config/getShell.js";

export function ShopperSignupPage() {
  const shell = getShell();
  const copy = shell.screens.shopperSignup;
  const navigate = useNavigate();

  return (
    <div>
      <header className="screen-prose">
        <h1>{copy.title}</h1>
        <p>{copy.lede}</p>
      </header>
      <JsonForm
        form={shopperSignupForm}
        onSubmit={(values) => {
          void values;
          navigate("/", { state: { notice: "shopper-saved" } });
        }}
      >
        <div className="webkitfx-form-actions">
          <button type="submit">{copy.submitLabel}</button>
        </div>
      </JsonForm>
    </div>
  );
}
