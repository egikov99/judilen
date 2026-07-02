import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><SiteHeader /><main>{children}</main><SiteFooter /></div>;
}
