import { Breadcrumbs } from "./Breadcrumbs.js";
import { ChromeNoticeBar } from "./ChromeNoticeBar.js";
import { EdgeChrome } from "./EdgeChrome.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { ShellBodyWithPromo } from "./ShellBodyWithPromo.js";

export function AppChrome() {
  return (
    <div className="shell-root">
      <Header />
      <ChromeNoticeBar />
      <Breadcrumbs />
      <ShellBodyWithPromo />
      <Footer />
      <EdgeChrome />
    </div>
  );
}
