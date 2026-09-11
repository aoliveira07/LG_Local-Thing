FROM node:20-alpine

RUN apk add --no-cache git openssl jq bash

# Smart House frozen ReThink build.
# Upstream is intentionally pinned to the exact commit homologated
# for local LG ThinQ operation.
ARG RETHINK_COMMIT=8f6d19ec9939f5f785bb1def3810540730e31bce

RUN git clone https://github.com/anszom/rethink /app && \
    cd /app && \
    git checkout --detach "${RETHINK_COMMIT}" && \
    test "$(git rev-parse HEAD)" = "${RETHINK_COMMIT}"

# Smart House local customizations.
# These files were validated independently and inside node:20-alpine.
COPY overrides/cloud/homeassistant.ts /app/cloud/homeassistant.ts
COPY overrides/management/index.ts /app/management/index.ts
COPY overrides/html/panel.js /app/html/panel.js
COPY overrides/util/friendly-names.ts /app/util/friendly-names.ts

RUN cd /app && \
    npm ci && \
    npm run build

COPY run.sh /run.sh

RUN chmod +x /run.sh

ENTRYPOINT ["/run.sh"]
