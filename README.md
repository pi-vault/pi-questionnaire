# @pi-vault/pi-questionnaire

[![npm version](https://img.shields.io/npm/v/%40pi-vault%2Fpi-questionnaire)](https://www.npmjs.com/package/@pi-vault/pi-questionnaire)
[![Quality](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml/badge.svg?branch=master)](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml)
[![Node >= 24.15.0](https://img.shields.io/badge/node-%3E%3D24.15.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

## Description

Add a `questionnaire` tool to Pi so an agent can ask a few structured questions in one focused interaction.

Use it when the agent needs decisions, preferences, or confirmation before it keeps going.

## Install

```bash
pi install npm:@pi-vault/pi-questionnaire
```

Then reload Pi:

```text
/reload
```

## When to use it

Use `questionnaire` when you want to:

- narrow scope before implementation
- choose between a few approaches
- collect rollout or release preferences
- confirm priorities before the agent starts work
- batch several related decisions into one prompt

If the user is already working through the problem in free-form, normal chat is usually better.

## Basic example

```ts
questionnaire({
  questions: [
    {
      id: "scope",
      header: "Scope",
      prompt: "Which scope should we ship first?",
      options: [
        {
          value: "small",
          label: "Small",
          description: "Minimal release scope",
        },
        { value: "full", label: "Full", description: "Broader first release" },
      ],
      recommendation: "small",
    },
    {
      id: "checks",
      header: "Checks",
      prompt: "Which release checks should we run?",
      options: [{ label: "Lint" }, { label: "Typecheck" }, { label: "Tests" }],
      multiSelect: true,
      recommendation: "Lint",
    },
  ],
});
```

## What you can ask

Each question has:

- `id` — unique key
- `header` — short label for tabs and summaries
- `prompt` — the full question
- `options` — 2 to 12 choices

Optional fields:

- `multiSelect: true` — allow more than one choice
- `recommendation` — mark the suggested option
- `allowOther` — append `Type something.` to single- and multi-select questions; a multi-select custom answer replaces checked options
- `allowChat` — let the user say they want to discuss it instead

If an option omits `value`, the label is used as the value.

## What the user can do

For each question, the user can:

- pick one option
- pick several options when `multiSelect` is enabled
- type a custom answer
- choose `Chat about this`
- add a note with extra context

## What the agent gets back

The tool returns a compact text summary the agent can use right away.

Example:

```text
Scope: user selected: 1. Small
Scope note: "keep the first release tight"
Checks: user selected: 1. Lint, 2. Typecheck, 3. Tests
```

Other possible results:

```text
Scope: user wrote: "Ship only the core questionnaire flow"
Features: user wants to discuss this question
```

If the user cancels, the tool returns:

```text
User cancelled the questionnaire
```

## Integration events

The extension emits a shared Pi event only for a valid TUI questionnaire wait:

- `pi-vault:questionnaire:status`

`{ active: true, label }` is emitted immediately before waiting for the interactive questionnaire in TUI mode.
`{ active: false }` is emitted when that wait settles, including cancellation or UI failure.

You can listen for it from another extension:

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

## Limits

- 1 to 10 questions per call
- 2 to 12 options per question

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

MIT — see [`LICENSE`](LICENSE).
