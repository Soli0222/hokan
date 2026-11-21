import { describe, expect, it } from "vitest";
import { createTestApp, createTestClient, parseJson } from "../test-helpers/app";

function accountPayload(name: string) {
  return {
    name,
    category: "pc_peripheral",
    acquiredOn: "2026-01-10",
    purchasePrice: 12345,
  };
}

describe("API CORS and Origin guard", () => {
  it("allows POST requests without an Origin header", async () => {
    const client = createTestClient();

    const response = await client.post("/api/items", accountPayload("No Origin"));

    expect(response.status).toBe(201);
  });

  it("allows POST requests when Origin host matches the request Host", async () => {
    const client = createTestClient();

    const response = await client.post("/api/items", accountPayload("Same Host"), {
      headers: {
        Host: "hokan.example.com",
        Origin: "https://hokan.example.com",
      },
    });

    expect(response.status).toBe(201);
  });

  it("rejects POST requests from untrusted origins", async () => {
    const client = createTestClient();

    const response = await client.post("/api/items", accountPayload("Untrusted"), {
      headers: {
        Host: "hokan.example.com",
        Origin: "https://evil.example.com",
      },
    });

    expect(response.status).toBe(403);
    expect(await parseJson(response)).toEqual({ error: "Origin not allowed" });
  });

  it("allows configured origins and emits Access-Control-Allow-Origin", async () => {
    const client = createTestClient(
      createTestApp({ allowedOrigins: ["https://app.example.com"] }),
    );

    const response = await client.post("/api/items", accountPayload("Configured Origin"), {
      headers: {
        Host: "api.example.com",
        Origin: "https://app.example.com",
      },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("allows GET requests from untrusted origins without Access-Control-Allow-Origin", async () => {
    const client = createTestClient(
      createTestApp({ allowedOrigins: ["https://app.example.com"] }),
    );

    const response = await client.get("/api/items", {
      headers: {
        Host: "api.example.com",
        Origin: "https://evil.example.com",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
