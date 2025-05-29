// ==========================================================================================
// The server is an abstraction that holds a bunch of stuff into one place.
// It handles the main routes, SSE streaming, and Kubernetes interactions
// ==========================================================================================

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"time"

	"github.com/benc-uk/go-rest-api/pkg/sse"
	"github.com/benc-uk/kubeview2/server/services"
	"github.com/benc-uk/kubeview2/server/templates"
	"github.com/go-chi/chi/v5"
)

// server represents the main application server, and holds every together
type server struct {
	healthy     bool
	kubeService *services.Kubernetes
	config      Config
	version     string
}

// Create a new server instance with the provided router, configuration, and version.
func NewServer(r *chi.Mux, conf Config, ver string) *server {
	// This is the SSE broker that will handle streaming events to connected clients
	sseBroker := sse.NewBroker[services.KubeEvent]()

	sseBroker.MessageAdapter = func(ke services.KubeEvent, clientID string) sse.SSE {
		json, err := json.Marshal(ke.Object)
		if err != nil {
			log.Printf("💥 Error marshalling object: %v", err)

			return sse.SSE{
				Data:  "Error marshalling object",
				Event: "error",
			}
		}

		return sse.SSE{
			Data:  string(json),
			Event: string(ke.EventType),
		}
	}

	// Start a SSE heartbeat to keep the connection alive, sent to all clients
	go func() {
		for {
			sseBroker.SendToAll(services.KubeEvent{
				EventType: services.PingEvent,
				Object:    nil,
			})
			time.Sleep(10 * time.Second)
		}
	}()

	// Create a new Kubernetes service instance, which will connect to the cluster
	ks, err := services.NewKubernetes(sseBroker, conf.SingleNamespace)
	if err != nil {
		log.Fatalf("💥 Error connectinging to Kubernetes, system will exit")
	}

	srv := &server{
		healthy:     true,
		kubeService: ks,
		config:      conf,
		version:     ver,
	}

	// Serve the public folder, which contains static files, JS, CSS, images, etc.
	r.HandleFunc("/public/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/public/", http.FileServer(http.Dir("public"))).ServeHTTP(w, r)
	})

	// App routes
	r.Get("/", srv.index)
	r.Get("/namespaces", srv.fetchNamespaceList)
	r.Get("/fetchData", srv.loadNamespace)
	r.Get("/showConfig", srv.showConfig)
	r.Get("/empty", srv.empty)
	r.Get("/health", srv.healthCheck)

	// Special route for SSE streaming events to connected clients
	r.HandleFunc("/updates", func(w http.ResponseWriter, r *http.Request) {
		clientID := r.URL.Query().Get("clientID")
		if clientID == "" {
			http.Error(w, "clientID is required", http.StatusBadRequest)
			return
		}

		log.Printf("⚡ SSE Client connected: %s", clientID)

		err := sseBroker.Stream(clientID, w, *r)
		if err != nil {
			log.Fatalln("💥 Error in SSE broker stream:", err)
			return
		}
	})

	return srv
}

// HTTP handler for the main app index page
func (s *server) index(w http.ResponseWriter, r *http.Request) {
	// check for ns in the query string, if it exists, we will use it to load the namespace
	ns := r.URL.Query().Get("ns")

	err := templates.Index(ns).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

// HTTP handler to show the configuration dialog
func (s *server) showConfig(w http.ResponseWriter, r *http.Request) {
	err := templates.ConfigDialog(s.kubeService.ClusterHost, s.version).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

// HTTP handler to fetch the list of namespaces from the Kubernetes cluster
func (s *server) fetchNamespaceList(w http.ResponseWriter, r *http.Request) {
	log.Println("🔍 Fetching list of namespaces")

	preSelect := r.URL.Query().Get("namespace")

	var err error

	var nsList []string

	if s.config.SingleNamespace != "" {
		// If SingleNamespace is set, we only return that namespace
		nsList = []string{s.config.SingleNamespace}
	} else {
		nsList, err = s.kubeService.GetNamespaces()
		if err != nil {
			s.return500(w)

			return
		}

		// Remove namespaces that are in the filter, filter is a regex
		if s.config.NameSpaceFilter != "" {
			filteredNamespaces := make([]string, 0, len(nsList))

			for _, ns := range nsList {
				if matched, err := regexp.MatchString(s.config.NameSpaceFilter, ns); !matched && err == nil {
					filteredNamespaces = append(filteredNamespaces, ns)
				}
			}

			nsList = filteredNamespaces
		}
	}

	// Render the namespace picker (HTML <select>) template with the list of namespaces
	err = templates.NamespacePicker(nsList, preSelect).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

// HTTP handler to gather all resources in a namespace and return the data
func (s *server) loadNamespace(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	log.Println("🍵 Fetching resources in", ns)

	if s.config.SingleNamespace != "" && ns != s.config.SingleNamespace {
		log.Printf("🚫 Attempt to load namespace '%s' when only '%s' is allowed", ns, s.config.SingleNamespace)
		http.Error(w, "Forbidden", http.StatusForbidden)

		return
	}

	data, err := s.kubeService.FetchNamespace(ns)
	if err != nil {
		log.Printf("💥 Error fetching namespace: %v", err)
		s.return500(w)

		return
	}

	err = templates.PassNamespaceData(ns, data).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

// HTTP handler for an empty response, used to remove elements on the page
func (s *server) empty(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(""))
}

// HTTP handler for health check endpoint
func (s *server) healthCheck(w http.ResponseWriter, r *http.Request) {
	if s.healthy {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("Service Unavailable"))
	}
}

// return500 is a helper function to return a 500 Internal Server Error response
func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
