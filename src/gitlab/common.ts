import { getPreferenceValues } from "@raycast/api";
import { Client, OperationResult, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";

interface Preferences {
  gitlabInstance: string;
  gitlabToken: string;
  jiraInstance?: string;
}
const preferences = getPreferenceValues<Preferences>();

export interface Jira {
  key: string;
  url: string;
}

export const client = new Client({
  fetch: fetch,
  url: `${preferences.gitlabInstance}/api/graphql`,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    return {
      headers: {
        Authorization: `bearer ${preferences.gitlabToken}`
      }
    };
  },
});

export function pathToUrl(path: string): string {
  return `${preferences.gitlabInstance}${path}`;
}

export function validResponse(res: OperationResult<any, any>): OperationResult<any, any> {
  if (!res.error) {
    return res;
  }
  if (res.error.message.match(/invalid token/i)) {
    throw new AuthorizationError(res.error.message)
  }
  throw new UnknownServerError(res.error.message)
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
