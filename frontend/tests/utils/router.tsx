import { render } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "@/app/router/AppRouter";

type RouterAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

export function renderWithRouter({
  path = "/today",
  auth = { isAuthenticated: true, isLoading: false },
}: {
  path?: string;
  auth?: RouterAuthState;
}) {
  window.history.pushState({}, "", path);
  const router = createAppRouter();
  const renderResult = render(
    <RouterProvider
      router={router}
      context={{
        auth,
      }}
    />,
  );

  return { router, ...renderResult };
}
