import { Color, Icon, getPreferenceValues } from "@raycast/api";
import { MergeRequest, Comment } from "../gitlab/mergeRequest";
import { relativeDateAccessory } from "../utils";
import { User } from "../gitlab/user";
import { isNonNullable } from "../gitlab/common";

interface Preferences {
  colorizedDatesForMergeRequests?: boolean;
}
const preferences = getPreferenceValues<Preferences>();

export const mergeRequestAccessoryFactories = {
  hasUpdates: (mr: MergeRequest) => {
    if (mr.hasUpdates) {
      return {
        icon: { source: Icon.Stars, tintColor: Color.Orange },
        tooltip: "Updated since last viewed",
      };
    }
  },

  conflicts: (mr: MergeRequest) => {
    if (mr.hasConflicts) {
      return {
        icon: { source: Icon.WrenchScrewdriver, tintColor: Color.Red },
        tooltip: "MR has conflicts",
      };
    }
  },

  draft: (mr: MergeRequest) => {
    if (mr.draft) {
      return { icon: Icon.Brush, tooltip: "MR in draft" };
    }
  },

  approvers: (mr: MergeRequest) => {
    const approvers = mr.approvedBy;
    const approversCount = approvers.length;
    if (mr.state !== "merged" && approversCount > 0) {
      return {
        text: approversCount > 1 ? `${approversCount}` : undefined,
        icon: { source: "../assets/approved.png", tintColor: mr.hasAllApprovals ? Color.Green : undefined },
        tooltip: `Approved by ${approvers.map((a) => a.displayName).join(", ")}`,
      };
    }
  },

  createdBy: (mr: MergeRequest) => {
    if (mr.author) {
      return {
        text: { value: mr.author.displayName, color: mr.author.isMe ? Color.Yellow : undefined },
        icon: mr.author.isMe ? { source: Icon.Bolt, tintColor: Color.Yellow } : Icon.Person,
        tooltip: `Created by ${mr.author.displayName}`,
      };
    }
  },

  pipeline: (mr: MergeRequest) => {
    switch (mr.headPipeline?.status) {
      case "FAILED": {
        const firstFailedJob = mr.headPipeline.failedJobs[0];
        return {
          icon: { source: Icon.XMarkCircle, tintColor: Color.Red },
          tooltip:
            mr.headPipeline?.failedJobs.length > 0
              ? `Pipeline failed at ${firstFailedJob.stage}:${firstFailedJob.name}`
              : mr.headPipeline?.failureReason,
        };
      }
      case "RUNNING": {
        const firstRunningJob = mr.headPipeline?.runningJobs[0];
        return {
          icon: { source: Icon.CircleProgress25, tintColor: Color.Blue },
          tooltip:
            mr.headPipeline?.runningJobs.length > 0
              ? `Pipeline is running ${firstRunningJob.stage}:${firstRunningJob.name}`
              : "Pipeline is running",
        };
      }
    }
  },

  comments: (mr: MergeRequest) => {
    if (mr.state === "merged" || (mr.unresolvedCommentsCount == 0 && mr.comments.length == 0)) {
      return;
    }

    function uniqueUsersThatCommented(comments: Comment[]): User[] {
      const uniqueCommentsByUsername = [...new Map(comments.map((c) => [c.author?.username, c])).values()];
      return [...uniqueCommentsByUsername].map((c) => c.author).filter(isNonNullable);
    }
    function commentsAccessory(commentsType: string, icon: Icon, commentFilter?: (c: Comment) => boolean) {
      const filteredComments = mr.comments.filter((c) => commentFilter?.(c) ?? true);
      const uniqueUsers = uniqueUsersThatCommented(filteredComments);
      const commentedByMe = uniqueUsers.some((u) => u.isMe);
      return {
        text: { value: `${filteredComments.length}`, color: commentedByMe ? Color.Yellow : undefined },
        icon: { source: icon, tintColor: commentedByMe ? Color.Yellow : undefined },
        tooltip: `${commentsType} by ${uniqueUsers.map((u) => u.displayName).join(", ")}`,
      };
    }
    return mr.unresolvedCommentsCount > 0
      ? commentsAccessory("Unresolved comments", Icon.SpeechBubbleImportant, (c) => c.isUnresolved)
      : commentsAccessory("Comments", Icon.SpeechBubble);
  },

  mergedBy: (mr: MergeRequest) => {
    if (mr.mergedBy && mr.author?.username != mr.mergedBy.username) {
      return {
        text: mr.mergedBy!.displayName,
        icon: { source: "../assets/merged.png", tintColor: Color.Magenta },
        tooltip: `Merged by ${mr.mergedBy!.displayName}`,
      };
    }
  },

  createdAt: (mr: MergeRequest) => {
    if (mr.state !== "merged") {
      return relativeDateAccessory(mr.createdAt, "Created", preferences.colorizedDatesForMergeRequests);
    }
  },
};
