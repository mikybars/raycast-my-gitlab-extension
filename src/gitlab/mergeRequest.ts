import { AsyncState, useCachedPromise } from "@raycast/utils";
import { Jira, onlyNonNullables, tryExtractJira } from "./common";
import { pipelineFragment, Pipeline, transform as transformPipeline } from "./pipeline";
import { User, userFragment, UserTransform, transform as transformUser } from "./user";
import { MrUpdateTimes, lastMrUpdateTimes } from "../storage";
import dayjs from "dayjs";
import { client, graphql, ResultOf, validResponse, VariablesOf } from "./graphql";

export type MergeRequestApi = ResultOf<typeof mergeRequestFragment>;
export type MergeRequest = Omit<MergeRequestApi, "approvedBy" | "author" | "conflicts" | "mergedBy" | "headPipeline"> &
  MergeRequestExtension;

type MergeRequestExtension = {
  hasUpdates: boolean;
  hasAllApprovals: boolean;
  jira: Jira | undefined;
  hasConflicts: boolean;
  approvedBy: User[];
  mergedBy?: User;
  author?: User;
  headPipeline?: Pipeline;
  comments: Comment[];
  unresolvedCommentsCount: number;
};

export type CommentApi = ResultOf<typeof commentFragment>;
export type Comment = Omit<CommentApi, "author"> & CommentExtension;

type CommentExtension = {
  isUnresolved: boolean;
  author?: User;
};

export class MergeRequestCannotBeMergedError extends Error {}

const authorFragment = graphql(`
  fragment MergeRequestAuthor on MergeRequestAuthor @_unmask {
    name
    username
  }
`);

const commentFragment = graphql(
  `
    fragment Comment on Note @_unmask {
      id
      author {
        ...User
      }
      system
      resolvable
      resolved
    }
  `,
  [userFragment],
);

const mergeRequestFragment = graphql(
  `
    fragment MergeRequest on MergeRequest @_unmask {
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
        ...MergeRequestAuthor
      }
      notes {
        nodes {
          ...Comment
        }
      }
      project {
        fullPath
      }
      approvalsLeft
      approvedBy {
        nodes {
          ...User
        }
      }
      mergeUser {
        ...User
      }
      headPipeline {
        ...Pipeline
      }
    }
  `,
  [pipelineFragment, userFragment, authorFragment, commentFragment],
);

const mergeRequestsQuery = graphql(
  `
    query ListMergeRequests($project: ID!, $state: MergeRequestState = opened, $mergedAfter: Time) {
      project(fullPath: $project) {
        mergeRequests(state: $state, mergedAfter: $mergedAfter) {
          nodes {
            ...MergeRequest
          }
        }
      }
    }
  `,
  [mergeRequestFragment],
);

const setDraftMutation = graphql(`
  mutation MergeRequestSetDraftMutation($project: ID!, $mrId: String!, $draft: Boolean!) {
    mergeRequestSetDraft(input: { projectPath: $project, iid: $mrId, draft: $draft }) {
      errors
    }
  }
`);

const acceptMutation = graphql(`
  mutation MergeRequestAcceptMutation($project: ID!, $mrId: String!, $sha: String!, $squash: Boolean) {
    mergeRequestAccept(input: { projectPath: $project, iid: $mrId, sha: $sha, squash: $squash }) {
      errors
    }
  }
`);

async function listMergeRequests(args: VariablesOf<typeof mergeRequestsQuery>): Promise<MergeRequest[]> {
  const response = await client.query(mergeRequestsQuery, args).toPromise();
  const { data } = validResponse(response);
  const mrs = onlyNonNullables(data.project?.mergeRequests?.nodes);
  return transform(mrs, await transformUser(), await lastMrUpdateTimes());
}

export async function markAsReady(mr: MergeRequest): Promise<void> {
  const res = await client
    .mutation(setDraftMutation, {
      project: mr.project.fullPath,
      mrId: mr.iid,
      draft: false,
    })
    .toPromise();
  validResponse(res);
}

export async function markAsDraft(mr: MergeRequest): Promise<void> {
  const res = await client
    .mutation(setDraftMutation, {
      project: mr.project.fullPath,
      mrId: mr.iid,
      draft: true,
    })
    .toPromise();
  validResponse(res);
}

export async function merge(mr: MergeRequest): Promise<void> {
  const res = await client
    .mutation(acceptMutation, {
      project: mr.project.fullPath,
      mrId: mr.iid,
      sha: mr.diffHeadSha!,
      squash: mr.squashOnMerge,
    })
    .toPromise();
  const { data } = validResponse(res);
  const errors = data.mergeRequestAccept?.errors ?? [];
  if (errors.length > 0) {
    throw new MergeRequestCannotBeMergedError(errors[0]);
  }
}

export function allOpenMergeRequests(projectFullPath: string): AsyncState<MergeRequest[]> {
  return useCachedPromise((project) => listMergeRequests({ project }), [projectFullPath]);
}

export function allMergedMergeRequestsToday(projectFullPath: string): AsyncState<MergeRequest[]> {
  function todayAtMidnightIso(): string {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today.toISOString();
  }

  return useCachedPromise(
    (project) => listMergeRequests({ project, state: "merged", mergedAfter: todayAtMidnightIso() }),
    [projectFullPath],
  );
}

function transform(
  mergeRequests: MergeRequestApi[],
  transformUser: UserTransform,
  lastMrUpdateTimes: MrUpdateTimes,
): MergeRequest[] {
  function transformComment(comment: CommentApi): Comment {
    return {
      ...comment,
      isUnresolved: comment.resolvable && !comment.resolved,
      author: comment.author ? transformUser(comment.author) : undefined,
    };
  }

  return mergeRequests.map((mr) => {
    const comments = onlyNonNullables(mr.notes.nodes)
      .filter((c) => !c.system)
      .map(transformComment);
    return {
      ...mr,
      hasUpdates: lastMrUpdateTimes.get(mr.id)?.isBefore(dayjs(mr.updatedAt), "second") ?? false,
      hasAllApprovals: mr.approvalsLeft === 0,
      jira: tryExtractJira(mr.title),
      approvedBy: onlyNonNullables(mr.approvedBy?.nodes).map(transformUser),
      author: mr.author ? transformUser(mr.author) : undefined,
      hasConflicts: mr.conflicts,
      mergedBy: mr.mergeUser ? transformUser(mr.mergeUser) : undefined,
      headPipeline: mr.headPipeline ? transformPipeline(mr.headPipeline) : undefined,
      comments: comments,
      unresolvedCommentsCount: comments.filter((c) => c.isUnresolved).length,
    };
  });
}
