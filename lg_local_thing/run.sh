#!/bin/bash

set -e

OPTIONS="/data/options.json"
CONFIG="/data/config.json"

mkdir -p /data/state

HOSTNAME=$(jq -r '.hostname' "$OPTIONS")
MQTT_URL=$(jq -r '.mqtt_url' "$OPTIONS")
MQTT_USER=$(jq -r '.mqtt_user' "$OPTIONS")
MQTT_PASS=$(jq -r '.mqtt_pass' "$OPTIONS")
DISCOVERY_PREFIX=$(jq -r '.discovery_prefix' "$OPTIONS")
RETHINK_PREFIX=$(jq -r '.rethink_prefix' "$OPTIONS")

cat > "$CONFIG" <<EOF_CONFIG
{
  "hostname": "${HOSTNAME}",
  "homeassistant": {
    "mqtt_url": "${MQTT_URL}",
    "discovery_prefix": "${DISCOVERY_PREFIX}",
    "rethink_prefix": "${RETHINK_PREFIX}",
    "mqtt_user": "${MQTT_USER}",
    "mqtt_pass": "${MQTT_PASS}"
  },
  "ca_key_file": "/data/ca.key",
  "ca_cert_file": "/data/ca.cert",
  "https_port": 443,
  "mqtts_port": 8885,
  "mqtt_port": 1885,
  "thinq1_https_port": 46030,
  "thinq1_port": 47878,
  "management_port": 44401,
  "bridge": {
    "storage_path": "/data/state"
  },
  "log": [
    "status",
    "incoming",
    "HTTPS",
    "publish",
    "MGMT"
  ]
}
EOF_CONFIG

echo "[rethink] Starting with hostname=${HOSTNAME}"
echo "[rethink] Home Assistant MQTT=${MQTT_URL}"

exec node /app/dist/rethink-cloud.js "$CONFIG"
