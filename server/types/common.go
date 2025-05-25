package types

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type NamespaceData map[string][]unstructured.Unstructured

type KubeEvent struct {
	EventType string
	Object    *unstructured.Unstructured
}

type Config struct {
	Port            int
	NameSpaceFilter string
	SingleNamespace string
}
