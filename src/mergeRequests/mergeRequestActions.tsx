import { Action, Color, Icon, Toast, showToast } from "@raycast/api";
import { MergeRequestCannotBeMergedError, markAsDraft, markAsReady, merge, MergeRequest } from "../gitlab/mergeRequest";

export const mergeRequestActionFactories = {
  browse: {
    openInBrowser: (mr: MergeRequest) => {
      return <Action.OpenInBrowser url={mr.webUrl!} title="Open in Browser" />;
    },

    openJira: (mr: MergeRequest) => {
      if (mr.jira !== undefined) {
        return <Action.OpenInBrowser url={mr.jira.url} title="Open Jira" />;
      }
    },

    openPipeline: (mr: MergeRequest) => {
      if (!mr.headPipeline) {
        return;
      }

      if (mr.headPipeline.status === "FAILED" && mr.headPipeline.failedJobs.length > 0) {
        const firstFailedJob = mr.headPipeline.failedJobs[0];
        if (firstFailedJob.webUrl) {
          return (
            <Action.OpenInBrowser
              url={firstFailedJob.webUrl}
              icon={{ source: Icon.Globe, tintColor: Color.Red }}
              title="Open Failed Job"
            />
          );
        }
      } else if (mr.headPipeline.webUrl) {
        return <Action.OpenInBrowser url={mr.headPipeline.webUrl} title="Open Pipeline" />;
      }
    },
  },

  actions: {
    markAsDraft: (mr: MergeRequest) => {
      if (mr.draft) {
        return (
          <Action
            title="Mark as Ready"
            icon={Icon.CheckRosette}
            onAction={() => markAsReady(mr).then(() => showToast({ title: `MR !${mr.iid} marked as ready` }))}
          />
        );
      } else {
        return (
          <Action
            title="Mark as Draft"
            icon={Icon.Brush}
            onAction={() => markAsDraft(mr).then(() => showToast({ title: `MR !${mr.iid} marked as draft` }))}
          />
        );
      }
    },

    merge: (mr: MergeRequest) => {
      return (
        <Action
          title={mr.squashOnMerge ? "Merge with Squash" : "Merge with Commit"}
          icon={{ source: "../assets/merged.png", tintColor: Color.Magenta }}
          onAction={() =>
            merge(mr)
              .then(() => showToast({ title: `MR !${mr.iid} was successfully merged` }))
              .catch((err) => {
                if (err instanceof MergeRequestCannotBeMergedError) {
                  return showToast({
                    title: `MR !${mr.iid} cannot be merged`,
                    message: err.message,
                    style: Toast.Style.Failure,
                  });
                }
              })
          }
        />
      );
    },

  },

  copy: {
    title: (mr: MergeRequest) => {
      return <Action.CopyToClipboard content={mr.title} title="Copy Title" />;
    },

    sourceBranch: (mr: MergeRequest) => {
      return <Action.CopyToClipboard content={mr.sourceBranch} title="Copy Branch Name" />;
    },

    jiraKey: (mr: MergeRequest) => {
      if (mr.jira) {
        return <Action.CopyToClipboard content={mr.jira.key} title="Copy Jira Key" />;
      }
    },
  },
}