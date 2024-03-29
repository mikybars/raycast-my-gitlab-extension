import { client, validResponse } from "./common";
import { myUsername as myUsernameFromStorage } from "../storage";
import { gql } from "@urql/core";

export interface User {
  name: string;
  username: string;
  isMe: boolean;
  teamUsername: string;
}

const CURRENT_USER_QUERY = gql`
query CurrentUser {
    currentUser {
        username
    }
}
`;

export async function myUsername(): Promise<string> {
  const res = await client.query(CURRENT_USER_QUERY, {}).toPromise();
  return validResponse(res).data.currentUser.username;
}

export async function enrichUser(u: User) {
  const myUsername = await myUsernameFromStorage();
  u.isMe = u.username === myUsername;
  u.teamUsername = teamUsername(u, myUsername);
}

function teamUsername(u: User, myUsername: string): string {
  function getFirstName(fullname: string): string {
    const [firstName] = fullname.split(" ");
    return firstName;
  }
  return u.username === myUsername ? "me" : getFirstName(u.name);
}
