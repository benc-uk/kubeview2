package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/benc-uk/go-rest-api/pkg/sse"
	"github.com/benc-uk/kubeview2/server/components"
	"github.com/benc-uk/kubeview2/server/services"
	"github.com/benc-uk/kubeview2/server/types"
	"github.com/go-chi/chi/v5"
)

type server struct {
	healthy     bool
	kubeService *services.Kubernetes
}

func NewServer(r *chi.Mux) *server {
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
		log.Fatalf("💩 Unable to connect to Kubernetes. The app will exit")
	}

	s := &server{
		healthy:     true,
		kubeService: ks,
	}

	// Serve the public folder
	r.HandleFunc("/public/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/public/", http.FileServer(http.Dir("public"))).ServeHTTP(w, r)
	})

	// App routes
	r.Get("/", s.index)
	r.Get("/namespaces", s.fragNamespace)
	r.Get("/load", s.loadNamespace)

	// Special SSE route for streaming events
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
	err := components.Index().Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) fragNamespace(w http.ResponseWriter, r *http.Request) {
	nsList, err := s.kubeService.GetNamespaces()
	if err != nil {
		s.return500(w)

		return
	}

	err = components.SelectNamespace(nsList).Render(r.Context(), w)
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

	err = components.PassNamespaceData(ns, data).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
