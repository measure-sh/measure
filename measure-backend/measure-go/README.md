# Measure Golang Server

Rest of the README would be written soon. Stay tuned.

## Notable points

1. All code will be under `package main` until we figure out best package organization based on responsibility
2. All environment variables _MUST_ have a sensible default value targetted towards local setup
3. Contributors are expected to copy `.env.example` to `.env` file and modify values as needed for production

## Local Development Setup

1. Clone this repository

```sh
git clone git@github.com:measure-sh/measure.git
```

2. Navigate to `measure-backend/measure-go` directory

```sh
cd measure-backend/measure-go
```

3. Copy the `.env.example` file

```sh
cp .env.example .env
```

Modify the values of the environment variables.

4. Source the `.env` file

```sh
source .env
```

5. Start the server

```sh
go run .
```

Server will listen at `http://localhost:8080`