import { ProviderInstanceId, ProviderThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { summarizeThreadUsage } from "./threadUsageSummary.ts";

const thread = (id: string) => ProviderThreadId.make(id);
const instance = (id: string) => ProviderInstanceId.make(id);
const usage = (inputTokens: number, outputTokens: number, cachedInputTokens = 0) => ({
  inputTokens,
  outputTokens,
  cachedInputTokens,
});

describe("summarizeThreadUsage", () => {
  it("returns empty sums when no turn reported usage", () => {
    expect(
      summarizeThreadUsage({
        turns: [{ providerThreadId: thread("t1"), model: "m", tokenUsage: undefined }],
        instanceByThread: new Map(),
        labelFor: () => "x",
      }),
    ).toStrictEqual({ totals: null, byModel: [], byAccount: [] });
  });

  it("splits by model and by account, largest first", () => {
    const summary = summarizeThreadUsage({
      turns: [
        { providerThreadId: thread("work"), model: "opus", tokenUsage: usage(100, 10, 40) },
        { providerThreadId: thread("work"), model: "opus", tokenUsage: usage(200, 20) },
        { providerThreadId: thread("home"), model: "haiku", tokenUsage: usage(50, 5) },
        { providerThreadId: thread("orphan"), tokenUsage: usage(1, 1) },
      ],
      instanceByThread: new Map([
        [thread("work"), instance("claude-work")],
        [thread("home"), instance("claude-home")],
      ]),
      labelFor: (id) => (id === null ? "Unknown account" : `label:${id}`),
    });
    expect(summary.totals).toStrictEqual({
      turnCount: 4,
      inputTokens: 351,
      cachedInputTokens: 40,
      outputTokens: 36,
    });
    expect(summary.byModel).toStrictEqual([
      { model: "opus", turnCount: 2, inputTokens: 300, cachedInputTokens: 40, outputTokens: 30 },
      { model: "haiku", turnCount: 1, inputTokens: 50, cachedInputTokens: 0, outputTokens: 5 },
      { model: null, turnCount: 1, inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    ]);
    expect(summary.byAccount).toStrictEqual([
      {
        providerInstanceId: instance("claude-work"),
        label: "label:claude-work",
        turnCount: 2,
        inputTokens: 300,
        cachedInputTokens: 40,
        outputTokens: 30,
      },
      {
        providerInstanceId: instance("claude-home"),
        label: "label:claude-home",
        turnCount: 1,
        inputTokens: 50,
        cachedInputTokens: 0,
        outputTokens: 5,
      },
      {
        providerInstanceId: null,
        label: "Unknown account",
        turnCount: 1,
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 1,
      },
    ]);
  });
});
