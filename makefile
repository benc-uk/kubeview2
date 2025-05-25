-include .dev/.env
export

REPO_ROOT := $(shell git rev-parse --show-toplevel)
SHELL := /bin/bash
VERSION ?= $(shell git tag -l --sort=-creatordate | head -n 1)

.EXPORT_ALL_VARIABLES:
.PHONY: help lint lint-fix run build generate clean image push check-vars
.DEFAULT_GOAL := help

help: ## 💬 This help message :)
	@figlet $@ || true
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(firstword $(MAKEFILE_LIST)) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

lint: ## 🔍 Lint & format check only, use for CI
	@figlet $@ || true
	cd .dev/; npm install --silent
	npx eslint -c .dev/eslint.config.mjs public/js
	npx prettier --check --config .dev/.prettierrc public/js 
	go tool -modfile=.dev/tools.mod golangci-lint run -c .dev/golangci.yaml

lint-fix: ## ✨ Lint & try to format & fix
	@figlet $@ || true
	cd .dev/; npm install --silent
	npx eslint -c .dev/eslint.config.mjs public/js --fix
	npx prettier --write --config .dev/.prettierrc public/js
	go tool -modfile=.dev/tools.mod golangci-lint run -c .dev/golangci.yaml --fix

run: ## 🏃 Run application, used for local development
	@figlet $@ || true
	@go tool -modfile=.dev/tools.mod air -c .dev/air.toml

build: generate ## 🔨 Build application binary
	@figlet $@ || true
	go build -o bin/server ./server

generate: ## 📑 Compile templ templates
	@figlet $@ || true
	go tool templ generate

clean: ## 🧹 Clean up and reset
	@figlet $@ || true
	@rm -rf tmp bin

image: check-vars ## 📦 Build container image from Dockerfile
	@figlet $@ || true
	docker build --file ./deploy/Dockerfile \
	--build-arg VERSION="$(VERSION)" \
	--tag $(IMAGE_REG)/$(IMAGE_NAME):$(IMAGE_TAG) . 

push: check-vars ## 📤 Push container image to registry
	@figlet $@ || true
	docker push $(IMAGE_REG)/$(IMAGE_NAME):$(IMAGE_TAG)

helm-docs: ## 📜 Update docs & readme for Helm chart
	@figlet $@ || true
	docker run --rm --volume "$(REPO_ROOT)/deploy/helm/kubeview:/helm-docs" -u $(shell id -u) jnorwood/helm-docs:latest

helm-package: helm-docs ## 🔠 Package Helm chart and update index
	@figlet $@ || true
	helm package deploy/helm/kubeview -d deploy/helm
	helm repo index deploy/helm

# ===============================================

check-vars:
	@if [[ -z "${IMAGE_REG}" ]]; then echo "💥 Error! Required variable IMAGE_REG is not set!"; exit 1; fi
	@if [[ -z "${IMAGE_NAME}" ]]; then echo "💥 Error! Required variable IMAGE_NAME is not set!"; exit 1; fi
	@if [[ -z "${IMAGE_TAG}" ]]; then echo "💥 Error! Required variable IMAGE_TAG is not set!"; exit 1; fi
	@if [[ -z "${VERSION}" ]]; then echo "💥 Error! Required variable VERSION is not set!"; exit 1; fi
