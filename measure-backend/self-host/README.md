# Self Hosting Guide

Measure is designed from the ground up for easy self-hosting. Follow along to know how to run Measure on your own infrastructure.

## Using Docker

Measure can run on Linux, macOS and Windows.

> ### Requirements
>
> Make sure you have [Docker](https://docker.com/) running on your machine. You can follow the official instructions on [docker.com](https://docs.docker.com/get-docker/.) to know how to install and run docker.

#### 1. Clone the repository

    git clone git@github.com:measure-sh/measure.git

#### 2. Navigate to `measure-backend/self-host`

    cd measure-backend/self-host

#### 3. Launch Measure using docker compose

    docker compose up

Give a few minutes for the docker containers to become ready. You should see logs similar to these.

```sh
_some log lines shall appear here_
_some log lines shall appear here_
_some log lines shall appear here_
_some log lines shall appear here_
_some log lines shall appear here_
_some log lines shall appear here_
```

#### 4. Open dashboard

Navigate to [http://localhost:9999](http://localhost:9999) to visit the dashboard.

To shutdown the containers, run.

```sh
docker compose down
```

Any events or logs will be persisted the next time you run `docker compose up` again.