import { initGraphQLTada } from "gql.tada";
import type { introspection } from "../graphql-env.js";
import { AnyVariables, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import { AuthorizationError, UnknownServerError, preferences } from "./common";
import { OperationResult } from "@urql/core";

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    Time: string;
  };
}>();

export type { FragmentOf, ResultOf, VariablesOf } from "gql.tada";

export const client = new Client({
  fetch: fetch,
  url: `${preferences.gitlabInstance}/api/graphql`,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    return {
      headers: {
        Authorization: `bearer ${preferences.gitlabToken}`,
      },
    };
  },
});

type ValidResponse<T, V extends AnyVariables> = Omit<OperationResult<T, V>, "data"> & { data: T };

export function validResponse<T, V extends AnyVariables>(res: OperationResult<T, V>): ValidResponse<T, V> {
  if (!res.error) {
    return { ...res, data: res.data! };
  }
  if (res.error.response?.status === 401) {
    throw new AuthorizationError("", { cause: res.error });
  }
  if (res.error.networkError) {
    throw res.error.networkError;
  }

  throw new UnknownServerError("", { cause: res.error });
}
