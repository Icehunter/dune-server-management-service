#!/usr/bin/env bash

dune_export_kubeconfig() {
  [[ -n "${KUBECONFIG:-}" ]] && return 0

  local _kc
  for _kc in \
    /etc/rancher/k3s/k3s.yaml \
    "$HOME/.kube/config"
  do
    if [[ -r "$_kc" ]]; then
      export KUBECONFIG="$_kc"
      return 0
    fi
  done

  local _sa=/var/run/secrets/kubernetes.io/serviceaccount
  if [[ -f "$_sa/token" && -n "${KUBERNETES_SERVICE_HOST:-}" ]]; then
    _kc=/tmp/dune-in-cluster-kubeconfig.yaml
    if [[ ! -f "$_kc" ]]; then
      cat > "$_kc" <<EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority: ${_sa}/ca.crt
    server: https://${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT:-443}
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
users:
- name: default
  user:
    tokenFile: ${_sa}/token
EOF
    fi
    export KUBECONFIG="$_kc"
  fi
}

dune_select_kubectl() {
  if command -v kubectl >/dev/null 2>&1 && kubectl version --client >/dev/null 2>&1; then
    kubectl_cmd=(kubectl)
  elif command -v sudo >/dev/null 2>&1; then
    kubectl_cmd=(sudo kubectl)
  else
    echo "kubectl not found, and sudo is unavailable" >&2
    return 1
  fi
}

dune_detect_game_mq() {
  local namespace="${1:-}"
  local mq_pod="${2:-}"

  dune_select_kubectl

  if [[ -z "$namespace" ]]; then
    mapfile -t namespace_candidates < <("${kubectl_cmd[@]}" get pods -A --no-headers -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name 2>/dev/null \
      | awk '$1 ~ /^funcom-seabass-/ && $2 ~ /-mq-game-sts-0$/ { print $1 }' \
      | sort -u)
    if [[ ${#namespace_candidates[@]} -ne 1 ]]; then
      echo "expected exactly one funcom-seabass namespace with Game RMQ pod; found ${#namespace_candidates[@]}" >&2
      printf '  %s\n' "${namespace_candidates[@]}" >&2
      return 1
    fi
    namespace="${namespace_candidates[0]}"
  fi

  if [[ -z "$mq_pod" ]]; then
    mq_pod=$("${kubectl_cmd[@]}" get pods -n "$namespace" --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null \
      | awk '/-mq-game-sts-0$/ { print; exit }')
    if [[ -z "$mq_pod" ]]; then
      echo "could not auto-detect Game RMQ pod in namespace: $namespace" >&2
      return 1
    fi
  fi

  DUNE_NAMESPACE="$namespace"
  DUNE_MQ_POD="$mq_pod"
}

dune_load_command_auth_token() {
  local token="${DUNE_COMMAND_AUTH_TOKEN:-}"
  local token_file="${DUNE_COMMAND_AUTH_TOKEN_FILE:-/home/dune/.dune/state/command-auth-token}"

  if [[ -z "$token" && -f "$token_file" ]]; then
    token="$(tr -d '\r\n' < "$token_file")"
  fi

  if [[ -z "$token" ]]; then
    echo "missing Dune command auth token; set DUNE_COMMAND_AUTH_TOKEN or create $token_file" >&2
    return 1
  fi

  DUNE_COMMAND_AUTH_TOKEN_VALUE="$token"
}

