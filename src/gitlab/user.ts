import { client, graphql, ResultOf, validResponse } from "./graphql";
import { myUsername as myUsernameFromStorage } from "../storage";

export type UserApi = ResultOf<typeof userFragment>;
export type User = UserApi & UserExtension;

type UserExtension = {
  isMe: boolean;
  displayName: string;
};

export const userFragment = graphql(`
  fragment User on UserCore @_unmask {
    name
    username
  }
`);

const currentUserQuery = graphql(`
  query CurrentUser {
    currentUser {
      username
    }
  }
`);

export async function myUsername(): Promise<string | undefined> {
  const res = await client.query(currentUserQuery, {}).toPromise();
  return validResponse(res).data.currentUser?.username;
}

export type UserTransform = (u: UserApi) => User;

export async function transform(): Promise<UserTransform> {
  function firstName(u: UserApi): string {
    const [firstName] = u.name.split(" ");
    return firstName;
  }

  const myUsername = await myUsernameFromStorage();
  return (u: UserApi) => ({
    ...u,
    isMe: u.username === myUsername,
    displayName: u.username === myUsername ? "me" : firstName(u),
  });
}
