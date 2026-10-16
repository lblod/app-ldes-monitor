This is an app that can monitor the contents of one or more LDES streams. It should track availability, throughput and contents. It should also validate the contents of the stream using certain SPARQL queries or SHACL rules

## Grafana user and password

Set the grafana user and password using these env vars:

```yaml
grafana:
  environment:
    GF_SECURITY_ADMIN_USER: "myadmin"
    GF_SECURITY_ADMIN_PASSWORD: "mysecretpassword"
```

Note that these only take effect when the database has not been created yet

## Grafana url

The grafana notifications refer the user to the grafana location. Fill it out in your docker-compose.override.yml's grafana env

```yaml
grafana:
  environment:
    GF_SERVER_DOMAIN: "grafana.example.com"
    GF_SERVER_ROOT_URL: "https://grafana.example.com/"
```

## Watchman url

Sadly, grafana does not allow using env vars in the alert rules section, so we
can't tell the user to view the watchman url in the notification email they receive.

We could define a new message if we'd be ok with losing the fancy html created by
grafana, but at this time I'm not ok with that. Another option would be to run a script
on startup that replaces the env var into the alert-rules.yaml file before startin grafana.
Again not ok with that at this time.

This leaves me with asking you to replace the WATCHMAN_URL variable yourself in the alert-rules.yaml file

## Email notifications

The Grafana alerting setup routes all alerts to an email contact point
(`config/grafana/provisioning/alerting/contact-points.yaml`) whose recipient
address is read from the `MONITORING_TARGET_EMAIL` environment variable. The
SMTP connection itself is configured server-wide via `GF_SMTP_*` environment
variables. Sensitive values are meant to be provided in a
`docker-compose.override.yml`. For example:

```yaml
grafana:
  environment:
    # SMTP connection details consumed by Grafana (server-wide [smtp] config).
    # Well-known hosts: gmail -> smtp.gmail.com:587, outlook -> smtp-mail.outlook.com:587
    GF_SMTP_ENABLED: "true"
    GF_SMTP_HOST: "smtp-extern.example.com:587"
    GF_SMTP_USER: "abb-ldes-monitoring"
    GF_SMTP_PASSWORD: "somesupersecretpassword" # note: for gmail, use app passwords
    GF_SMTP_FROM_ADDRESS: "abb-ldes-monitoring@example.com"
    GF_SMTP_FROM_NAME: "LDES monitoring"
    GF_SMTP_SKIP_VERIFY: "true" # secure connection disabled
    # Recipient for the provisioned email contact point/notification policy
    MONITORING_TARGET_EMAIL: "someuser@example.com"
```

> [!NOTE]
> Grafana expands `$VARIABLE` references in provisioning files. If an
> environment value (e.g. the SMTP password) contains a literal `$`, escape
> it by writing it twice (`$$`), otherwise the rest of the value will be
> interpreted as a variable reference. Example: value `Pa$$sw0rd` is
> delivered as `Pa$sw0rd`. Setting the value via GF*SMTP*\* in docker-compose
> does NOT require escaping (Grafana's config expansion applies to the
> provisioning file, not to the env values themselves).

## Standard pages

Grafana is not exposed by default, you will likely want to expose it so you can view alerts and dashboards.

The dashboard per LDES stream is available at http://localhost:3000/d/ldes-client/ldes-client
The alerts are available at http://localhost:3000/alerting/list

You will likely also want to expose the identifier so you can access the custom watchman UI that shows useful statistics and the last time the stream's structure changed as well as the diff of that change: http://localhost/statistics

# LDES Monitor — User Guide

**app-ldes-monitor** is a semantic.works application that harvests one or more [LDES](https://semiceu.github.io/LDES/) streams into a triplestore and keeps an eye on them: availability, throughput, contents and structure.

## What it does

| Component                              | Role                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ldes-client**                        | Harvests pages of the configured LDES stream(s), ingesting every LDES member into the triplestore. Reports progress and errors as metrics.                                                            |
| **ldes-watchman**                      | Watches the ingested content: computes statistics hourly, tracks the _shape_ (types, predicates, datatypes) of the stream, and runs configurable SPARQL validation checks. Serves the statistics API. |
| **frontend (Ember)**                   | "LDES Watchman" UI showing the watchman's statistics.                                                                                                                                                 |
| **pushgateway + prometheus + grafana** | Collects metrics and alerts; provisions a per-stream dashboard and email alerting.                                                                                                                    |

## 1. The Watchman UI

Available at `/statistics`. Everything is scoped to one stream, selectable via the dropdown at the top.

- **Last processed page** — the most recent LDES page the client handled, and how long ago.
- **Last format change** — when the stream's _shape_ last changed, with a "Show diff" button to see a git-like diff of added/removed types, predicates and datatypes.
- **Daily statistics** — instance counts per day, including an overview of the last 30 days and an "Instances per day" chart.
- **Totals** — instances (LDES members), pages processed, errors, average load/processing duration.
- **Type distribution** — pie chart of the content types present in the stream.
- **Sparql validation errors (last 30 days)** — the most recent distinct errors, each with name, time and result; shows the top 5 with a "Show more" button.

## 2. The Watchman API (`/ldes-watchman-api/…`)

All endpoints take a `streamUri` parameter (see `/ldes-watchman-api/streams` for the list):

- `GET /statistics` and `GET /statistics/time-distribution` — statistics for a period (`from`/`to`, optional `type`).
- `GET /shape` — current shape of the stream content.
- `GET /shape/diff` — the two most recent shape reports and their difference.
- `GET /sparql-errors` — most recent distinct validation errors per error name in a period (`from`/`to`).

## 3. Grafana dashboard & alerts (expose at `:3000`)

- **Dashboard** `http://localhost:3000/d/ldes-client/ldes-client` — latest heartbeat, seconds since last fetch, error counts, last error, page latency, errors over the last week, pages completed per hour, shape changes and **last sparql validation error**.
- **Alerts** (emailed via the configured SMTP contact point):
  - _heartbeat stalled_ — no page fetch started for 5 minutes (stream may be blocked or dead)
  - _errors increased_ — client-side processing errors spiked in the last 10 minutes
  - _sparql validation errors increased_ — the watchman's validation checks failed
  - _pages completed per hour spike_ — unusual harvesting activity (possible duplicate pages)
  - _shape changed_ — the structure of the stream content changed

Admin/db-password setup, Grafana URL, `WATCHMAN_URL` in `alert-rules.yaml`, and SMTP/recipient configuration are described in the README.

## 4. Extending

Add a stream or a check in `config/ldes-watchman/config.ts`: each stream has a `content` graph, a `status` graph, optional `onShapeChange` hooks and optional `sparqlVerify` functions — small SPARQL queries over the content graph that run on a cron and record `ext:Error` entries + metrics when they detect a problem. Client hooks for page processing and metrics live in `config/ldes-client/`.
