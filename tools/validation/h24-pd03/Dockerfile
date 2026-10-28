# Local security laboratory only. Never use as the API image.
FROM clamav/clamav@sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d
COPY smoke.sh pdf.awk /opt/h24/
HEALTHCHECK NONE
USER 100:101
ENTRYPOINT ["/bin/sh", "/opt/h24/smoke.sh"]
