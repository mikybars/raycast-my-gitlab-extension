import { AsyncState, useCachedPromise } from "@raycast/utils";
import { pathToUrl } from "./common";
import { client, validResponse } from "./client";
import { gql } from "@urql/core";

export interface Pipeline {
  project: {
    fullPath: string;
  };
  branchName: string;
  commit: {
    title: string;
  };
  status: PipelineStatus;
  updatedAt: string;
  webUrl: string;
  runningJobs: Job[];
  failedJobs: Job[];
  hasRunningJobs: boolean;
  hasFailedJobs: boolean;
  failureReason: string;
}

type PipelineStatus =
  | "created"
  | "waiting_for_response"
  | "preparing"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "failed"
  | "canceled"
  | "skipped"
  | "manual"
  | "scheduled";

export type PipelineApi = Pipeline & {
  ref: string;
  path: string;
  createdAt: string;
  commit: {
    fullTitle: string;
  };
  webPath: string;
  runningJobs: {
    nodes: JobApi[];
  };
  failedJobs: {
    nodes: JobApi[];
  };
};

export interface Job {
  name: string;
  stage: string;
  web_url: string;
}

type JobApi = Job & {
  stage: {
    name: string;
  };
  webPath: string;
};

const jobFragment = `
fragment JobParts on CiJob {
    stage {
        name
    }
    name
    webPath
}
`;

export const PIPELINE_FRAGMENT = `
${jobFragment}
fragment PipelineParts on Pipeline {
    ref
    status
    path
    createdAt
    updatedAt
    failureReason
    commit {
        fullTitle
    }
    runningJobs: jobs(statuses: [RUNNING]) {
        nodes {
            ...JobParts
        }
    },
    failedJobs: jobs(statuses: [FAILED]) {
        nodes {
            ...JobParts
        }
    }
}
`;

const LATEST_PIPELINE_QUERY = gql`
${PIPELINE_FRAGMENT}
query DefaultBranchLatestPipeline($project: ID!, $defaultBranch: String!) {
    project(fullPath: $project) {
        name
        pipelines(ref: $defaultBranch, first: 1) {
            nodes {
                project {
                    fullPath
                }
                ...PipelineParts
            }
        }
    }
}
`;

export function getLatestPipelineForBranch(projectFullPath: string, branchName: string): AsyncState<Pipeline> {
  return useCachedPromise(
    async (project: string) => {
      const response = await client.query(
        LATEST_PIPELINE_QUERY,
        {
          project,
          defaultBranch: branchName
        }
      ).toPromise();
      const data = validResponse(response).data.project.pipelines.nodes;
      if (data.length === 0) {
        return undefined;
      }
      return convertToPipeline(data[0]);
    },
    [projectFullPath]);
}

export function convertToPipeline(pipelineResponse: PipelineApi): Pipeline {
  function convertToJob(job: JobApi) {
    return {
      stage: job.stage.name,
      name: job.name,
      web_url: pathToUrl(job.webPath),
    };
  }
  return {
    ...pipelineResponse,
    commit: {
      title: pipelineResponse.commit.fullTitle,
    },
    branchName: pipelineResponse.ref,
    status: pipelineResponse.status.toLowerCase() as PipelineStatus,
    webUrl: pathToUrl(pipelineResponse.path),
    runningJobs: pipelineResponse.runningJobs.nodes.map(convertToJob),
    failedJobs: pipelineResponse.failedJobs.nodes.map(convertToJob),
    hasRunningJobs: pipelineResponse.runningJobs.nodes.length > 0,
    hasFailedJobs: pipelineResponse.failedJobs.nodes.length > 0,
  };
}
