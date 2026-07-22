# Questionnaire Status Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a stable questionnaire wait-status event that any Pi extension can consume while preventing overlapping interactive questionnaires.

**Architecture:** `pi-vault:questionnaire:status` is a producer-owned, typed event contract exported from the package. The questionnaire tool uses Pi's native `executionMode: "sequential"`, emits active immediately before the UI wait, and clears it in `finally`; validation and non-TUI returns remain outside that lifecycle.

**Tech Stack:** TypeScript, Vitest, `@earendil-works/pi-coding-agent`.

---

## File map

- `src/events.ts` — public status-event channel and JSON-safe payload type.
- `src/index.ts` — sequential tool registration and interactive-wait lifetime.
- `tests/index.test.ts` — deferred UI fixture and lifecycle regressions.
- `package.json` — exposes `@pi-vault/pi-questionnaire/events`.
- `README.md` — consumer-facing event subscription example.

### Task 1: Publish and emit questionnaire status

**Files:**

- Create: `src/events.ts`
- Modify: `src/index.ts`
- Modify: `tests/index.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Replace the minimal registration tests with a deferred TUI fixture and failing lifecycle tests.** Capture the registered tool and event emitter; make `ui.custom` return a promise that each test can resolve or reject without constructing the real TUI.

```ts
const validParams = {
  questions: [{
    id: "scope",
    header: "Scope",
    prompt: "Which scope?",
    options: [{ label: "Small" }, { label: "Full" }],
  }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setupExtension() {
  const registerTool = vi.fn();
  const emit = vi.fn();
  createExtension({ registerTool, events: { emit } } as any);
  return { tool: registerTool.mock.calls[0]![0], emit };
}
```

Add assertions that the registered tool has `executionMode: "sequential"`; a valid TUI call emits `"pi-vault:questionnaire:status"` with `{ active: true, label: "Waiting for questionnaire response" }` before `ui.custom`; resolving a cancelled result and rejecting the UI promise both leave the final emission `{ active: false }`; invalid parameters and non-TUI calls emit nothing.

- [ ] **Step 2: Run the focused test and confirm it fails.**

```bash
pnpm exec vitest run tests/index.test.ts
```

Expected: the new registration/lifecycle expectations fail because the tool has no execution mode and emits no status events.

- [ ] **Step 3: Create the public event contract.**

```ts
// src/events.ts
export const QUESTIONNAIRE_STATUS_EVENT =
  "pi-vault:questionnaire:status" as const;

export type QuestionnaireStatusEventPayload =
  | { active: true; label: string }
  | { active: false };
```

Add the package exports while retaining the existing `pi.extensions` entry:

```json
"exports": {
  ".": "./src/index.ts",
  "./events": "./src/events.ts"
}
```

- [ ] **Step 4: Add the minimal sequential lifecycle in `src/index.ts`.** Import `QUESTIONNAIRE_STATUS_EVENT`, set `executionMode: "sequential"` on the registered tool, and replace the direct UI await with:

```ts
pi.events.emit(QUESTIONNAIRE_STATUS_EVENT, {
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
  pi.events.emit(QUESTIONNAIRE_STATUS_EVENT, { active: false });
}
```

Keep validation, `ctx.mode !== "tui"`, and normalization before this block. Do not add a `try`/`catch` around `emit`: Pi's event bus isolates listener errors.

- [ ] **Step 5: Document the public contract.** Add an `Integration events` README section showing this import and explaining that active is emitted only during a valid TUI wait, then inactive is emitted when that wait settles:

```ts
import {
  QUESTIONNAIRE_STATUS_EVENT,
  type QuestionnaireStatusEventPayload,
} from "@pi-vault/pi-questionnaire/events";

pi.events.on(QUESTIONNAIRE_STATUS_EVENT, (data) => {
  const status = data as QuestionnaireStatusEventPayload;
  // Track status.active for this Pi session.
});
```

- [ ] **Step 6: Verify the focused test, complete check, and package contents.**

```bash
pnpm exec vitest run tests/index.test.ts
pnpm check
pnpm run pack:dry-run
```

Expected: all commands pass and the dry-run archive includes `src/events.ts` with the declared `./events` export.

- [ ] **Step 7: Commit the phase.**

```bash
git add package.json src/events.ts src/index.ts tests/index.test.ts README.md
git commit -m "feat: publish questionnaire wait status"
```

## Plan self-review

- **Spec coverage:** The task defines the public event, stops overlapping UI waits, pairs active/inactive across normal and exceptional completion, and documents consumption.
- **No placeholders:** The fixture shape, event string, payloads, implementation block, commands, and commit are concrete.
- **Type consistency:** `QUESTIONNAIRE_STATUS_EVENT` and `QuestionnaireStatusEventPayload` are the exact exported names; inactive payloads intentionally omit `label`.
