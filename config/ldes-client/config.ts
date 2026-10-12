import { environment } from "../environment";
import {
  incrementCounter,
  incrementLabelledCounter,
  setGauge,
} from "./metrics";
import {
  storeError,
  storeObservation,
  storePageInfo,
  storePageProcessedTime,
} from "./util";

let lastPageProcessed = null as null | string;
export default {
  endpoints: [
    {
      name: "Public Stream",
      LDES_BASE:
        "https://mandatenbeheer.lokaalbestuur.vlaanderen.be/streams/ldes/public",
      FIRST_PAGE:
        "https://mandatenbeheer.lokaalbestuur.vlaanderen.be/streams/ldes/public/checkpoints/2026-10-01T05-00-00/1",
      TARGET_GRAPH: "http://mu.semte.ch/graphs/ldes-validation/public/content",
      STATUS_GRAPH: "http://mu.semte.ch/graphs/ldes-validation/public/status",
      EXTRA_HEADERS: {},
      VERSION_PREDICATE: "http://purl.org/dc/terms/isVersionOf",
      TIME_PREDICATE: "http://www.w3.org/ns/prov#generatedAtTime",
    },
  ],
  onPageLoadError: async (error: Error, response: Response) => {
    const stream = environment.getCurrentStreamConfig().name;
    (error as Error & { dctType?: string }).dctType =
      `http://data.lblod.info/error-types/ldes-page-load`;
    const observation = await storeObservation();
    await storeError(observation, error, response);
    await incrementLabelledCounter(
      "ldes_page_load_errors_total",
      {
        error_type: error.message,
        status: response ? String(response.status) : "unknown",
      },
      stream,
    );
    await incrementCounter("ldes_errors_total", stream);
    await setGauge(
      "ldes_last_error_timestamp_seconds",
      Date.now() / 1000,
      stream,
    );
  },
  async onPageFetchStart() {
    const stream = environment.getCurrentStreamConfig().name;
    environment.lastPageStart = new Date();
    await setGauge(
      "ldes_last_page_fetch_start_timestamp_seconds",
      Date.now() / 1000,
      stream,
    );
    await incrementCounter("ldes_page_fetches_total", stream);
  },
  async onPageLoaded() {
    const stream = environment.getCurrentStreamConfig().name;
    const loadedAt = new Date();
    environment.lastPageLoaded = loadedAt;
    await storePageInfo();
    const loadDuration =
      (loadedAt.getTime() - environment.lastPageStart.getTime()) / 1000;
    await setGauge("ldes_page_load_duration_seconds", loadDuration, stream);
    await setGauge(
      "ldes_last_page_loaded_timestamp_seconds",
      loadedAt.getTime() / 1000,
      stream,
    );
    await incrementCounter("ldes_pages_loaded_total", stream);
  },
  async onPageComplete(currentPage: string) {
    const stream = environment.getCurrentStreamConfig().name;
    const pageProcessedAt = new Date();
    await storePageProcessedTime(currentPage, pageProcessedAt);
    const processDuration =
      (pageProcessedAt.getTime() - environment.lastPageStart.getTime()) / 1000;
    await setGauge(
      "ldes_page_process_duration_seconds",
      processDuration,
      stream,
    );
    await incrementCounter("ldes_pages_completed_total", stream);
    if (currentPage != lastPageProcessed) {
      await incrementCounter("ldes_new_pages_seen_total", stream);
    }
    lastPageProcessed = currentPage;
  },
  getObservationsGraph(currentStreamConfig: any) {
    return currentStreamConfig.STATUS_GRAPH;
  },
};
