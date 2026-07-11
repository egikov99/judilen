import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { FloatingContactWidget } from "./floating-contact-widget";
import { TagManagerInjector } from "./tag-manager-injector";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="public-site"><TagManagerInjector /><SiteHeader /><main>{children}</main><SiteFooter /><FloatingContactWidget /></div>;
}
