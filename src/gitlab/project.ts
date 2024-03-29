import { gql } from "@urql/core";
import { client, validResponse } from "./common";

export interface Project {
  id: string;
  name: string;
  fullPath: string;
  defaultBranch: string;
}

type ProjectApi = Project & {
  repository: {
    rootRef: string;
  };
};

const LIST_MY_PROJECTS_QUERY = gql`
query ListMyProjects($after: String) {
    projects(membership: true, after: $after) {
        nodes {
            id
            name
            fullPath
            repository {
                rootRef
            }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
    }
}
`;

export function myProjects(): Promise<Project[]> {
  async function nextPage(after?: string): Promise<Project[]> {
    const res = await client.query(LIST_MY_PROJECTS_QUERY, { after }).toPromise();
    const validRes = validResponse(res);
    const projects = convertToProjects(validRes.data.projects.nodes);
    if (!validRes.data.projects.pageInfo.hasNextPage) {
      return projects;
    }
    return [...projects, ...(await nextPage(validRes.data.projects.pageInfo.endCursor))];
  }

  return nextPage();
}

export function convertToProjects(projectsResponse: ProjectApi[]) {
  return projectsResponse.map((proj) => ({
    ...proj,
    defaultBranch: proj.repository.rootRef,
  }));
}
