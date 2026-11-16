import type { ProviderInstanceId, ProviderThreadId } from "@t3tools/contracts";

export interface UsageBucket {
  readonly turnCount: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
}

export interface ThreadUsageSummary {
  readonly totals: UsageBucket | null;
  /** `model` is null for turns whose provider reported no model. Largest first. */
  readonly byModel: ReadonlyArray<UsageBucket & { readonly model: string | null }>;
  /** `providerInstanceId` is null for turns whose provider thread is unknown. Largest first. */
  readonly byAccount: ReadonlyArray<
    UsageBucket & { readonly providerInstanceId: ProviderInstanceId | null; readonly label: string }
  >;
}

interface TurnUsageInput {
  readonly providerThreadId: ProviderThreadId;
  readonly model?: string | undefined;
  readonly tokenUsage?:
    | {
        readonly inputTokens?: number | undefined;
        readonly cachedInputTokens?: number | undefined;
        readonly outputTokens?: number | undefined;
      }
    | undefined;
}

const emptyBucket = (): {
  turnCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
} => ({
  turnCount: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
});

const addTo = (
  bucket: ReturnType<typeof emptyBucket>,
  usage: NonNullable<TurnUsageInput["tokenUsage"]>,
) => {
  bucket.turnCount += 1;
  bucket.inputTokens += usage.inputTokens ?? 0;
  bucket.cachedInputTokens += usage.cachedInputTokens ?? 0;
  bucket.outputTokens += usage.outputTokens ?? 0;
};

const largestFirst = <T extends { readonly turnCount: number }>(
  items: ReadonlyArray<T>,
): ReadonlyArray<T> => [...items].toSorted((a, b) => b.turnCount - a.turnCount);

/**
 * Sums each turn that reported usage, overall, by model and by account (the provider instance of
 * its provider thread). Turns without usage are skipped entirely.
 */
export function summarizeThreadUsage(input: {
  readonly turns: ReadonlyArray<TurnUsageInput>;
  readonly instanceByThread: ReadonlyMap<ProviderThreadId, ProviderInstanceId>;
  readonly labelFor: (instance: ProviderInstanceId | null) => string;
}): ThreadUsageSummary {
  const totals = emptyBucket();
  const byModel = new Map<string | null, ReturnType<typeof emptyBucket>>();
  const byAccount = new Map<ProviderInstanceId | null, ReturnType<typeof emptyBucket>>();
  for (const turn of input.turns) {
    const usage = turn.tokenUsage;
    if (usage === undefined) continue;
    addTo(totals, usage);
    const model = turn.model ?? null;
    addTo(byModel.get(model) ?? byModel.set(model, emptyBucket()).get(model)!, usage);
    const instance = input.instanceByThread.get(turn.providerThreadId) ?? null;
    addTo(byAccount.get(instance) ?? byAccount.set(instance, emptyBucket()).get(instance)!, usage);
  }
  return {
    totals: totals.turnCount === 0 ? null : totals,
    byModel: largestFirst([...byModel].map(([model, bucket]) => ({ model, ...bucket }))),
    byAccount: largestFirst(
      [...byAccount].map(([providerInstanceId, bucket]) => ({
        providerInstanceId,
        label: input.labelFor(providerInstanceId),
        ...bucket,
      })),
    ),
  };
}
