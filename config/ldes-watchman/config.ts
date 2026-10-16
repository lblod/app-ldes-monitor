import { incrementCounter, setGauge } from "../metrics";
import { onSparqlError } from "../sparql-errors";
import { endpoints } from "./appconfig";

export const config = {
  streams: {},
} as Config;

const onShapeChange = async (streamUri: string, path: string) => {
  await incrementCounter(
    "ldes_watchman_shape_changes_total",
    config.streams[streamUri].name,
  );
  await setGauge(
    "ldes_watchman_last_shape_change_timestamp_seconds",
    new Date().getTime() / 1000,
    config.streams[streamUri].name,
  );
  console.log("shape change detected in ", streamUri, " stored at ", path);
};

endpoints.forEach((endpoint: any) => {
  config.streams[endpoint.LDES_BASE] = {
    ...endpoint,
    content: endpoint.TARGET_GRAPH,
    status: endpoint.STATUS_GRAPH,
    sparqlVerify: async (streamUri: string, contentGraph: string) => {
      await endpoint.sparqlVerify(streamUri, contentGraph, onSparqlError);
    },
    onShapeChange,
  };
});

export type Config = {
  streams: Record<
    string,
    {
      name: string;
      content: string;
      status: string;
      onShapeChange?: (streamUri: string, path: String) => Promise<void>;
    }
  >;
};
