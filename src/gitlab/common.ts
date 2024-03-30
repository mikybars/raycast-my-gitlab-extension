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

export function pathToUrl(path: string): string {
  return `${preferences.gitlabInstance}${path}`;
}

export class AuthorizationError extends Error {}
export class UnknownServerError extends Error {}
export class ApiValidationError extends Error {}

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
