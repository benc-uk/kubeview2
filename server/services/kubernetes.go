package services

type Kubernetes struct {
}

func NewKubernetes() *Kubernetes {
	return &Kubernetes{}
}

func (k *Kubernetes) GetNamespaces() ([]string, error) {
	// Simulate fetching namespaces from a Kubernetes cluster
	namespaces := []string{"default", "kube-system", "kube-public"}
	return namespaces, nil
}
