package types

import (
	appsV1 "k8s.io/api/apps/v1"
	coreV1 "k8s.io/api/core/v1"
)

type NamespaceData struct {
	Pods        []coreV1.Pod        `json:"pods"`
	Services    []coreV1.Service    `json:"services"`
	Deployments []appsV1.Deployment `json:"deployments"`
}
