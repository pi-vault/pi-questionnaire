# @pi-vault/pi-questionnaire

[![npm version](https://img.shields.io/npm/v/%40pi-vault%2Fpi-questionnaire)](https://www.npmjs.com/package/@pi-vault/pi-questionnaire)
[![Quality](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml/badge.svg?branch=master)](https://github.com/pi-vault/pi-questionnaire/actions/workflows/quality.yml)
[![Node >= 22.19](https://img.shields.io/badge/node-%3E%3D22.19-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Stop guessing and ask better follow-up questions. `@pi-vault/pi-questionnaire` adds a `questionnaire` tool to Pi so an agent can collect several related answers in one focused interaction.

Use it when you want the agent to pause, ask a few structured questions, and then continue with clearer input.

## Install

```bash
pi install npm:@pi-vault/pi-questionnaire
```

Then reload Pi:

```text
/reload
```

## Good uses

Use `questionnaire` for things like:

- narrowing scope before implementation
- choosing between a few approaches
- collecting rollout or release preferences
- confirming priorities before the agent starts work
- batching several related decisions into one prompt

If the user is already talking through the problem in free-form, normal conversation is usually better.

## What it feels like to use

The user sees one question at a time in an interactive terminal flow, then reviews everything before submitting.

A question can lead to any of these outcomes:

- pick one option
- pick several options
- type a custom answer
- say “Chat about this” instead
- add a note with extra context

That makes it useful when you want structure without forcing every answer into a rigid preset.

## Typical example

A release-planning questionnaire might look like this:

```ts
questionnaire({
  questions: [
    {
      type: "single-choice",
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
      allowOther: true,
      allowChat: true,
    },
    {
      type: "multi-choice",
      id: "checks",
      header: "Checks",
      prompt: "Which release checks should we run?",
      options: [
        { value: "lint", label: "Lint" },
        { value: "types", label: "Typecheck" },
        { value: "tests", label: "Tests" },
      ],
      recommendation: ["lint", "types", "tests"],
      allowChat: true,
    },
  ],
});
```

## What the agent gets back

After submission, the tool returns a compact summary the agent can use immediately.

Example:

```text
Scope: user selected: 1. Small
Scope note: "keep the first release tight"
Checks: user selected: 1. Lint, 2. Typecheck, 3. Tests
```

It can also capture answers like:

```text
Scope: user wrote: "Ship only the core questionnaire flow"
Features: user wants to discuss this question
```

## Writing better questionnaires

A few habits make the tool work better:

- keep it short
- ask only questions that affect the next decision
- offer clear, concrete options
- include a recommended option when you have one
- leave `allowOther` on when a custom answer might matter
- leave `allowChat` on when the user may need to talk something through

## License

MIT
