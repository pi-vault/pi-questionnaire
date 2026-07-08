# Changelog

All notable changes to `@pi-vault/pi-questionnaire` are documented in this file.

## 0.2.0 - 2026-07-08

### Changed

- Questionnaire schema flattened: `type: "single-choice" | "multi-choice"` replaced by a single `QuestionSchema` with `multiSelect?: boolean` (defaults to `false`).
- `option.value` is now optional; when omitted it defaults to the option's `label`.
- Core pipeline simplified: `processQuestions` removed in favor of explicit `validateQuestions` then `normalizeQuestions`. Tool description now references "single-select / multi-select".
- TUI input handling refactored around a pure interpreter that returns a list of effects (state dispatches, editor text resets, forwards) — keeps the UI adapter thin and moves notes-mode Up/Down save-and-exit into the input layer.
- TUI rendering consolidated: one `renderQuestion` function walks a `RowSlot[]` (option / other / chat / next) instead of separate per-type renderers.
- `theme.ts` seam dissolved; the render theme interface lives where it is used.
- Minimum supported Node bumped from `>=22.19.0` to `>=24.15.0`.
- Internal dependency versions bumped (`@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` to `^0.80.3`, `typebox` to `^1.3.3`).

### Notes

- No user-facing behavior changes beyond the schema rename and option-value defaulting. Validation, normalization, TUI flow, and result shape are unchanged.

## 0.1.0 - 2026-06-21

### Added

- Initial public release of `@pi-vault/pi-questionnaire`.
- A `questionnaire` Pi tool for collecting 1-10 structured user decisions in one interactive flow.
- Support for `single-choice` and `multi-choice` question types.
- An interactive TUI with per-question tabs and a final review screen before submission.
- Recommended-option support for single-choice and multi-choice questions.
- `Type something.` custom-answer handling for single-choice questions.
- `Chat about this` answer handling for questions that need discussion instead of a direct selection.
- Optional per-question notes that let users add context without changing the main answer.
- Agent-facing summary formatting for selected options, custom answers, chat handoff, and notes.
- Validation, normalization, and automated test coverage for the questionnaire flow.
- Quality and release automation through the repo's existing GitHub Actions workflows.

### Changed

- Finalized the pre-release interaction model around sentinel options and notes instead of a separate free-text question type.
- Refined navigation and review rendering during pre-release development to support the current interactive flow.
