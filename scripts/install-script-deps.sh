#!/usr/bin/env bash
set -euo pipefail

target_dir="${1:-/home/dune/.dune/bin}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

install -d -m 0755 "$target_dir"
install -d -m 0755 "$target_dir/lib"

for file in \
  apply-pending-battlegroup-update \
  cron-battlegroup-backup \
  cron-battlegroup-update-check \
  daily-battlegroup-restart \
  daily-battlegroup-restart-notice \
  send-dune-broadcast \
  send-dune-shutdown-broadcast
do
  install -m 0755 "$script_dir/$file" "$target_dir/$file"
done

install -m 0644 "$script_dir/lib/dune-service-common.sh" "$target_dir/lib/dune-service-common.sh"

echo "installed service script dependencies to $target_dir"

