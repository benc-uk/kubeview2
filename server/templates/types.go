package templates

import "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

type NamespaceData map[string][]unstructured.Unstructured
