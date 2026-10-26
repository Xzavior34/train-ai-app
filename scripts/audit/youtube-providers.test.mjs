import test from "node:test";
import assert from "node:assert/strict";
import {
  durationSeconds,
  verifiedVideos,
  rankedSuggestions,
} from "../../supabase/functions/youtube-course-discovery/core.ts";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
const video = (patch = {}) => ({
  id: "ABCDEFGHIJK",
  snippet: {
    title: "Product management",
    channelTitle: "Original creator",
    description: "Roadmaps and discovery",
    publishedAt: "2026-01-01T00:00:00Z",
    liveBroadcastContent: "none",
  },
  status: {
    privacyStatus: "public",
    embeddable: true,
    uploadStatus: "processed",
  },
  contentDetails: { duration: "PT2H10M30S" },
  ...patch,
});
test("YouTube durations use real metadata", () => {
  assert.equal(durationSeconds("PT2H10M30S"), 7830);
  assert.equal(durationSeconds("P1DT2H"), 93600);
  assert.equal(durationSeconds("invalid"), 0);
});
test("removed, private, unembeddable, live, age and region restricted videos are excluded", () => {
  const videos = [
    video(),
    video({
      status: {
        privacyStatus: "private",
        embeddable: true,
        uploadStatus: "processed",
      },
    }),
    video({
      status: {
        privacyStatus: "public",
        embeddable: false,
        uploadStatus: "processed",
      },
    }),
    video({ snippet: { liveBroadcastContent: "live" } }),
    video({
      contentDetails: {
        duration: "PT2H",
        contentRating: { ytRating: "ytAgeRestricted" },
      },
    }),
    video({
      contentDetails: {
        duration: "PT2H",
        regionRestriction: { blocked: ["NG"] },
      },
    }),
    video({
      contentDetails: {
        duration: "PT2H",
        regionRestriction: { allowed: ["US"] },
      },
    }),
    video({ contentDetails: { duration: "PT0S" } }),
    video({ id: "bad-id" }),
  ];
  assert.equal(verifiedVideos(videos).length, 1);
});
test("AI cannot invent video links or change trusted YouTube metadata", () => {
  const videos = verifiedVideos([video()]);
  const ranked = rankedSuggestions(
    videos,
    {
      suggestions: [
        { video_id: "unknown1234", reason: "invented" },
        {
          video_id: "ABCDEFGHIJK",
          title: "Fabricated title",
          duration_seconds: 1,
          reason: "Roadmap foundation",
          category: "Product Management",
        },
        { video_id: "ABCDEFGHIJK", reason: "duplicate" },
      ],
    },
    "beginner",
  );
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].title, "Product management");
  assert.equal(ranked[0].duration_seconds, 7830);
  assert.equal(ranked[0].level, "beginner");
});
test("malformed AI recommendations are ignored", () => {
  assert.deepEqual(
    rankedSuggestions(
      verifiedVideos([video()]),
      { suggestions: [{ video_id: "ABCDEFGHIJK" }] },
      "beginner",
    ),
    [],
  );
});
async function handlerFixture(options = {}) {
  let handler;
  const calls = [],
    writes = [];
  let aiCalls = 0;
  const chain = {
    update: (value) => {
      writes.push(value);
      return chain;
    },
    insert: async (value) => {
      writes.push(value);
      return { error: options.saveFailure ? { message: "failed" } : null };
    },
    eq: () => chain,
    then: (resolve) => resolve({ error: null }),
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: options.signedOut ? null : { user: { id: "admin" } },
        error: options.signedOut ? {} : null,
      }),
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data:
          name === "can_administer_organization"
            ? !options.denied
            : name === "begin_youtube_course_search"
              ? "search-id"
              : name === "consume_youtube_discovery_credits"
                ? {
                    authorized: !options.noCredits,
                    transaction_id: "transaction",
                  }
                : null,
        error: null,
      };
    },
    from: () => chain,
  };
  const source = stripTypeScriptTypes(
    fs
      .readFileSync(
        "supabase/functions/youtube-course-discovery/index.ts",
        "utf8",
      )
      .replace(/^import .*;\r?\n/gm, ""),
  );
  vm.runInNewContext(source, {
    createClient: () => client,
    verifiedVideos,
    rankedSuggestions,
    Request,
    Response,
    URLSearchParams,
    AbortSignal,
    Error,
    SyntaxError,
    Date,
    console,
    Deno: {
      env: {
        get: (name) =>
          name === "YOUTUBE_API_KEY" && options.missingKey
            ? undefined
            : "fixture-key",
      },
      serve: (fn) => {
        handler = fn;
      },
    },
    fetch: async (url, init) => {
      calls.push({ url });
      if (url.includes("openai.com")) {
        aiCalls++;
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify(
                  aiCalls === 1
                    ? { query: "product management full course" }
                    : {
                        suggestions: [
                          {
                            video_id: "ABCDEFGHIJK",
                            reason: "Matches product management foundations",
                            category: "Product",
                          },
                        ],
                      },
                ),
              },
            },
          ],
        });
      }
      if (url.includes("/search?")) {
        if (options.providerFailure) return Response.json({}, { status: 403 });
        return Response.json({
          items: options.empty ? [] : [{ id: { videoId: "ABCDEFGHIJK" } }],
        });
      }
      return Response.json({ items: [video()] });
    },
  });
  const response = await handler(
    new Request("https://example.invalid", {
      method: "POST",
      headers: { Authorization: "Bearer fixture" },
      body: JSON.stringify({
        action: options.action || "search",
        organizationId: "10000000-0000-4000-8000-000000000001",
        prompt: "Product management for beginners",
        level: "beginner",
      }),
    }),
  );
  return { response, body: await response.json(), calls, writes };
}
test("signed-out, foreign admins, and missing keys never invoke providers or spend credits", async () => {
  for (const options of [
    { signedOut: true },
    { denied: true },
    { missingKey: true },
  ]) {
    const r = await handlerFixture(options);
    assert.ok(r.response.status >= 400);
    assert.equal(
      r.calls.some((c) => c.url || c.name === "consume_youtube_discovery_credits"),
      false,
    );
  }
});
test("exhausted credits never call AI or YouTube", async () => {
  const r = await handlerFixture({ noCredits: true });
  assert.equal(r.response.status, 402);
  assert.equal(
    r.calls.some((c) => c.url),
    false,
  );
});
test("provider and save failures refund credits and report failure", async () => {
  for (const options of [{ providerFailure: true }, { saveFailure: true }]) {
    const r = await handlerFixture(options);
    assert.equal(r.response.status, 502);
    assert.ok(r.calls.some((c) => c.name === "refund_ai_credits"));
    assert.ok(r.body.error);
  }
});
test("search persists verified metadata with organization scope", async () => {
  const r = await handlerFixture();
  assert.equal(r.response.status, 200);
  assert.equal(r.body.count, 1);
  const saved = r.writes.find(Array.isArray);
  assert.equal(saved[0].video_id, "ABCDEFGHIJK");
  assert.equal(
    saved[0].organization_id,
    "10000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    r.calls.filter((c) => c.name === "consume_youtube_discovery_credits").length,
    1,
  );
  assert.equal(
    r.calls.some((c) => c.name === "refund_ai_credits"),
    false,
  );
});
test("empty searches refund credits and return an honest empty result", async () => {
  const r = await handlerFixture({ empty: true });
  assert.equal(r.body.count, 0);
  assert.ok(r.calls.some((c) => c.name === "refund_ai_credits"));
});
