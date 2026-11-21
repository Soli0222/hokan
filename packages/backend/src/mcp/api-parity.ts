/**
 * Every concrete /api route must have a public MCP operation or an explicit
 * browser-session boundary. Keep this map keyed by Hono's registered method and
 * path so adding a route cannot silently bypass the parity review.
 */
export const apiParity = {
  "GET /api/items": ["list_items"],
  "POST /api/items": ["create_item"],
  "GET /api/items/:id": ["get_item"],
  "PUT /api/items/:id": ["update_item"],
  "DELETE /api/items/:id": ["delete_item"],
  "POST /api/items/:id/confirm": ["confirm_item"],
  "PUT /api/items/:id/disposal": ["record_disposal", "update_disposal"],
  "DELETE /api/items/:id/disposal": ["delete_disposal"],
  "GET /api/items/:id/valuations": ["list_valuations"],
  "POST /api/items/:id/valuations": ["add_valuation"],
  "GET /api/disposals": ["list_disposals"],
  "GET /api/dashboard": ["get_dashboard"],
  "GET /api/dashboard/sell-candidates": ["get_sell_candidates"],
  "GET /api/dashboard/category-context": ["get_category_context"],
  "GET /api/dashboard/inventory-pending": ["list_inventory_pending"],
  "GET /api/auth/status": { browserSession: "Login state belongs to the browser session" },
  "GET /api/auth/login": { browserSession: "OIDC state, PKCE and callback cookies are browser-bound" },
  "GET /api/auth/callback": { browserSession: "OIDC callback consumes browser-bound flow cookies" },
  "POST /api/auth/logout": { browserSession: "Revokes the current browser cookie session" },
  "GET /api/auth/tokens": { browserSession: "Requires an OIDC browser session" },
  "POST /api/auth/tokens": { browserSession: "Requires an OIDC browser session to mint a credential" },
  "DELETE /api/auth/tokens/:id": { browserSession: "Requires an OIDC browser session to revoke a credential" },
  "GET /api/auth/sessions": { browserSession: "Lists the current OIDC subject's browser sessions" },
  "DELETE /api/auth/sessions": { browserSession: "Revokes the current OIDC subject's browser sessions" },
  "DELETE /api/auth/sessions/:id": { browserSession: "Revokes the current OIDC subject's browser session" },
  "GET /api/export": ["export_data"],
  "POST /api/import": ["import_data"],
} as const satisfies Record<string, readonly string[] | { readonly browserSession: string }>;
