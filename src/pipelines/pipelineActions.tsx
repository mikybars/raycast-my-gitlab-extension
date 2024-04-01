import { Action, Color, Icon } from "@raycast/api";
import { CiJob, Pipeline } from "../gitlab/pipeline";

export const pipelineActionFactories = {
  browse: {
    openFailedJob: (pipeline: Pipeline) => {
      if (pipeline.status === "FAILED" && pipeline.failedJobs.length > 0) {
        return <JobAction job={pipeline.failedJobs[0]} />;
      }
    },

    openInBrowser: (pipeline: Pipeline) => {
      if (pipeline.webUrl) {
        return <Action.OpenInBrowser url={pipeline.webUrl} title="Open in Browser" />;
      }
    },
  },
};

function JobAction(props: { job: CiJob }) {
  if (props.job.webUrl) {
    return (
      <Action.OpenInBrowser
        url={props.job.webUrl}
        icon={{ source: Icon.Globe, tintColor: Color.Red }}
        title="Open Failed Job"
      />
    );
  }
}
