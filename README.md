# @pi-vault/pi-questionnaire

[![npm version](https://img.shields.io/npm/v/%40pi-vault%2Fpi-questionnaire)](https://www.npmjs.com/package/@pi-vault/pi-questionnaire)
[![Quality](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml/badge.svg?branch=master)](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml)
[![Node >= 24.15.0](https://img.shields.io/badge/node-%3E%3D24.15.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

## Description

When a Pi agent needs a decision before it can keep going, it calls this tool instead of guessing. You answer a few focused questions in an in-terminal UI; the agent proceeds with your answers in hand.

## Install

Install or upgrade the extension:

```bash
pi install npm:@pi-vault/pi-questionnaire
```

Reload Pi after installing or upgrading:

```text
/reload
```

## How it works from your side

1. The agent asks itself whether it has enough to proceed. If not, it builds a small set of focused questions and calls the questionnaire tool.
2. Pi switches to a TUI questionnaire view: one tab per question, a recommended option marked where the agent has one, and a final review screen before the answers are sent.
3. You answer. The agent resumes with your answers as a compact summary it can act on.

You do not need to call anything. If you want the agent to skip clarifying and just keep going, ignore the question view and tell it in chat.

## What the questions look like

Each question is a tab with its `header` as the label and its `prompt` as the body. The options sit below as a numbered list. A recommended option, when one exists, is marked.

After every option there may be three extra rows, depending on the question:

- **`Type something.`** — pick when none of the listed options fit. Type your answer and submit. On a multi-select question, a custom answer replaces every option you'd checked.
- **`Chat about this`** — pick when you'd rather discuss than pick. The agent switches to conversation for that question instead of expecting a value.
- **`Next`** — present on multi-select questions. Confirms whatever you've checked and moves you on.

A **`note`** row is always available per question. Notes don't change your answer; they ride alongside it as extra context.

You can answer 1 to 10 questions in a single questionnaire. Each question gives you 2 to 12 options to choose from.

## What the agent sees

A compact text summary, one line per question, that it can act on immediately:

```text
Scope: user selected: 1. Small
Scope note: "keep the first release tight"
Checks: user selected: 1. Lint, 2. Typecheck, 3. Tests
```

Other shapes it can receive:

```text
Scope: user wrote: "Ship only the core questionnaire flow"
Features: user wants to discuss this question
```

If you cancel mid-questionnaire:

```text
User cancelled the questionnaire
```

## Integration events

The extension emits a shared Pi event around every questionnaire wait, available to any extension listening on this Pi session:

- `pi-vault:questionnaire:status`

Payload:

```ts
type QuestionnaireStatusEventPayload =
  | { active: true; label: string }
  | { active: false };
```

`{ active: true, label }` is emitted immediately before the interactive TUI wait. `{ active: false }` is emitted when the wait settles, including on cancellation or UI failure.

Listener example:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  QUESTIONNAIRE_STATUS_EVENT,
  type QuestionnaireStatusEventPayload,
} from "@pi-vault/pi-questionnaire/events";

export default function createExtension(pi: ExtensionAPI) {
  pi.events.on(QUESTIONNAIRE_STATUS_EVENT, (data) => {
    const status = data as QuestionnaireStatusEventPayload;
    // Track status.active for this Pi session.
  });
}
```

## Schema reference (for the agent)

The table below describes the shape the agent sends. It is here for completeness; you do not write or pass these arguments yourself.

| Field            | Required | Notes                                                                                                      |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `id`             | yes      | Unique key per call, returned in the summary.                                                              |
| `header`         | yes      | Short tab label.                                                                                           |
| `prompt`         | yes      | The full question.                                                                                         |
| `options`        | yes      | 2–12 choices. Each has `label` (required), optional `value` (defaults to `label`), optional `description`. |
| `multiSelect`    | no       | Allow multiple selections (default `false`).                                                               |
| `recommendation` | no       | Value of the recommended option.                                                                           |
| `allowOther`     | no       | Append `Type something.` row (default `true`).                                                             |
| `allowChat`      | no       | Append `Chat about this` row (default `true`).                                                             |

Limits: 1 to 10 questions per call, 2 to 12 options per question. If `option.value` is omitted, the option's `label` is used as its value.

## Development

```bash
pnpm install
pnpm check
pnpm run pack:dry-run
pnpm run release:check
```

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release notes.

## License

MIT. See [`LICENSE`](LICENSE).
