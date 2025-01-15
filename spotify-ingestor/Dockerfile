# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=20.10.0

FROM --platform=amd64 node:${NODE_VERSION}-alpine

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
WORKDIR /usr/src/app

# Copy the rest of the source files into the image.
COPY . .


RUN npm ci

# Now, add the npm run build step here to compile TypeScript to JavaScript
RUN npm run build

# Run the application as a non-root user.
USER 5000

# Specify the command to run the application adding the docker tag as an environment variable
CMD ["node", "dist/index.js"]