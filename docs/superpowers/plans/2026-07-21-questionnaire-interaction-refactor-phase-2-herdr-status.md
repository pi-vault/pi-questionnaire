# Questionnaire Herdr Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark Pi as blocked in Herdr while a questionnaire waits for the user, then always clear that state.

**Architecture:** Emit the optional `herdr:blocked` integration event directly through Pi's existing event bus. Bracket only the `runQuestionnaireUI` await in `try`/`finally`; validation and non-TUI returns remain outside it.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-coding-agent`.

---

## File map

- `src/index.ts` — tool entry point and interactive-wait lifetime.
- `tests/index.test.ts` — captures event-bus calls and controls UI completion.

### Task 1: Pair `herdr:blocked` events with the interactive UI

**Files:**

- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`

- [ ] **Step 1: Extend the extension fixture in `tests/index.test.ts`.** Its fake API must expose `events: { emit: vi.fn() }`; make the fake `ui.custom` retain its `done` callback as `finishQuestionnaire` so the test can resolve the pending execute call.

- [ ] **Step 2: Add lifecycle tests.**

```ts
it("marks Herdr blocked only while the questionnaire UI is active", async () => {
  const { tool, events, finishQuestionnaire } = setupExtension();
  const pending = tool.execute("call", validParams, new AbortController().signal, vi.fn(), tuiContext);

  expect(events.emit).toHaveBeenCalledWith("herdr:blocked", {
    active: true,
    label: "Waiting for questionnaire response",
  });

  finishQuestionnaire({ questions: normalizedQuestions, responses: [], cancelled: true });
  await pending;

  expect(events.emit).toHaveBeenLastCalledWith("herdr:blocked", { active: false });
  expect(events.emit).toHaveBeenCalledTimes(2);
});

it("does not emit Herdr events for validation and non-TUI failures", async () => {
  const { tool, events } = setupExtension();
  await tool.execute("call", invalidParams, new AbortController().signal, vi.fn(), tuiContext);
  await tool.execute("call", validParams, new AbortController().signal, vi.fn(), nonTuiContext);
  expect(events.emit).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the test and confirm it fails.**

```bash
pnpm exec vitest run tests/index.test.ts
```

Expected: the lifecycle assertion fails because `pi.events.emit` has not been called.

- [ ] **Step 4: Replace the direct UI await in `src/index.ts` with the paired lifecycle.**

```ts
pi.events.emit("herdr:blocked", {
  active: true,
  label: "Waiting for questionnaire response",
});
try {
  const uiResult = await runQuestionnaireUI(ctx, questions);
  return {
    content: [{ type: "text", text: formatContentSummary(uiResult) }],
    details: uiResult,
  };
} finally {
  pi.events.emit("herdr:blocked", { active: false });
}
```

- [ ] **Step 5: Verify tests and type-check pass.**

```bash
pnpm exec vitest run tests/index.test.ts
pnpm check
```

Expected: both commands pass.

- [ ] **Step 6: Commit the phase.**

```bash
git add src/index.ts tests/index.test.ts
git commit -m "feat: report questionnaire waits to Herdr"
```

## Plan self-review

- **Spec coverage:** Emits active before the actual wait and inactive on every resolution path, without signaling early failures.
- **Placeholder scan:** The fixture change, assertions, implementation, and commands are concrete.
- **Type consistency:** Uses Pi's existing `ExtensionAPI.events.emit` event bus.
