import { getPreferenceValues } from "@raycast/api";
import { Client, OperationResult, cacheExchange, fetchExchange } from "@urql/core";
import { Response as NodeFetchResponse } from "node-fetch";
import fetch from "node-fetch";

interface Preferences {
  gitlabInstance: string;
  gitlabToken: string;
  jiraInstance?: string;
}
const preferences = getPreferenceValues<Preferences>();

export const headers = {
  Authorization: `bearer ${preferences.gitlabToken}`,
  "Content-Type": "application/json",
};

export interface Jira {
  key: string;
  url: string;
}

export const graphQlEndpoint = `${preferences.gitlabInstance}/api/graphql`;

export const client = new Client({
  fetch: fetch,
  url: graphQlEndpoint,
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

export async function getJsonBodyIfSuccess(res: Response | NodeFetchResponse) {
  if (res.ok) {
    const body = await res.json();
    if (body.errors?.length > 0) {
      throw new ApiValidationError(body.errors[0].message);
    }
    return body;
  }

  if (res.status === 401 || res.status === 403) {
    throw new AuthorizationError(`${res.status} ${res.statusText}`);
  }
  throw new UnknownServerError(`${res.status} ${res.statusText}`);
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
