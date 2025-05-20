package main

import (
	"os"
	"strconv"

	types "github.com/benc-uk/kubeview2/server/types"
)

func getConfig() types.Config {
	port := 8000
	hideSysNamespaces := true
	singleNamespace := ""

	if portEnv := os.Getenv("PORT"); portEnv != "" {
		if p, err := strconv.Atoi(portEnv); err == nil {
			port = p
		}
	}

	if hideSystemNamespacesEnv := os.Getenv("HIDE_SYSTEM_NAMESPACES"); hideSystemNamespacesEnv != "" {
		if h, err := strconv.ParseBool(hideSystemNamespacesEnv); err == nil {
			hideSysNamespaces = h
		}
	}

	if s := os.Getenv("SINGLE_NAMESPACE"); s != "" {
		singleNamespace = s
	}

	return types.Config{
		Port:                 port,
		HideSystemNamespaces: hideSysNamespaces,
		SingleNamespace:      singleNamespace,
	}
}
