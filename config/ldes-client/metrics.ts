import http from "http";

const PUSHGATEWAY_URL =
  process.env.LDES_METRICS_PUSHGATEWAY_URL || "http://pushgateway:9091";

type Series = {
  counters: Record<string, number>;
  gauges: Record<string, number>;
};

// stream name -> series; each stream is pushed to its own grouping key, so it
// replaces only its own group in the pushgateway
const plain: Record<string, Series> = {};
// stream name -> metric name -> "label=\"value\",..." -> value
const labelled: Record<string, Record<string, Record<string, number>>> = {};

function escapeLabel(value: string) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function keyOf(stream?: string) {
  return stream || "default";
}

function expositionPlain(series: Series) {
  let body = "";
  for (const [name, value] of Object.entries(series.counters)) {
    body += `# TYPE ${name} counter\n${name} ${value}\n`;
  }
  for (const [name, value] of Object.entries(series.gauges)) {
    body += `# TYPE ${name} gauge\n${name} ${value}\n`;
  }
  return body;
}

function expositionLabelled(series: Record<string, Record<string, number>>) {
  let body = "";
  for (const [name, metric] of Object.entries(series)) {
    body += `# TYPE ${name} counter\n`;
    for (const [labels, value] of Object.entries(metric)) {
      body += `${name}{${labels}} ${value}\n`;
    }
  }
  return body;
}

function pushInstance(instance: string, stream: string, body: string) {
  return new Promise<void>((resolve) => {
    const url = new URL(
      `/metrics/job/ldes-client/instance/${encodeURIComponent(
        instance,
      )}/stream/${encodeURIComponent(stream)}`,
      PUSHGATEWAY_URL,
    );
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
          Connection: "close",
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve());
      },
    );
    req.on("error", (err) => {
      console.log(`failed to push metrics to pushgateway: ${err.message}`);
      resolve();
    });
    req.end(body);
  });
}

export async function incrementCounter(name: string, stream?: string) {
  const key = keyOf(stream);
  plain[key] = plain[key] ?? { counters: {}, gauges: {} };
  plain[key].counters[name] = (plain[key].counters[name] ?? 0) + 1;
  await pushInstance("default", key, expositionPlain(plain[key]));
}

export async function setGauge(
  name: string,
  value: number,
  stream?: string,
) {
  const key = keyOf(stream);
  plain[key] = plain[key] ?? { counters: {}, gauges: {} };
  plain[key].gauges[name] = value;
  await pushInstance("default", key, expositionPlain(plain[key]));
}

export async function incrementLabelledCounter(
  name: string,
  labels: Record<string, string>,
  stream?: string,
) {
  const key = keyOf(stream);
  const labelsString = Object.entries(labels)
    .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
    .join(",");
  labelled[key] = labelled[key] ?? {};
  labelled[key][name] = labelled[key][name] ?? {};
  labelled[key][name][labelsString] =
    (labelled[key][name][labelsString] ?? 0) + 1;
  await pushInstance("labelled", key, expositionLabelled(labelled[key]));
}
