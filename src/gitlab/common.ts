import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  gitlabInstance: string;
  gitlabToken: string;
  jiraInstance?: string;
}
export const preferences = getPreferenceValues<Preferences>();

export interface Jira {
  key: string;
  url: string;
}

export class AuthorizationError extends Error {}
export class UnknownServerError extends Error {}

export function tryExtractJira(s: string): Jira | undefined {
  if ((preferences.jiraInstance ?? "") === "") {
    return;
  }

  const jiraKey = s.match(/\[(?<key>[A-Z]+-(\d+))\]/)?.groups?.key;
  if (jiraKey !== undefined) {
    return {
      key: jiraKey,
      url: `${preferences.jiraInstance}/browse/${jiraKey}`,
    };
  }
}

// https://www.chakshunyu.com/blog/how-to-filter-nullable-values-from-an-array-using-typescript/
export function isNonNullable<TValue>(value: TValue | undefined | null): value is TValue {
  return value !== null && value !== undefined; // Can also be `!!value`.
}

export function onlyNonNullables<TValue>(value: (TValue | null)[] | null | undefined): TValue[] {
  return value?.filter(isNonNullable) ?? [];
}
