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
# Version 1.1.0 adds UI and room management to the original 1.0.0 base.
COPY overrides/cloud/ /app/cloud/
COPY overrides/management/index.ts /app/management/index.ts
COPY overrides/html/ /app/html/
COPY overrides/util/friendly-names.ts /app/util/friendly-names.ts
COPY overrides/util/ha-areas.ts /app/util/ha-areas.ts

RUN cd /app && \
    npm ci && \
    npm run build

COPY run.sh /run.sh

RUN chmod +x /run.sh

ENTRYPOINT ["/run.sh"]
