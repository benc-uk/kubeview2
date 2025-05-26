package services

import (
	"context"
	"errors"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/benc-uk/kubeview2/server/types"

	"github.com/benc-uk/go-rest-api/pkg/sse"
	coreV1 "k8s.io/api/core/v1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/tools/clientcmd"
)

type Kubernetes struct {
	client      *dynamic.DynamicClient
	ClusterHost string
}

func NewKubernetes(sseBroker *sse.Broker[types.KubeEvent], conf types.Config) (*Kubernetes, error) {
	var kubeConfig *rest.Config

	var err error

	// In cluster connect using in-cluster "magic", else build config from .kube/config file
	if inCluster() {
		log.Println("🛠️ Running in cluster, will try to use cluster config")

		kubeConfig, err = rest.InClusterConfig()
	} else {
		kubeconfigFile := filepath.Join(os.Getenv("HOME"), ".kube", "config")
		if os.Getenv("KUBECONFIG") != "" {
			kubeconfigFile = os.Getenv("KUBECONFIG")
		}

		log.Println("🏠 Running outside cluster, will use config file:", kubeconfigFile)
		kubeConfig, err = clientcmd.BuildConfigFromFlags("", kubeconfigFile)
	}

	if err != nil {
		log.Println("💥 Failed to create client:", err)
		return nil, err
	}

	log.Println("🌐 Kubernetes host:", kubeConfig.Host)

	// Use the dynamic client to interact with the Kubernetes API
	// This allows us to work with any resource type without needing to know the schema in advance
	dynamicClient, err := dynamic.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}

	// Check connection to the cluster
	_, err = dynamicClient.Resource(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}).
		List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed retrieve data from Kubernetes API:", err)
		return nil, err
	} else {
		log.Println("✅ Validated connection to Kubernetes API")
	}

	log.Println("👀 Setting up resource watchers...")

	namespace := coreV1.NamespaceAll // Watch all namespaces
	if conf.SingleNamespace != "" {
		namespace = conf.SingleNamespace
		log.Println("👀 Watching single namespace:", namespace)
	}

	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(
		dynamicClient, time.Minute, namespace, nil)

	// Add listening event handlers for ALL resources we want to track
	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "endpoints"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "replicasets"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "statefulsets"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	_, _ = factory.ForResource(schema.GroupVersionResource{Group: "networking.k8s.io",
		Version: "v1", Resource: "ingresses"}).
		Informer().
		AddEventHandler(getHandlerFuncs(sseBroker))

	factory.Start(context.Background().Done())
	factory.WaitForCacheSync(context.Background().Done())

	return &Kubernetes{
		client:      dynamicClient,
		ClusterHost: kubeConfig.Host,
	}, nil
}

// Get namespaces
func (k *Kubernetes) GetNamespaces() ([]string, error) {
	out := []string{}

	// Use the dynamicClient to get the list of namespaces
	gvr := schema.GroupVersionResource{Group: "", Version: "v1", Resource: "namespaces"}

	l, err := k.client.Resource(gvr).List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Println("💥 Failed to get namespaces:", err)
		return nil, err
	}

	// Iterate over the namespaces and add them to the list
	for _, ns := range l.Items {
		out = append(out, ns.GetName())
	}

	return out, nil
}

func (k *Kubernetes) FetchNamespace(ns string) (map[string][]unstructured.Unstructured, error) {
	if ns == "" {
		return nil, errors.New("namespace is empty")
	}

	podList, _ := k.getResources(ns, "", "v1", "pods")
	serviceList, _ := k.getResources(ns, "", "v1", "services")
	endpointList, _ := k.getResources(ns, "", "v1", "endpoints")
	deploymentList, _ := k.getResources(ns, "apps", "v1", "deployments")
	replicaSetList, _ := k.getResources(ns, "apps", "v1", "replicasets")
	statefulSetList, _ := k.getResources(ns, "apps", "v1", "statefulsets")
	daemonSetList, _ := k.getResources(ns, "apps", "v1", "daemonsets")
	jobList, _ := k.getResources(ns, "batch", "v1", "jobs")
	cronJobList, _ := k.getResources(ns, "batch", "v1", "cronjobs")
	ingressList, _ := k.getResources(ns, "networking.k8s.io", "v1", "ingresses")
	confMapList, _ := k.getResources(ns, "", "v1", "configmaps")
	secretList, _ := k.getResources(ns, "", "v1", "secrets")
	pvcList, _ := k.getResources(ns, "", "v1", "persistentvolumeclaims")

	data := make(map[string][]unstructured.Unstructured)
	data["pods"] = podList
	data["endpoints"] = endpointList
	data["services"] = serviceList
	data["deployments"] = deploymentList
	data["replicasets"] = replicaSetList
	data["statefulsets"] = statefulSetList
	data["daemonsets"] = daemonSetList
	data["jobs"] = jobList
	data["cronjobs"] = cronJobList
	data["ingresses"] = ingressList
	data["configmaps"] = confMapList
	data["secrets"] = secretList
	data["persistentvolumeclaims"] = pvcList

	// Clean up the managed fields and redact sensitive data
	for _, items := range data {
		for i := range items {
			// Managed fields are simply clutter
			items[i].SetManagedFields(nil)

			// Loop through the data field of Secrets & ConfigMaps and redact it
			if items[i].GetKind() == "Secret" || items[i].GetKind() == "ConfigMap" {
				if data, ok := items[i].Object["data"].(map[string]interface{}); ok {
					for k := range data {
						data[k] = "*REDACTED*"
					}
				}
			}
		}
	}

	return data, nil
}

// Generic function to list resources from a specific namespace
func (k *Kubernetes) getResources(ns string, grp string, ver string, res string) ([]unstructured.Unstructured, error) {
	gvr := schema.GroupVersionResource{Group: grp, Version: ver, Resource: res}

	l, err := k.client.Resource(gvr).Namespace(ns).List(context.TODO(), metaV1.ListOptions{})
	if err != nil {
		log.Printf("💥 Failed to get %s %v", res, err)
		return nil, err
	}

	return l.Items, nil
}

func inCluster() bool {
	// Check if the application is running inside a Kubernetes cluster
	// This is a simple check and may not be foolproof
	if os.Getenv("KUBERNETES_SERVICE_HOST") != "" {
		return true
	}

	return false
}

func getHandlerFuncs(b *sse.Broker[types.KubeEvent]) cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			u := obj.(*unstructured.Unstructured)
			u.SetManagedFields(nil)
			b.SendToAll(types.KubeEvent{
				EventType: "add",
				Object:    u,
			})
		},

		UpdateFunc: func(oldObj, newObj interface{}) {
			u := newObj.(*unstructured.Unstructured)
			u.SetManagedFields(nil)
			b.SendToAll(types.KubeEvent{
				EventType: "update",
				Object:    u,
			})
		},

		DeleteFunc: func(obj interface{}) {
			u := obj.(*unstructured.Unstructured)
			u.SetManagedFields(nil)
			b.SendToAll(types.KubeEvent{
				EventType: "delete",
				Object:    u,
			})
		},
	}
}
