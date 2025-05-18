-include dev/.env
export

REPO_ROOT := $(shell git rev-parse --show-toplevel)
SHELL := /bin/bash

.EXPORT_ALL_VARIABLES:
.PHONY: help lint run clean
.DEFAULT_GOAL := help

help: ## 💬 This help message :)
	@figlet $@ || true
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: ## 🔍 Lint & format check only, sets exit code on error for CI
	@figlet $@ || true
	go tool -modfile=dev/tools.mod golangci-lint run -c dev/golangci.yaml

lint-fix: ## ✨ Lint & try to format & fix
	@figlet $@ || true
	go tool -modfile=dev/tools.mod golangci-lint run -c dev/golangci.yaml --fix

run: ## 🏃 Run application, used for local development
	@figlet $@ || true
	@go tool -modfile=dev/tools.mod air -c dev/air.toml

build: ## 🏗️ Build application binary
	@figlet $@ || true
	go build -o bin/server ./server
	
clean: ## 🧹 Clean up and reset
	@figlet $@ || true
	@rm -rf tmp bin
