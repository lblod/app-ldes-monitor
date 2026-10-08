import { updateSudo } from "@lblod/mu-auth-sudo";
import {
  sparqlEscapeUri,
  sparqlEscapeString,
  sparqlEscapeInt,
  sparqlEscapeFloat,
  sparqlEscapeDateTime,
  uuid,
} from "mu";
import {
  environment,
  BATCH_GRAPH,
  WORKING_GRAPH,
  BYPASS_MU_AUTH,
  DIRECT_DATABASE_CONNECTION,
} from "../environment";
import config from "./config";

export async function storeError(
  observation: string,
  error: Error & { dctType?: string },
  response?: Response,
) {
  const errorId = uuid();
  const errorUri = `http://data.lblod.info/errors/${errorId}`;
  let statusSnippet = "";
  if (response) {
    statusSnippet = `<http://open-services.net/ns/core#statusCode> ${sparqlEscapeInt(response.status)} ;`;
  }
  let typeSnippet = "";
  if (error.dctType) {
    typeSnippet = `<http://purl.org/dc/terms/type> ${sparqlEscapeUri(error.dctType)}`;
  }

  const graph = config.getObservationsGraph(
    environment.getCurrentStreamConfig(),
  );

  await updateSudo(`
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

      INSERT DATA {
        GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(errorUri)} a <http://open-services.net/ns/core#Error> ;
            mu:uuid ${sparqlEscapeString(errorId)} ;
            ${statusSnippet}
            ${typeSnippet}
            <http://purl.org/dc/terms/title> ${sparqlEscapeString(error.message)} .
        ${sparqlEscapeUri(observation)} <http://www.w3.org/ns/sosa/hasResult> ${sparqlEscapeUri(errorUri)} .
        }
      }
    `);
}

export async function storeObservation() {
  const observationId = uuid();
  const observationUri = `http://data.lblod.info/observations/${observationId}`;
  const now = new Date();
  const graph = config.getObservationsGraph(
    environment.getCurrentStreamConfig(),
  );

  await updateSudo(`
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {
    GRAPH ${sparqlEscapeUri(graph)} {
    ${sparqlEscapeUri(observationUri)} a <http://www.w3.org/ns/sosa/Observation> ;
        <http://mu.semte.ch/vocabularies/core/uuid> ${sparqlEscapeString(observationId)} ;
        <http://www.w3.org/ns/sosa/resultTime> ${sparqlEscapeDateTime(now)} ;
        <http://www.w3.org/ns/sosa/hasFeatureOfInterest> ${sparqlEscapeUri(environment.getCurrentStreamConfig().LDES_BASE)} .
    }
  }`);

  return observationUri;
}
export async function storePageProcessedTime(processedAt: Date) {
  const observationUri = await storeObservation();
  const resultId = uuid();
  const resultUri = `http://data.lblod.info/results/${resultId}`;
  const pageStart = environment.lastPageStart.getTime();
  const pageLoaded = environment.lastPageLoaded.getTime();
  const duration = processedAt.getTime() - pageStart;
  const loadDuration = pageLoaded - pageStart;
  const graph = config.getObservationsGraph(
    environment.getCurrentStreamConfig(),
  );

  await updateSudo(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(observationUri)} <http://www.w3.org/ns/sosa/hasResult> ${sparqlEscapeUri(resultUri)} ;
          <http://www.w3.org/ns/sosa/hasSimpleResult> ${sparqlEscapeFloat(duration)} .
        ${sparqlEscapeUri(resultUri)} a <http://www.w3.org/ns/sosa/Result> ;
          <http://mu.semte.ch/vocabularies/core/uuid> ${sparqlEscapeString(resultId)} ;
          ext:durationLoad ${sparqlEscapeFloat(loadDuration)} ;
          ext:durationComplete ${sparqlEscapeFloat(duration)} .
      }
    }
  `);
}

export async function storeMembers() {
  const { env, connectionOptions } = getConnectionInfo();
  await updateSudo(
    `INSERT {
      GRAPH ${sparqlEscapeUri(env.TARGET_GRAPH)} {
        ?versionedMember ?p ?o.
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(BATCH_GRAPH)} {
        ?stream <https://w3id.org/tree#member> ?versionedMember .
        ?versionedMember ?p ?o.
      }
    }`,
    {},
    connectionOptions,
  );
}

export async function storePageInfo() {
  const { env, connectionOptions } = getConnectionInfo();
  await updateSudo(
    `INSERT {
      GRAPH ${sparqlEscapeUri(env.TARGET_GRAPH)} {
        ?s ?p ?o.
        ?relation ?rp ?ro.
      }
    } WHERE {
      GRAPH ${sparqlEscapeUri(WORKING_GRAPH)} {
        ?s a <https://w3id.org/tree#Node> .
        ?s ?p ?o.
        OPTIONAL {
          ?s <https://w3id.org/tree#relation> ?relation.
          ?relation ?rp ?ro.
        }
      }
    }`,
    {},
    connectionOptions,
  );
}

function getConnectionInfo() {
  let connectionOptions = {};
  if (BYPASS_MU_AUTH) {
    console.log(">>>>> bypassing mu-auth");
    connectionOptions = {
      sparqlEndpoint: DIRECT_DATABASE_CONNECTION,
    };
  }
  const env = {
    TARGET_GRAPH: environment.getTargetGraph(),
  };
  return { env, connectionOptions };
}
