/**
 * Auth hook — manages login state across the app.
 * Stores JWT in localStorage, provides user info via TanStack Query.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { auth, clearToken, getToken, setToken, type UserResponse } from "@/lib/api";

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user, isLoading, error } = useQuery<UserResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => auth.me(),
    enabled: !!getToken(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await auth.login(email, password);
      setToken(res.access_token);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate({ to: "/app" });
    },
    [queryClient, navigate]
  );

  const signup = useCallback(
    async (email: string, password: string, full_name: string) => {
      const res = await auth.signup(email, password, full_name);
      setToken(res.access_token);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      navigate({ to: "/app" });
    },
    [queryClient, navigate]
  );

  const logout = useCallback(() => {
    clearToken();
    queryClient.clear();
    if (typeof window !== "undefined") window.location.href = "/login";
  }, [queryClient]);

  return {
    user: user ?? null,
    isLoggedIn: !!user,
    isLoading,
    error,
    login,
    signup,
    logout,
  };
}
