import { ActionPanel, Color, Image, List } from "@raycast/api";
import React from "react";
import { MergeRequest } from "../gitlab/mergeRequest";
import { mergeRequestAccessoryFactories } from "./mergeRequestAccessories";
import { mergeRequestActionFactories } from "./mergeRequestActions";

export default function MergeRequestItem(props: { mr: MergeRequest }) {
  return (
    <List.Item
      key={props.mr.id}
      title={props.mr.title}
      subtitle={props.mr.jira?.key}
      icon={mrIcon(props.mr)}
      actions={<MergeRequestActions mr={props.mr} />}
      accessories={mergeRequestAccessories(props.mr)}
    />
  );
}

function mrIcon(mr: MergeRequest): Image.ImageLike {
  switch (mr.state) {
    case "opened":
      return {
        source: "../assets/mropen.png",
        tintColor: Color.Green,
      };
    case "merged":
      return {
        source: "../assets/merged.png",
        tintColor: Color.Magenta,
      };
    default:
      throw `invalid mr state: ${mr.state}`;
  }
}

function MergeRequestActions(props: { mr: MergeRequest }) {
  return (
    <ActionPanel title={props.mr.jira?.key}>
      {Object.entries(mergeRequestActionFactories).map(([sectionName, section]) => (
        <ActionPanel.Section key={sectionName}>
          {Object.entries(section).map(([actionName, actionFactory]) => {
            const action = actionFactory(props.mr);
            if (action) {
              return React.cloneElement(action, { key: actionName });
            }
          })}
        </ActionPanel.Section>
      ))}
    </ActionPanel>
  );
}

function mergeRequestAccessories(mr: MergeRequest): List.Item.Accessory[] {
  return Object.entries(mergeRequestAccessoryFactories)
    .map(([_name, accessoryFactory]) => accessoryFactory(mr))
    .filter((accessory): accessory is List.Item.Accessory => !!accessory);
}
