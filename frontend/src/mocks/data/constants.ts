import type { AuthUser } from "@/lib/api/auth";

export const MOCK_TODAY = "2026-05-29";
export const MOCK_TOKEN = "mock-access-token";

export const MOCK_USER: AuthUser = {
  id: 1,
  email: "demo@daynest.app",
  full_name: "Demo User",
  is_active: true,
  roles: ["user"],
};
