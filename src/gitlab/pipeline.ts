import { AsyncState, useCachedPromise } from "@raycast/utils";
import { preferences, onlyNonNullables } from "./common";
import { client, graphql, ResultOf, validResponse } from "./graphql";

export type PipelineApi = ResultOf<typeof pipelineFragment>;
export type Pipeline = Omit<PipelineApi, "path" | "runningJobs" | "failedJobs"> & PipelineCustom;

type PipelineCustom = {
  branchName?: string;
  webUrl?: string;
  runningJobs: CiJob[];
  failedJobs: CiJob[];
};

export type CiJobApi = ResultOf<typeof jobFragment>;
export type CiJob = Omit<CiJobApi, "webPath"> & CiJobCustom;

type CiJobCustom = {
  webUrl?: string;
};

const jobFragment = graphql(`
  fragment Job on CiJob @_unmask {
    stage {
      name
    }
    name
    webPath
  }
`);

export const pipelineFragment = graphql(
  `
    fragment Pipeline on Pipeline @_unmask {
      ref
      status
      path
      updatedAt
      failureReason
      project {
        fullPath
      }
      commit {
        fullTitle
      }
      runningJobs: jobs(statuses: [RUNNING]) {
        nodes {
          ...Job
        }
      }
      failedJobs: jobs(statuses: [FAILED]) {
        nodes {
          ...Job
        }
      }
    }
  `,
  [jobFragment],
);

const latestPipelineQuery = graphql(
  `
    query DefaultBranchLatestPipeline($project: ID!, $defaultBranch: String!) {
      project(fullPath: $project) {
        name
        pipelines(ref: $defaultBranch, first: 1) {
          nodes {
            ...Pipeline
          }
        }
      }
    }
  `,
  [pipelineFragment],
);

export function getLatestPipelineForBranch(projectFullPath: string, branchName: string): AsyncState<Pipeline> {
  return useCachedPromise(
    async (project: string) => {
      const response = await client
        .query(latestPipelineQuery, {
          project,
          defaultBranch: branchName,
        })
        .toPromise();
      const { data } = validResponse(response);
      const pipelines = onlyNonNullables(data.project?.pipelines?.nodes);
      return pipelines.length > 0 ? transform(pipelines[0]) : undefined;
    },
    [projectFullPath],
  );
}

export function transform(pipeline: PipelineApi): Pipeline {
  function pathToUrl(path: string): string {
    return `${preferences.gitlabInstance}${path}`;
  }
  function transformJob(job: CiJobApi): CiJob {
    return {
      ...job,
      webUrl: job.webPath ? pathToUrl(job.webPath) : undefined,
    };
  }

  return {
    ...pipeline,
    branchName: pipeline.ref ?? undefined,
    webUrl: pipeline.path ? pathToUrl(pipeline.path) : undefined,
    runningJobs: onlyNonNullables(pipeline.runningJobs?.nodes).map(transformJob),
    failedJobs: onlyNonNullables(pipeline.failedJobs?.nodes).map(transformJob),
  };
}
