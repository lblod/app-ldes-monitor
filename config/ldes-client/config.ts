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
import { endpoints } from "./appconfig";

let lastPageProcessed = null as null | string;
export default {
  endpoints,
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
