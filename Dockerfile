FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      coreutils \
      curl \
      jq \
      libc6:i386 \
      libgcc-s1:i386 \
      libstdc++6:i386 \
      python3 \
      sudo \
      tzdata \
      util-linux && \
    rm -rf /var/lib/apt/lists/*

RUN install -d -m 0755 /opt/steamcmd && \
    curl -fsSL https://media.steampowered.com/installer/steamcmd_linux.tar.gz \
      | tar -xz -C /opt/steamcmd && \
    ln -s /opt/steamcmd/steamcmd.sh /usr/local/bin/steamcmd && \
    chmod 0755 /opt/steamcmd/steamcmd.sh

# k3s static binary is bind-mounted from the host at runtime.
# Pre-create symlinks so kubectl/ctr/crictl resolve to it.
RUN ln -s k3s /usr/local/bin/kubectl && \
    ln -s k3s /usr/local/bin/ctr && \
    ln -s k3s /usr/local/bin/crictl

RUN userdel -r node 2>/dev/null || true && \
    groupdel node 2>/dev/null || true && \
    groupadd -g 1000 dune && \
    useradd -m -u 1000 -g 1000 -s /bin/bash dune && \
    install -d -m 0755 -o dune -g dune /home/dune/.dune /home/dune/.dune/state \
                       /home/dune/.dune/bin /home/dune/.dune/download && \
    echo 'dune ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/dune && \
    chmod 0440 /etc/sudoers.d/dune

WORKDIR /opt/server-management-service

COPY --chown=dune:dune package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=dune:dune dist/ ./dist/
COPY --chown=dune:dune scripts/ ./scripts/

ENV DUNE_BIN_DIR=/home/dune/.dune/bin \
    DUNE_SERVICE_DB_PATH=/home/dune/.dune/state/server-management-service.sqlite \
    DUNE_COMMAND_AUTH_TOKEN_FILE=/home/dune/.dune/state/command-auth-token \
    DUNE_DASHBOARD_HOST=127.0.0.1 \
    DUNE_DASHBOARD_PORT=8787 \
    DUNE_STEAMCMD=/usr/local/bin/steamcmd \
    PATH=/home/dune/.dune/bin:/usr/local/bin:/usr/bin:/bin:/sbin

USER dune:dune

CMD ["node", "dist/index.js", "--run"]
