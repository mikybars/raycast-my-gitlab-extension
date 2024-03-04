import { getJsonBodyIfSuccess, graphQlEndpoint, headers } from "./common";
import fetch from "node-fetch";

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

const LIST_MY_PROJECTS_QUERY = `
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
    const res = await fetch(graphQlEndpoint, {
      headers: headers,
      method: "post",
      body: JSON.stringify({
        query: LIST_MY_PROJECTS_QUERY,
        variables: {
          after,
        },
      }),
    });
    const data = await getJsonBodyIfSuccess(res);
    const projects = convertToProjects(data.data.projects.nodes);
    if (!data.data.projects.pageInfo.hasNextPage) {
      return projects;
    }
    return [...projects, ...(await nextPage(data.data.projects.pageInfo.endCursor))];
  }

  return nextPage();
}

export function convertToProjects(projectsResponse: ProjectApi[]) {
  return projectsResponse.map((proj) => ({
    ...proj,
    defaultBranch: proj.repository.rootRef,
  }));
}
