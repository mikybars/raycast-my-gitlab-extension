import { AsyncState, useCachedPromise } from "@raycast/utils";
import { Jira, tryExtractJira } from "./common";
import { client, validResponse } from "./client";
import { Pipeline, convertToPipeline, PIPELINE_FRAGMENT, PipelineApi } from "./pipeline";
import { User, enrichUser } from "./user";
import { lastMrUpdateTimes } from "../storage";
import dayjs from "dayjs";
import { gql } from '@urql/core';

export interface MergeRequest {
  project: {
    fullPath: string;
  };
  id: string;
  iid: string;
  title: string;
  sha: string;
  state: MergeRequestState;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  hasUpdates: boolean;
  hasConflicts: boolean;
  webUrl: string;
  sourceBranch: string;
  jira?: Jira;
  author: User;
  comments: Comment[];
  unresolvedCommentsCount: number;
  hasComments: boolean;
  approvedBy: User[];
  hasApprovers: boolean;
  hasAllApprovals: boolean;
  mergedBy?: User;
  latestPipeline?: Pipeline;
  mergeOptions: {
    squash: boolean;
  };
}

export type MergeRequestState = "opened" | "closed" | "locked" | "merged";

type MergeRequestApi = MergeRequest & {
  approvalsLeft: number;
  diffHeadSha: string;
  conflicts: boolean;
  approvedBy: {
    nodes: User[];
  };
  mergeUser: User;
  notes: {
    nodes: CommentApi[];
  };
  squashOnMerge: boolean;
  headPipeline: PipelineApi;
};

export interface Comment {
  id: string;
  body: string;
  author: User;
  updatedAt: string;
  isUnresolved: boolean;
  webUrl: string;
}

type CommentApi = Comment & {
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  url: string;
};

export class MergeRequestCannotBeMergedError extends Error { }

const LIST_MERGE_REQUESTS_QUERY = gql`
${PIPELINE_FRAGMENT}
query ListMergeRequests($project: ID!, $state: MergeRequestState = opened, $mergedAfter: Time) {
    project(fullPath: $project) {
        mergeRequests(state: $state, mergedAfter: $mergedAfter) {
            nodes {
                id
                iid
                title
                diffHeadSha
                state
                draft
                createdAt
                updatedAt
                conflicts
                webUrl
                sourceBranch
                squashOnMerge
                author {
                    name
                    username
                }
                notes {
                    nodes {
                        id
                        author {
                            name
                            username
                        }
                        body
                        system
                        updatedAt
                        resolvable
                        resolved
                        url
                    }
                }
                project {
                    fullPath
                }
                approvalsLeft
                approvedBy {
                    nodes {
                        name
                        username
                    }
                }
                mergeUser {
                    name
                    username
                }
                headPipeline {
                    ...PipelineParts
                }
            }
        }
    }
}
`;

const MERGE_REQUEST_SET_DRAFT_MUTATION = `
mutation MergeRequestSetDraftMutation($project: ID!, $mrId: String!, $draft: Boolean!) {
    mergeRequestSetDraft(input: {
        projectPath: $project,
        iid: $mrId,
        draft: $draft
    }) {
        errors
    }
}
`;

const MERGE_REQUEST_ACCEPT_MUTATION = `
mutation MergeRequestAcceptMutation($project: ID!, $mrId: String!, $sha: String!, $squash: Boolean) {
    mergeRequestAccept(input: {
        projectPath: $project,
        iid: $mrId,
        sha: $sha,
        squash: $squash
    }) {
        errors
    }
}
`;

export async function markAsReady(mr: MergeRequest): Promise<void> {
  const res = await client.mutation(
    MERGE_REQUEST_SET_DRAFT_MUTATION,
    {
      project: mr.project.fullPath,
      mrId: mr.iid,
      draft: false
    }
  ).toPromise();
  validResponse(res);
}

export async function markAsDraft(mr: MergeRequest): Promise<void> {
  const res = await client.mutation(
    MERGE_REQUEST_SET_DRAFT_MUTATION,
    {
      project: mr.project.fullPath,
      mrId: mr.iid,
      draft: true
    }
  ).toPromise();
  validResponse(res);
}

export async function merge(mr: MergeRequest): Promise<void> {
  const res = await client.mutation(
    MERGE_REQUEST_ACCEPT_MUTATION,
    {
      project: mr.project.fullPath,
      mrId: mr.iid,
      sha: mr.sha,
      squash: mr.mergeOptions.squash
    }
  ).toPromise();
  const errors = res.data.mergeRequestAccept.errors;
  if (errors.length > 0) {
    throw new MergeRequestCannotBeMergedError(errors[0]);
  }
}

async function mergeRequestsQuery(args) {
  const response = await client.query(LIST_MERGE_REQUESTS_QUERY, args).toPromise();
  const data = validResponse(response).data.project.mergeRequests.nodes;
  return await convertToMergeRequests(data);
}

export function allOpenMergeRequests(projectFullPath: string): AsyncState<MergeRequest[]> {
  return useCachedPromise(
    (project) => mergeRequestsQuery({ project }),
    [projectFullPath]);
}

export function allMergedMergeRequestsToday(projectFullPath: string): AsyncState<MergeRequest[]> {
  function todayAtMidnightIso(): string {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.toISOString();
  }

  return useCachedPromise(
    (project) => mergeRequestsQuery({ project, state: "merged", mergedAfter: todayAtMidnightIso() }),
    [projectFullPath]);
}

async function convertToMergeRequests(mergeRequestsResponse: MergeRequestApi[]): Promise<MergeRequest[]> {
  function convertToComment(comment: CommentApi) {
    return {
      ...comment,
      isUnresolved: comment.resolvable && !comment.resolved,
      webUrl: comment.url,
    };
  }

  const lastUpdateTimes = await lastMrUpdateTimes();

  const mrs = mergeRequestsResponse.map((mr) => ({
    ...mr,
    hasAllApprovals: mr.approvalsLeft === 0,
    sha: mr.diffHeadSha,
    hasConflicts: mr.conflicts,
    hasUpdates: lastUpdateTimes.get(mr.id)?.isBefore(dayjs(mr.updatedAt), "second") ?? false,
    jira: tryExtractJira(mr.title),
    approvedBy: mr.approvedBy.nodes,
    mergedBy: mr.mergeUser,
    comments: mr.notes.nodes.filter((c) => !c.system).map(convertToComment),
    latestPipeline: convertToPipeline(mr.headPipeline),
    mergeOptions: {
      squash: mr.squashOnMerge,
    },
  }));
  mrs.forEach((mr) => (mr.hasComments = mr.comments.length > 0));
  mrs.forEach((mr) => (mr.hasApprovers = mr.approvedBy.length > 0));
  mrs.forEach((mr) => (mr.unresolvedCommentsCount = mr.comments.filter((c) => c.isUnresolved).length));
  await Promise.all(
    [
      ...mrs.map((mr) => mr.author),
      ...mrs.flatMap((mr) => mr.approvedBy),
      ...mrs.filter((mr) => mr.mergedBy).map((mr) => mr.mergedBy),
      ...mrs.flatMap((mr) => mr.comments).map((c) => c.author),
    ].map(enrichUser),
  );
  return mrs;
}
