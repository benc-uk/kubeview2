//@ts-check

// ==========================================================================================
// Main JavaScript entry point for KubeView
// Handles the main cytoscape graph and data load from the server
// Provides functions to add, update, and remove resources from the graph
// ==========================================================================================
import cytoscape from '../ext/cytoscape.esm.min.mjs'
import Alpine from '../ext/alpinejs.esm.min.js'

import { getConfig, saveConfig } from './config.js'
import { initEventStreaming } from './events.js'
import { styleSheet } from './styles.js'
import { addResource, processLinks, layout, coseLayout } from './graph.js'
import { showToast } from '../ext/toast.js'

// A shared global map of resources by their UID
export const resMap = {}

// This is why we are here, Cytoscape will be used to render all the data
export const cy = cytoscape({
  container: document.getElementById('mainView'),
  // boxSelectionEnabled: false,
  style: styleSheet,
})

// Exported variable holding the current namespace
export let currentNamespace = ''

window.addEventListener('resize', function () {
  cy.resize()
  cy.fit(null, 10)
})

// Alpine.js component for the main application
Alpine.data('mainApp', () => ({
  labelsShown: false,
  panelOpen: false,
  panelData: {
    kind: 'default',
    icon: 'default',
    props: {},
    containers: {},
    labels: {},
  },
  errorMessage: '',

  htmxError(event) {
    if (!event) this.errorMessage = ''

    const info = event.detail.errorInfo
    this.errorMessage = `${info.error}, METHOD: ${info.requestConfig.verb}, PATH:${info.pathInfo.finalRequestPath}`
  },

  toolbarCoseLayout: coseLayout,

  toolbarFit() {
    cy.resize()
    cy.fit(null, 10)
  },

  // Hook into the cytoscape instance for various events
  init() {
    cy.on('tap', 'node', (evt) => {
      const node = evt.target
      if (node.data('resource')) {
        const newPanelData = getPanelData(node.id())
        if (!newPanelData) {
          this.panelOpen = false
          return
        }
        this.panelOpen = true
        this.panelData = newPanelData
      }
    })

    // hide the info panel when clicking outside of a node
    cy.on('tap', (evt) => {
      if (evt.target === cy) this.panelOpen = false
    })

    // Handle node removal events
    cy.on('remove', 'node', (evt) => {
      if (evt.target.id() === this.panelData.id) {
        this.$nextTick(() => {
          this.panelOpen = false
        })
      }
    })

    // Handle data updates for nodes
    cy.on('data', 'node', (evt) => {
      const node = evt.target
      if (this.panelData && node.id() === this.panelData.id) {
        this.$nextTick(() => {
          const newData = getPanelData(node.id())
          if (!newData) {
            this.panelOpen = false
            return
          }
          this.panelData = newData
        })
      }
    })

    cy.on('layoutstop', () => {
      if (cy.nodes().length === 0) {
        showToast('No resources found in this namespace<br>Check your filter settings', 3000, 'top-center')
      }
    })
  },
}))

// Component for the configuration panel
Alpine.data('configComponent', () => ({
  cfg: getConfig(),
  tab: 1,
  namespace: currentNamespace,

  save() {
    saveConfig(this.cfg)
  },
}))

// Initialize & start Alpine.js
Alpine.start()

// Set up the event streaming for live updates once the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  initEventStreaming()
})

/**
 * Global function to load the namespace data
 * This function is called from the server side template when the namespace is loaded
 */
globalThis.namespaceLoaded = function (ns, data) {
  console.log(`📚 Data for namespace '${ns}' received`)

  currentNamespace = ns
  window.history.replaceState({}, '', `?ns=${ns}`)
  cy.elements().remove()

  if (getConfig().debug) {
    console.log('🐞 DEBUG! Received data:')
    console.dir(data)
  }

  let resCount = 0
  // Pass 1 - Add ALL the resources to the graph
  for (const kindKey in data) {
    const resources = data[kindKey]
    for (const res of resources || []) {
      if (addResource(res)) resCount++
    }
  }

  // Pass 2 - Add links between using metadata.ownerReferences
  for (const kindKey in data) {
    const resources = data[kindKey]
    for (const res of resources || []) {
      processLinks(res)
    }
  }

  if (resCount === 0) {
    console.warn('⚠️ No resources found in this namespace')
  }

  layout()
}

/**
 * For a given resource ID, this function retrieves the data to be shown in the info panel
 * This has customized logic to present the data in a user-friendly way
 * @param {string} id - The ID of the resource to show
 * @return {PanelData | undefined} The data to be shown in the info panel, or undefined if the resource is not found
 */
function getPanelData(id) {
  // Find the resource in the resMap
  const res = resMap[id]
  if (!res) return

  const props = {
    name: res.metadata.name,
    created: res.metadata.creationTimestamp,
  }

  if (res.spec?.nodeName) props.nodeName = res.spec.nodeName
  if (res.spec?.replicas) props.replicas = res.spec.replicas
  if (res.spec?.type) props.type = res.spec.type
  if (res.spec?.clusterIP) props.clusterIP = res.spec.clusterIP
  if (res.spec?.ports) {
    props.ports = res.spec.ports
      .map((port) => {
        return `${port.name} ${port.port}${port.protocol ? `/${port.protocol}` : ''}`
      })
      .join(', ')
  }
  if (res.spec?.ipFamilies) props.ipVersions = res.spec.ipFamilies.join(', ')
  if (res.spec?.serviceAccount) props.serviceAccount = res.spec.serviceAccount
  if (res.spec?.ingressClassName) props.ingressClass = res.spec.ingressClassName
  if (res.spec?.rules) {
    props.hosts = res.spec.rules
      .map((rule) => {
        return rule.host ? rule.host : '<no host>'
      })
      .join(', ')
  }

  if (res.status?.podIP) props.podIP = res.status.podIP
  if (res.status?.hostIP) props.hostIP = res.status.hostIP
  if (res.status?.phase) props.phase = res.status.phase
  if (res.status?.readyReplicas) props.replicasReady = res.status.readyReplicas
  if (res.status?.availableReplicas) props.replicasAvailable = res.status.availableReplicas
  if (res.status?.conditions) {
    for (const cond of res.status.conditions || []) {
      if (cond.type === 'Ready') {
        props.ready = cond.status === 'True' ? 'Yes' : 'No'
      }
      if (cond.type === 'PodScheduled') {
        props.scheduled = cond.status === 'True' ? 'Yes' : 'No'
      }
      if (cond.type === 'Initialized') {
        props.initialized = cond.status === 'True' ? 'Yes' : 'No'
      }
    }
  }
  if (res.status?.loadBalancer) {
    if (res.status.loadBalancer.ingress) {
      props.loadBalancer = res.status.loadBalancer.ingress.map((ingress) => ingress.ip || ingress.hostname).join(', ')
    }
  }

  // ConfigMap and Secret data
  if (res.data) {
    // just list the keys of the data object
    props.data = Object.keys(res.data).join(',\n')
  }

  // Labels
  /** @type {Record<string, string>} */
  const labels = {}
  if (res.metadata?.labels) {
    for (const [key, value] of Object.entries(res.metadata.labels)) {
      labels[key] = value
    }
  }

  /** @type {Record<string, any>} */
  const containers = {}
  if (res.status?.containerStatuses) {
    for (const c of res.status.containerStatuses) {
      containers[c.name] = {
        image: c.image,
        ready: c.ready ? 'Yes' : 'No',
        restarts: c.restartCount,
        started: c.started ? 'Yes' : 'No',
        state: Object.keys(c.state).map((key) => {
          return `${key}: ${c.state[key].reason || ''}`
        }),
      }
    }
  }

  return {
    kind: res.kind,
    id: res.metadata.uid,
    icon: res.kind.toLowerCase(),
    props,
    containers,
    labels,
  }
}
