# setup stage
# FROM alpine as setup
# RUN apk update && apk add --update --no-cache ca-certificates && rm -rf /var/cache/apk/*
# ARG CMDLINETOOLS_DL_URL=https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip
# ENV CMDLINETOOLS_DL_URL=$CMDLINETOOLS_DL_URL
# RUN wget -q -O /tmp/cmdline-tools.zip ${CMDLINETOOLS_DL_URL}
# RUN mkdir /sdk
# RUN unzip -q /tmp/cmdline-tools.zip -d /sdk && rm -rf /tmp/cmdline-tools.zip

#build stage
FROM golang:alpine AS builder
RUN apk add --no-cache git ca-certificates && rm -rf /var/cache/apk/*
ARG CMDLINETOOLS_DL_URL=https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip
ENV CMDLINETOOLS_DL_URL=$CMDLINETOOLS_DL_URL
RUN wget -q -O /tmp/cmdline-tools.zip ${CMDLINETOOLS_DL_URL}
RUN mkdir /sdk && unzip -q /tmp/cmdline-tools.zip -d /sdk && rm -rf /tmp/cmdline-tools.zip
WORKDIR /go/src/app
COPY go.mod go.sum ./
RUN go get -d -v ./...
COPY . .
# RUN go build -o /go/bin/app -v ./...
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /go/bin/app -v ./...

# final stage
FROM alpine
RUN apk update && apk add --update --no-cache openjdk17 ca-certificates && rm -rf /var/cache/apk/*
COPY --from=builder /sdk/* /sdk/cmdline-tools
COPY --from=builder /go/bin/app /app
ENV PATH="${PATH}:/sdk/cmdline-tools/bin"
ENTRYPOINT /app
LABEL Name=symbolicator Version=0.0.1
EXPOSE 8181