# Course site image: the front-end assets are built from src/ with Node, and the static site is
# served by an unprivileged nginx. Base images are pinned by digest; update them deliberately
# (tag and digest together), e.g. with Dependabot or Renovate.
ARG NODE_IMAGE=node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
# The -slim variant: nginx without the optional modules and curl, which a static site does not need.
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6

FROM ${NODE_IMAGE} AS build
WORKDIR /build

# Dependencies first, so editing pages or sources does not reinstall them. `npm ci` installs
# exactly what package-lock.json pins (with integrity hashes); .npmrc disables install scripts.
# Behind a TLS-intercepting proxy, pass its CA: docker build --secret id=ca_bundle,src=ca.pem .
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=ca_bundle,required=false \
    if [ -s /run/secrets/ca_bundle ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_bundle; fi; \
    npm ci --no-audit --no-fund

# The build context is limited by .dockerignore to the published site and the asset sources.
COPY . .
RUN npm run build \
    && mkdir /site \
    && cp -R index.html LICENSE week* img files fonts javascripts stylesheets /site/

FROM ${NGINX_IMAGE} AS site
COPY docker/nginx.conf /etc/nginx/nginx.conf
# Content stays owned by root: the nginx user (101) can read it but not modify it.
COPY --from=build /site/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
# nginx runs directly as PID 1; the upstream entrypoint scripts only rewrite configuration,
# which this image neither needs nor allows (read-only root filesystem).
ENTRYPOINT ["nginx", "-g", "daemon off;"]
