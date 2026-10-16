import { querySudo } from "@lblod/mu-auth-sudo";
import { sparqlEscapeUri } from "mu";

type SparqlVerifyHandler = (
  streamUri: string,
  contentGraph: string,
  onSparqlError: (
    streamUri: string,
    error: string,
    data: unknown,
  ) => Promise<void>,
) => Promise<void>;

type StreamConfig = {
  name: string;
  LDES_BASE: string;
  FIRST_PAGE: string;
  TARGET_GRAPH: string;
  STATUS_GRAPH: string;
  EXTRA_HEADERS: unknown;
  VERSION_PREDICATE: string;
  TIME_PREDICATE: string;
  sparqlVerify: SparqlVerifyHandler;
};

export const endpoints = [
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
    sparqlVerify: async (streamUri, contentGraph, onSparqlError) => {
      const results = await querySudo(`
          SELECT (COUNT(?membership) AS ?count) WHERE {
            {
              SELECT ?membership WHERE {
                GRAPH ${sparqlEscapeUri(contentGraph)} {
                  ?membership a <http://www.w3.org/ns/org#Membership> ;
                    <http://www.w3.org/ns/org#organisation> ?organisation .
                }
              } GROUP BY ?membership HAVING (COUNT(DISTINCT ?organisation) > 1)
            }
          }
        `);
      const count = parseInt(results?.results.bindings[0]?.count?.value || "0");
      if (count > 0) {
        await onSparqlError(streamUri, "membership-multiple-organisations", {
          count,
        });
      }
    },
  },
] as StreamConfig[];
