#!/bin/sh
# Wakes the weekly agent. Runs inside the bloom-cron sidecar on the OVH box,
# replacing Vercel Cron. It reaches the app over the docker network rather than
# through Traefik, so the tick still fires while a certificate is renewing.
#
# The secret is read from a file the sidecar writes at startup, not from the
# environment: busybox crond makes no promise about handing its own environment
# to the jobs it spawns, and a file sidesteps every shell-quoting hazard.
set -eu

CRON_SECRET="$(cat /run/cron-secret)"

# `bloom`, not the compose service name `app`. The `web` network is shared with
# every other stack on this box, and at least two of them also expose a service
# called `app`, so that alias round-robins to a stranger's container.
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] weekly tick"
curl -fsS -m 120 \
  -H "authorization: Bearer ${CRON_SECRET}" \
  http://bloom:3000/api/cron/weekly
echo ""
