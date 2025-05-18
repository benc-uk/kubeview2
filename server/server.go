package main

import (
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

	// App routes
	r.Get("/", s.index)
	r.Get("/namespaces", s.fragNamespace)
	r.Get("/pods", s.fragPods)

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

func (s *server) fragPods(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")

	podList, err := s.kubeService.GetPods(ns)
	if err != nil {
		s.return500(w)
		return
	}

	err = components.ListPods(podList).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
