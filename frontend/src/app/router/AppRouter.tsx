import {
  Navigate,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useAuth } from "@/app/providers/AuthProvider";
import { z } from "zod";
import * as m from "@/paraglide/messages";
import { AppLayout } from "@/app/layout/AppLayout";
import { AuthPage } from "@/features/auth/AuthPage";
import { TodayPage } from "@/features/today/TodayPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { MedicationPage } from "@/features/medication/MedicationPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TemplatesPage } from "@/features/templates/TemplatesPage";
import { StatsPage } from "@/features/stats/StatsPage";
import { ShoppingListDetail } from "@/features/shopping/ShoppingListDetail";
import { ShoppingListsPage } from "@/features/shopping/ShoppingListsPage";

type RouterContext = {
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
  };
};

function ProtectedRouteBoundary() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <div className="alert alert-info py-2">{m.router_loading_session()}</div>;
  }
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
        search={{
          from: `${location.pathname}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
        }}
      />
    );
  }
  return <Outlet />;
}

function AuthCallback() {
  return <div className="alert alert-info py-2">{m.router_completing_sign_in()}</div>;
}

const authSearchSchema = z.object({
  from: z.string().startsWith("/").optional(),
});

const calendarSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: AppLayout,
  notFoundComponent: () => <Navigate to="/today" replace />,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  validateSearch: authSearchSchema,
  component: AuthPage,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallback,
});

const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  beforeLoad: ({ context, location }) => {
    if (context.auth.isLoading || context.auth.isAuthenticated) {
      return;
    }

    throw redirect({
      to: "/auth",
      replace: true,
      search: {
        from: `${location.pathname}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
      },
    });
  },
  component: ProtectedRouteBoundary,
});

const todayRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/today",
  component: TodayPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/calendar",
  validateSearch: calendarSearchSchema,
  component: CalendarPage,
});

const medicationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/medication",
  component: MedicationPage,
});

const shoppingRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/shopping",
  component: ShoppingListsPage,
});

const shoppingListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/shopping/$listId",
  component: ShoppingListDetail,
});

const templatesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/templates",
  component: TemplatesPage,
});

const statsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/stats",
  component: StatsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/settings",
  component: SettingsPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/today" replace />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  authCallbackRoute,
  protectedRoute.addChildren([
    todayRoute,
    calendarRoute,
    medicationRoute,
    shoppingRoute,
    shoppingListRoute,
    templatesRoute,
    statsRoute,
    settingsRoute,
  ]),
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    context: {
      auth: {
        isAuthenticated: false,
        isLoading: true,
      },
    },
  });
}

export const appRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
