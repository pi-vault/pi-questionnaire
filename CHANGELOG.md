# Changelog

All notable changes to `@pi-vault/pi-questionnaire` are documented in this file.

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
