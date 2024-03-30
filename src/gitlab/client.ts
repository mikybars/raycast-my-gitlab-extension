import { Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import { preferences } from "./common";
import { OperationResult } from "@urql/core";
import { AuthorizationError, UnknownServerError } from "./common";


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

export function validResponse(res: OperationResult<any, any>): OperationResult<any, any> {
  if (!res.error) {
    return res;
  }
  if (res.error.message.match(/invalid token/i)) {
    throw new AuthorizationError(res.error.message);
  }
  throw new UnknownServerError(res.error.message);
}

