package main

import (
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
	sseStreamer *sse.Streamer[string]
}

func NewServer(r *chi.Mux, ks *services.Kubernetes) *server {
	sseStream := sse.NewStreamer[string]()

	// Send the time to the user every 2 second
	go func() {
		for {
			timeNow := time.Now().Format("15:04:05")
			sseStream.Messages <- "Hello it is now " + timeNow
			time.Sleep(3 * time.Second)
		}
	}()

	sseStream.MessageAdapter = func(msg string) sse.SSE {
		return sse.SSE{
			Data:  "ssss" + msg,
			Event: "added",
		}
	}

	r.HandleFunc("/updates", func(w http.ResponseWriter, r *http.Request) {
		sseStream.Stream(w, *r)
	})

	s := &server{
		healthy:     true,
		kubeService: ks,
		sseStreamer: sseStream,
	}

	// Serve the public folder
	r.HandleFunc("/public/*", func(w http.ResponseWriter, r *http.Request) {
		http.StripPrefix("/public/", http.FileServer(http.Dir("public"))).ServeHTTP(w, r)
	})

	// App routes
	r.Get("/", s.index)
	r.Get("/namespaces", s.fragNamespace)
	r.Get("/load", s.loadNamespace)

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

	podList, err := s.kubeService.GetPods(ns)
	if err != nil {
		s.return500(w)
		return
	}

	serviceList, err := s.kubeService.GetServices(ns)
	if err != nil {
		s.return500(w)
		return
	}

	deploymentList, err := s.kubeService.GetDeployments(ns)
	if err != nil {
		s.return500(w)
		return
	}

	data := types.NamespaceData{
		Pods:        podList,
		Services:    serviceList,
		Deployments: deploymentList,
	}

	err = components.NamespaceLoaded(data).Render(r.Context(), w)
	if err != nil {
		s.return500(w)
	}
}

func (s *server) return500(w http.ResponseWriter) {
	w.WriteHeader(http.StatusInternalServerError)
	_, _ = w.Write([]byte("Internal Server Error"))
}
