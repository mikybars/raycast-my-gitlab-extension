import { onlyNonNullables } from "./common";
import { ResultOf, client, graphql, validResponse } from "./graphql";

type ProjectApi = ResultOf<typeof projectFragment>;
export type Project = Omit<ProjectApi, "repository"> & ProjectExtension;

type ProjectExtension = {
  defaultBranch?: string;
};

const projectFragment = graphql(`
  fragment Project on Project @_unmask {
    id
    name
    fullPath
    repository {
      rootRef
    }
  }
`);

const myProjectsQuery = graphql(
  `
    query ListMyProjects($after: String) {
      projects(membership: true, after: $after) {
        nodes {
          ...Project
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  [projectFragment],
);

export function myProjects(): Promise<Project[]> {
  async function nextPage(after?: string): Promise<Project[]> {
    const response = await client.query(myProjectsQuery, { after }).toPromise();
    const { data } = validResponse(response);
    const projects = transform(onlyNonNullables(data.projects?.nodes));
    if (!data.projects?.pageInfo.hasNextPage) {
      return projects;
    }
    return [...projects, ...(await nextPage(data.projects?.pageInfo.endCursor ?? undefined))];
  }

  return nextPage();
}

function transform(projects: ProjectApi[]): Project[] {
  return projects.map((project) => ({
    ...project,
    defaultBranch: project.repository?.rootRef ?? undefined,
  }));
}
