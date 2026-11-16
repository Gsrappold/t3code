import { ProviderThreadId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { deriveThreadUsageAccounts, deriveThreadUsageRows } from "./threadUsage";

const updatedAt = "2026-11-16T00:00:00.000Z";
const noAccounts = { byAccount: [] };

describe("deriveThreadUsageRows", () => {
  it("returns no rows when there is no usage", () => {
    expect(deriveThreadUsageRows(null)).toEqual([]);
    expect(deriveThreadUsageRows(undefined)).toEqual([]);
    expect(
      deriveThreadUsageRows({
        threadId: ThreadId.make("thread-1"),
        providerThread: null,
        latestTurnTokenUsage: null,
        totals: null,
        ...noAccounts,
      }),
    ).toEqual([]);
  });

  it("shows context used, max and percentage", () => {
    const rows = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: {
        id: ProviderThreadId.make("provider-thread-1"),
        contextUsage: { usedTokens: 50_000, maxTokens: 200_000 },
        updatedAt: DateTime.makeUnsafe(updatedAt),
      },
      latestTurnTokenUsage: null,
      totals: null,
      ...noAccounts,
    });
    expect(rows).toEqual([{ label: "Context", value: "50k / 200k (25%)" }]);
  });

  it("shows used tokens without a percentage when max is unknown", () => {
    const rows = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: {
        id: ProviderThreadId.make("provider-thread-1"),
        contextUsage: { usedTokens: 1_500 },
        updatedAt: DateTime.makeUnsafe(updatedAt),
      },
      latestTurnTokenUsage: null,
      totals: null,
      ...noAccounts,
    });
    expect(rows).toEqual([{ label: "Context", value: "1.5k tokens" }]);
  });

  it("adds the latest turn breakdown and omits absent fields", () => {
    const rows = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: null,
      latestTurnTokenUsage: {
        usedTokens: 12_000,
        inputTokens: 10_000,
        outputTokens: 2_000,
        updatedAt,
      },
      totals: null,
      ...noAccounts,
    });
    expect(rows).toEqual([
      { label: "Context", value: "12k tokens" },
      { label: "Last turn", value: "12k tokens" },
      { label: "Input", value: "10k" },
      { label: "Output", value: "2k" },
    ]);
  });

  it("prefers the latest turn usage over a stale provider snapshot, like the chat meter", () => {
    const rows = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: {
        id: ProviderThreadId.make("provider-thread-1"),
        contextUsage: { usedTokens: 20_000, maxTokens: 200_000 },
        updatedAt: DateTime.makeUnsafe(updatedAt),
      },
      latestTurnTokenUsage: { usedTokens: 150_000, maxTokens: 200_000, updatedAt },
      totals: null,
      ...noAccounts,
    });
    expect(rows[0]).toEqual({ label: "Context", value: "150k / 200k (75%)" });
  });

  it("caps the percentage at 100 and skips it when max is zero", () => {
    const over = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: null,
      latestTurnTokenUsage: { usedTokens: 220_000, maxTokens: 200_000, updatedAt },
      totals: null,
      ...noAccounts,
    });
    expect(over[0]).toEqual({ label: "Context", value: "220k / 200k (100%)" });

    const zero = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: null,
      latestTurnTokenUsage: { usedTokens: 1_000, maxTokens: 0, updatedAt },
      totals: null,
      ...noAccounts,
    });
    expect(zero[0]).toEqual({ label: "Context", value: "1k tokens" });
  });

  it("shows totals across all turns", () => {
    const rows = deriveThreadUsageRows({
      threadId: ThreadId.make("thread-1"),
      providerThread: null,
      latestTurnTokenUsage: null,
      totals: { turnCount: 3, inputTokens: 3_000, cachedInputTokens: 0, outputTokens: 600 },
      ...noAccounts,
    });
    expect(rows).toEqual([
      { label: "Input, all turns", value: "3k" },
      { label: "Output, all turns", value: "600" },
      { label: "Turns", value: "3" },
    ]);
  });
});

describe("deriveThreadUsageAccounts", () => {
  it("lists each account with its models, using readable model names", () => {
    const accounts = deriveThreadUsageAccounts({
      threadId: ThreadId.make("thread-1"),
      providerThread: null,
      latestTurnTokenUsage: null,
      totals: { turnCount: 3, inputTokens: 3_000, cachedInputTokens: 0, outputTokens: 600 },
      byAccount: [
        {
          providerInstanceId: null,
          label: "Work",
          turnCount: 3,
          inputTokens: 3_000,
          cachedInputTokens: 0,
          outputTokens: 600,
          models: [
            {
              model: "claude-opus-5-5",
              turnCount: 2,
              inputTokens: 2_000,
              cachedInputTokens: 0,
              outputTokens: 400,
            },
            {
              model: null,
              turnCount: 1,
              inputTokens: 1_000,
              cachedInputTokens: 0,
              outputTokens: 200,
            },
          ],
        },
      ],
    });
    expect(accounts).toEqual([
      {
        name: "Work",
        models: [
          { name: "Claude Opus 5.5", info: "2k in · 400 out · 2 turns" },
          { name: "Not reported", info: "1k in · 200 out · 1 turns" },
        ],
      },
    ]);
  });

  it("returns no accounts when there is no usage", () => {
    expect(deriveThreadUsageAccounts(null)).toEqual([]);
  });
});
