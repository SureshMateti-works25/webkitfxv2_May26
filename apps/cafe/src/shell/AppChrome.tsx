import { useEffect } from "react";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { ChromeNoticeBar } from "./ChromeNoticeBar.js";
import { EdgeChrome } from "./EdgeChrome.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { RequirePasswordSetup } from "./RequirePasswordSetup.js";
import { ShellBodyWithPromo } from "./ShellBodyWithPromo.js";

export function AppChrome() {
  useEffect(() => {
    document.documentElement.classList.add("cafe-site");
    return () => document.documentElement.classList.remove("cafe-site");
  }, []);

  return (
    <div className="shell-root shell-root--cafe">
      <RequirePasswordSetup>
        <Header />
        <ChromeNoticeBar />
        <Breadcrumbs />
        <ShellBodyWithPromo />
        <Footer />
        <EdgeChrome />
      </RequirePasswordSetup>
    </div>
  );
}
