package main

import (
	"log"
	"net/http"

	"github.com/benc-uk/kubeview2/server/components"
	"github.com/benc-uk/kubeview2/server/services"
	"github.com/go-chi/chi/v5"
)

type server struct {
	healthy     bool
	kubeService *services.Kubernetes
}

func NewServer(r *chi.Mux, ks *services.Kubernetes) *server {
	s := &server{
		healthy:     true,
		kubeService: ks,
	}

	// Serve the public folder
	r.HandleFunc("/public/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/public/", http.FileServer(http.Dir("public"))).ServeHTTP(w, r)
	})

	r.Get("/", s.handleIndex)
	r.Get("/healthz", s.handleHealth)
	r.Get("/health", s.handleHealth)
	r.Get("/c/namespaces", s.handleNamespaces)

	return s
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if s.healthy {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	} else {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("Service Unavailable"))
	}
}

func (s *server) handleIndex(w http.ResponseWriter, r *http.Request) {
	err := components.Index().Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) handleNamespaces(w http.ResponseWriter, r *http.Request) {
	nsList, err := s.kubeService.GetNamespaces()
	if err != nil {
		log.Println("Error fetching namespaces:", err)
		s.return500(w)
		return
	}

	err = components.SelectNamespace(nsList).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
