package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/benc-uk/go-rest-api/pkg/sse"
	"github.com/benc-uk/kubeview2/server/services"
	"github.com/benc-uk/kubeview2/server/templates"
	"github.com/benc-uk/kubeview2/server/types"
	"github.com/go-chi/chi/v5"
)

type server struct {
	healthy     bool
	kubeService *services.Kubernetes
	config      types.Config
	version     string
}

func NewServer(r *chi.Mux, conf types.Config, ver string) *server {
	sseBroker := sse.NewBroker[types.KubeEvent]()

	sseBroker.MessageAdapter = func(ke types.KubeEvent, clientID string) sse.SSE {
		json, err := json.Marshal(ke.Object)
		if err != nil {
			log.Printf("💩 Error marshalling object: %v", err)

			return sse.SSE{
				Data:  "Error marshalling object",
				Event: "error",
			}
		}

		return sse.SSE{
			Data:  string(json),
			Event: ke.EventType,
		}
	}

	// Start a heartbeat to keep the connection alive, sent to all clients
	go func() {
		for {
			sseBroker.SendToAll(types.KubeEvent{
				EventType: "ping",
				Object:    nil,
			})
			time.Sleep(10 * time.Second)
		}
	}()

	ks, err := services.NewKubernetes(sseBroker)
	if err != nil {
		log.Fatalf("💩 Unable to connect to Kubernetes. The KubeView will exit")
	}

	s := &server{
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
	r.Get("/", s.index)                        // Serve the index page
	r.Get("/namespaces", s.fetchNamespaceList) // Return a list of namespaces
	r.Get("/load", s.loadNamespace)            // Load resources in a namespace and return the data
	r.Get("/showConfig", s.showConfig)         // Load resources in a namespace and return the data
	r.Get("/empty", s.empty)                   // Empty response for removing elements on the page

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
			log.Fatalln("💩 Error streaming SSE:", err)
			return
		}
	})

	return s
}

func (s *server) index(w http.ResponseWriter, r *http.Request) {
	err := templates.Index().Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) showConfig(w http.ResponseWriter, r *http.Request) {
	err := templates.ConfigDialog(s.kubeService.ClusterHost, s.version).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) fetchNamespaceList(w http.ResponseWriter, r *http.Request) {
	nsList, err := s.kubeService.GetNamespaces()
	if err != nil {
		s.return500(w)

		return
	}

	err = templates.NamespacePicker(nsList).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) loadNamespace(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")

	data, err := s.kubeService.FetchNamespace(ns)
	if err != nil {
		log.Printf("💩 Error fetching namespace: %v", err)
		s.return500(w)

		return
	}

	// Check every key in the data map and see if it has any items
	totalItems := 0
	for _, v := range data {
		totalItems += len(v)
	}

	if totalItems == 0 {
		_ = templates.NoData(ns).Render(r.Context(), w)
		return
	}

	err = templates.PassNamespaceData(ns, data).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) empty(w http.ResponseWriter, r *http.Request) {
	// This is a special route for removing dialogs
	// It returns an empty response to remove the dialog
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(""))
}

func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
