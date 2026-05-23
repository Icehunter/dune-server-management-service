#!/usr/bin/env bash
set -euo pipefail

# Build the image locally, ship it to the Alpine host's k3s containerd, and apply
# the manifests in k8s/. Intended for a one-host k3s deployment without a
# remote registry.
#
# Usage:
#   k8s/build-and-deploy.sh <ssh-target>
#
# Example:
#   k8s/build-and-deploy.sh dune@192.168.0.72
#
# Optional environment overrides:
#   IMAGE       — image reference (default: dune-server-management-service:local)
#   SSH_KEY     — path to ssh key (default: ../dune-admin/sshKey)
#   PLATFORM    — docker build platform (default: linux/amd64)

SSH_TARGET="${1:?ssh target required, e.g. dune@192.168.0.72}"
SSH_KEY="${SSH_KEY:-../dune-admin/sshKey}"
IMAGE="${IMAGE:-dune-server-management-service:local}"
PLATFORM="${PLATFORM:-linux/amd64}"

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

echo "==> Building dist/"
npm install --no-audit --no-fund --silent
npm run build --silent

echo "==> Building image ${IMAGE}"
docker build --platform "${PLATFORM}" -t "${IMAGE}" .

tar_file="$(mktemp -t dune-sms-image.XXXXXX.tar)"
trap 'rm -f "$tar_file"' EXIT

echo "==> Saving image to ${tar_file}"
docker save "${IMAGE}" -o "${tar_file}"

remote_tar="/tmp/dune-sms-image.tar"
echo "==> Copying image tarball to ${SSH_TARGET}:${remote_tar}"
scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${tar_file}" "${SSH_TARGET}:${remote_tar}"

echo "==> Importing image into k3s containerd (k8s.io namespace)"
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_TARGET}" \
  "sudo /usr/local/bin/k3s ctr -n k8s.io images import ${remote_tar} && rm -f ${remote_tar}"

echo "==> Applying manifests"
for manifest in k8s/00-namespace.yaml k8s/10-serviceaccount.yaml k8s/20-configmap.yaml k8s/30-deployment.yaml; do
  echo "    kubectl apply -f ${manifest}"
  ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_TARGET}" \
    "sudo /usr/local/bin/kubectl apply -f -" < "${manifest}"
done

echo "==> Rolling out"
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_TARGET}" \
  "sudo /usr/local/bin/kubectl -n dune-system rollout restart deployment/server-management-service && \
   sudo /usr/local/bin/kubectl -n dune-system rollout status deployment/server-management-service --timeout=180s"

cat <<'NEXT'
==> Done.

Tail the pod logs:
  ssh dune@<host> 'sudo kubectl -n dune-system logs -f -l app=server-management-service'

Reach the dashboard via SSH tunnel:
  ssh -N -L 8787:127.0.0.1:8787 dune@<host>
  open http://127.0.0.1:8787
NEXT
