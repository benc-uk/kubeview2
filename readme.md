# KubeView 2

KubeView 2 is a Kubernetes cluster visualization tool that provides a graphical representation of your cluster's resources and their relationships. It helps you understand the structure and dependencies of your Kubernetes resources, making it easier to manage and troubleshoot your cluster. It is a complete rewrite of the original KubeView project, which I mainly wrote on a train to Norwich in 2019.

See the [original KubeView project](https://github.com/benc-uk/kubeview) for more information.

## Goals

The goal of this rewrite is to create a more maintainable codebase. Some choices that have been made to achieve this goal are:

- Removal of any sort of JS framework, no Vue.js, React etc. And no bundling required.
- Switch to [HTMX](https://htmx.org/), putting the majority of the logic in the backend.
- Use of [templ library](https://templ.guide/) for templating and server side rendering.
- Switch to [Bulma](https://bulma.io/) for CSS

## Features

- Unfinished
- Incomplete
