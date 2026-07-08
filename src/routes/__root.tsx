import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PageTransitionLoader } from "../components/PageTransitionLoader";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dynamic Bank of west" },
      { name: "description", content: "Account Hub Pro is a secure web application for managing financial accounts and transactions." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Dynamic Bank of west" },
      { property: "og:description", content: "Account Hub Pro is a secure web application for managing financial accounts and transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Dynamic Bank of west" },
      { name: "twitter:description", content: "Account Hub Pro is a secure web application for managing financial accounts and transactions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3cba833a-95c5-4cc4-92ca-378aae189386/id-preview-2ba7ca00--7ad5b391-f331-4afe-8507-03a8c36e1a5d.lovable.app-1782645561024.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3cba833a-95c5-4cc4-92ca-378aae189386/id-preview-2ba7ca00--7ad5b391-f331-4afe-8507-03a8c36e1a5d.lovable.app-1782645561024.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Hidden Operations Console toggle: Ctrl/Cmd + Shift + A (desktop)
  // Mobile equivalent: 5 rapid taps on the invisible corner target below.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        unlockAdmin(router);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalBanner />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PageTransitionLoader />
      <AdminUnlockCorner onUnlock={() => unlockAdmin(router)} />
    </QueryClientProvider>
  );
}

function GlobalBanner() {
  const banner = useSystemSetting("banner");
  if (!banner || !banner.enabled || !banner.message.trim()) return null;
  const tone = banner.tone;
  const cls =
    tone === "danger" ? "bg-red-600 text-white" :
    tone === "warning" ? "bg-amber-500 text-black" :
    tone === "success" ? "bg-emerald-600 text-white" :
    "bg-sky-600 text-white";
  return (
    <div className={`w-full ${cls} text-center text-xs sm:text-sm font-medium px-4 py-2 shadow-sm`}>
      {banner.message}
    </div>
  );
}

function unlockAdmin(router: ReturnType<typeof useRouter>) {
  try { sessionStorage.setItem("mt_admin_unlocked", "1"); } catch { /* */ }
  router.navigate({ to: "/admin" });
}

// Invisible 44×44 hit target pinned to the bottom-right corner.
// Five taps within 1.5s unlocks the Operations Console. No visible UI,
// no cursor change, no aria label — completely opaque to public users.
function AdminUnlockCorner({ onUnlock }: { onUnlock: () => void }) {
  const tapsRef = (globalThis as unknown as { __dbwTapState?: { count: number; first: number } });
  function handleTap() {
    const now = Date.now();
    const state = tapsRef.__dbwTapState;
    if (!state || now - state.first > 1500) {
      tapsRef.__dbwTapState = { count: 1, first: now };
      return;
    }
    state.count += 1;
    if (state.count >= 5) {
      tapsRef.__dbwTapState = undefined;
      onUnlock();
    }
  }
  return (
    <div
      onClick={handleTap}
      onTouchEnd={handleTap}
      style={{
        position: "fixed",
        right: 0,
        bottom: 0,
        width: 44,
        height: 44,
        zIndex: 9999,
        background: "transparent",
        WebkitTapHighlightColor: "transparent",
      }}
    />
  );
}


