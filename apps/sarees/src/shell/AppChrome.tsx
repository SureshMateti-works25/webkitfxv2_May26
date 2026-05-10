import { Outlet } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";

export function AppChrome() {
  return (
    <div className="shell-root">
      <Header />
      <Breadcrumbs />
      <main className="shell-body">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
