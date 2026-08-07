"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import {
  REFRESH_APP_ROUTER_USER_MESSAGE,
  type RefreshAppRouterContext,
  type RefreshAppRouterFailureReason,
  type RefreshAppRouterResult,
} from "@/core/browser/refresh-app-router";
import { logClientError } from "@/core/errors/log-error.client";

function failRefresh(
  reason: RefreshAppRouterFailureReason,
  error: unknown,
  context?: RefreshAppRouterContext
): RefreshAppRouterResult {
  logClientError(context?.scope ?? "router.refresh", error, context?.metadata);
  return {
    ok: false,
    reason,
    message: REFRESH_APP_ROUTER_USER_MESSAGE,
  };
}

export function useAppRouterRefresh() {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  const refreshSafely = useCallback(
    (context?: RefreshAppRouterContext): Promise<RefreshAppRouterResult> => {
      if (typeof router.refresh !== "function") {
        return Promise.resolve(
          failRefresh("refresh_unavailable", new Error("router.refresh is not available"), context)
        );
      }

      return new Promise((resolve) => {
        try {
          startTransition(() => {
            try {
              router.refresh();
              resolve({ ok: true });
            } catch (error) {
              resolve(failRefresh("refresh_threw", error, context));
            }
          });
        } catch (error) {
          resolve(failRefresh("unknown", error, context));
        }
      });
    },
    [router, startTransition]
  );

  return { refreshSafely, isRefreshing };
}
