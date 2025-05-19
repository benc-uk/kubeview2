package services

import (
	"context"
	"log"
	"os"
	"path/filepath"

	appsV1 "k8s.io/api/apps/v1"
	coreV1 "k8s.io/api/core/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Kubernetes struct {
	clientset *kubernetes.Clientset
}

func NewKubernetes() (*Kubernetes, error) {
	var kubeConfig *rest.Config

	var err error

	// In cluster connect using in-cluster "magic", else build config from .kube/config file
	if inCluster() {
		log.Println("🛠️ Running in Kubernetes, will try to use cluster config")

		kubeConfig, err = rest.InClusterConfig()
	} else {
		var kubeconfigFile = filepath.Join(os.Getenv("HOME"), ".kube", "config")

		log.Println("🏠 Running on some computer, will use config:", kubeconfigFile)
		kubeConfig, err = clientcmd.BuildConfigFromFlags("", kubeconfigFile)
	}

	if err != nil {
		log.Println("💥 Failed to create client:", err)
		return nil, err
	}

	log.Println("🔌 Connected to Kubernetes:", kubeConfig.Host)

	// Create the clientset, which is our main interface to the Kubernetes API
	clientset, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}

	return &Kubernetes{
		clientset: clientset,
	}, nil
}

// Get namespaces
func (k *Kubernetes) GetNamespaces() ([]string, error) {
	namespaces := []string{}

	// Use the clientset to get the list of namespaces
	nsList, err := k.clientset.CoreV1().Namespaces().List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed to get namespaces:", err)
		return nil, err
	}

	for _, ns := range nsList.Items {
		namespaces = append(namespaces, ns.Name)
	}

	return namespaces, nil
}

// Get pods
func (k *Kubernetes) GetPods(namespace string) ([]coreV1.Pod, error) {
	if namespace == "" {
		log.Println("💥 No namespace provided")
		return nil, nil
	}

	// Use the clientset to get the list of pods in the specified namespace
	podList, err := k.clientset.CoreV1().Pods(namespace).List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed to get pods:", err)
		return nil, err
	}

	return podList.Items, nil
}

// Get services
func (k *Kubernetes) GetServices(namespace string) ([]coreV1.Service, error) {
	if namespace == "" {
		log.Println("💥 No namespace provided")
		return nil, nil
	}

	// Use the clientset to get the list of services in the specified namespace
	serviceList, err := k.clientset.CoreV1().Services(namespace).List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed to get services:", err)
		return nil, err
	}

	return serviceList.Items, nil
}

// Get deployments
func (k *Kubernetes) GetDeployments(namespace string) ([]appsV1.Deployment, error) {
	if namespace == "" {
		log.Println("💥 No namespace provided")
		return nil, nil
	}

	// Use the clientset to get the list of deployments in the specified namespace
	deploymentList, err := k.clientset.AppsV1().Deployments(namespace).List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed to get deployments:", err)
		return nil, err
	}

	return deploymentList.Items, nil
}

func inCluster() bool {
	// Check if the application is running inside a Kubernetes cluster
	// This is a simple check and may not be foolproof
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return true
	}

	return false
}
