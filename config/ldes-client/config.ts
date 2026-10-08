import { environment } from "../environment";
import {
  storeError,
  storeObservation,
  storePageInfo,
  storePageProcessedTime,
} from "./util";

export default {
  endpoints: [
    {
      name: "Public Stream",
      LDES_BASE:
        "https://mandatenbeheer.lokaalbestuur.vlaanderen.be/streams/ldes/public",
      FIRST_PAGE:
        "https://mandatenbeheer.lokaalbestuur.vlaanderen.be/streams/ldes/public/checkpoints/2026-10-01T05-00-00/14",
      TARGET_GRAPH: "http://mu.semte.ch/graphs/ldes-validation/content",
      STATUS_GRAPH: "http://mu.semte.ch/graphs/ldes-validation/status",
      EXTRA_HEADERS: {},
      VERSION_PREDICATE: "http://purl.org/dc/terms/isVersionOf",
      TIME_PREDICATE: "http://www.w3.org/ns/prov#generatedAtTime",
    },
  ],
  onPageLoadError: async (error: Error, response: Response) => {
    (error as Error & { dctType?: string }).dctType =
      `http://data.lblod.info/error-types/ldes-page-load`;
    const observation = await storeObservation();
    await storeError(observation, error, response);
  },
  onPageFetchStart() {
    console.log(
      `\n\n\n\n\n\n\nenv: ${JSON.stringify(environment)}\n\n\n\n\n\n`,
    );
    environment.lastPageStart = new Date();
  },
  async onPageLoaded() {
    environment.lastPageLoaded = new Date();
    await storePageInfo();
  },
  async onPageComplete() {
    const pageProcessedAt = new Date();
    await storePageProcessedTime(pageProcessedAt);
  },
  getObservationsGraph(_currentStreamConfig: any) {
    return "http://mu.semte.ch/graphs/ldes-validation/status";
  },
};
