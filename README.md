> [!WARNING]
> This repository is under construction

This is an app that can monitor the contents of one or more LDES streams. It should track availability, throughput and contents. It should also validate the contents of the stream using certain SPARQL queries or SHACL rules

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
