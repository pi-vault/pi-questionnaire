export const QUESTIONNAIRE_STATUS_EVENT = "pi-vault:questionnaire:status" as const;

export type QuestionnaireStatusEventPayload =
  | { active: true; label: string }
  | { active: false };
