import {
  Navigate,
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { z } from "zod";
import * as m from "@/paraglide/messages";
import { AppLayout } from "@/app/layout/AppLayout";
import { AuthPage } from "@/features/auth/AuthPage";
import { TodayPage } from "@/features/today/TodayPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import {
  calendarDayQueryOptions,
  calendarPlannedItemsQueryOptions,
  resolveCalendarSelectedDate,
} from "@/features/calendar/useCalendarQueries";
import { MedicationPage } from "@/features/medication/MedicationPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TemplatesPage } from "@/features/templates/TemplatesPage";
import { StatsPage } from "@/features/stats/StatsPage";
import { ShoppingListDetail } from "@/features/shopping/ShoppingListDetail";
import { ShoppingListsPage } from "@/features/shopping/ShoppingListsPage";
import {
  shoppingItemsQueryOptions,
  shoppingListQueryOptions,
} from "@/features/shopping/useShoppingLists";
import { RecurringGroceriesPage } from "@/features/shopping/RecurringGroceriesPage";
import { MealPlannerPage } from "@/features/meal-planning/MealPlannerPage";
import { PrivacyPolicyPage } from "@/features/legal/PrivacyPolicyPage";
import { PebblePairPage } from "@/features/pebble/PebblePairPage";

type RouterContext = {
  auth: {
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  queryClient: QueryClient;
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

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyPolicyPage,
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
  loaderDeps: ({ search }) => ({ date: search.date }),
  context: ({ deps }) => {
    const date = resolveCalendarSelectedDate(deps.date);
    return {
      calendarDayQueryOptions: calendarDayQueryOptions(date),
      calendarPlannedItemsQueryOptions: calendarPlannedItemsQueryOptions(date),
    };
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(context.calendarDayQueryOptions),
      context.queryClient.ensureQueryData(context.calendarPlannedItemsQueryOptions),
    ]);
  },
  // Shown if the loader's prefetch above is still in flight when the router
  // would otherwise navigate (e.g. a slow first visit) — CalendarPage itself
  // still owns its own loading/error UI via plain useQuery, unaffected by
  // this; the two loading states just cover different windows.
  pendingComponent: () => <div className="alert alert-info py-2">{m.calendar_loading()}</div>,
  component: CalendarPage,
});

const medicationRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/medication",
  component: MedicationPage,
});

const mealPlanRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/meal-plan",
  component: MealPlannerPage,
});

const shoppingRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/shopping",
  component: ShoppingListsPage,
});

const shoppingListParamsSchema = z.object({
  listId: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((value) => Number.isSafeInteger(value) && value > 0),
});

const shoppingListRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/shopping/$listId",
  parseParams: (params) => shoppingListParamsSchema.parse(params),
  context: ({ params }) => ({
    shoppingListQueryOptions: shoppingListQueryOptions(params.listId),
    shoppingItemsQueryOptions: shoppingItemsQueryOptions(params.listId),
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(context.shoppingListQueryOptions),
      context.queryClient.ensureQueryData(context.shoppingItemsQueryOptions),
    ]);
  },
  // See the equivalent comment on calendarRoute above — covers the loader's
  // in-flight window, not the component's own (unaffected) loading UI.
  pendingComponent: () => <div className="alert alert-info py-2">{m.shopping_loading()}</div>,
  component: ShoppingListDetail,
});

const recurringGroceriesRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/shopping/recurring",
  component: RecurringGroceriesPage,
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

const pebblePairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pebble-pair",
  component: PebblePairPage,
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
  privacyRoute,
  pebblePairRoute,
  protectedRoute.addChildren([
    todayRoute,
    calendarRoute,
    medicationRoute,
    mealPlanRoute,
    shoppingRoute,
    recurringGroceriesRoute,
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
      // Placeholder only — RouterProvider's `context` prop supplies the real,
      // shared QueryClient instance before any loader actually runs (same
      // bootstrapping pattern as the `auth` defaults above).
      queryClient: new QueryClient(),
    },
  });
}

export const appRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
