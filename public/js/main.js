// ==========================================================================================
// Main JavaScript entry point for KubeView
// Handles the main cytoscape graph and data load from the server
// Provides functions to add, update, and remove resources from the graph
// ==========================================================================================
import cytoscape from '../ext/cytoscape.esm.min.mjs'
import Alpine from '../ext/alpinejs.esm.min.js'

import { getConfig } from './config.js'
import { initEventStreaming } from './events.js'
import { nodeStyle } from './styles.js'
import { addResource, processLinks, layout } from './graph.js'

// These are shared variables used across the application
// `cy` is the Cytoscape instance, `resMap` is a map of resources by their UID
export let cy = null
export const resMap = {}

// Alpine.js stores to hold global state
Alpine.store('res', {
  kind: 'default',
  id: '',
  icon: 'default',
  props: {},
  containers: {},
  labels: {},
})
Alpine.store('open', false)
Alpine.store('namespace', '')

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
  Alpine.store('namespace', ns)
  window.history.replaceState({}, '', `?ns=${ns}`)

  // This is why we are here, Cytoscape will be used to render all the data
  cy = cytoscape({
    container: document.getElementById('mainView'),
    boxSelectionEnabled: false,
  })

  cy.style().selector('node[resource]').style(nodeStyle)
  cy.style()
    .selector('node[resource]')
    .style('background-image', function (ele) {
      return ele.data('statusColour')
        ? `public/img/res/${ele.data('icon')}-${ele.data('statusColour')}.svg`
        : `public/img/res/${ele.data('icon')}.svg`
    })
  cy.style().selector('node:selected').style({
    'border-width': '4',
    'border-color': 'rgb(0, 120, 215)',
  })

  // Add a click handler to show the info panel
  cy.on('tap', 'node', function (evt) {
    const node = evt.target
    if (node.data('resource')) {
      showPanel(node.id())
    }
  })

  // hide the info panel when clicking outside of a node
  cy.on('tap', function (evt) {
    if (evt.target === cy) {
      hidePanel()
    }
  })

  window.addEventListener('resize', function () {
    if (cy) {
      cy.resize()
    }

    layout()
  })

  // Debug only
  if (getConfig().debug) {
    console.log('🐞 DEBUG! Received data:')
    console.dir(data)
  }

  // Pass 1 - Add ALL the resources to the graph
  for (const kindKey in data) {
    const kind = data[kindKey]
    for (const res of kind) {
      addResource(res)
    }
  }

  // Pass 2 - Add links between using metadata.ownerReferences
  for (const kindKey in data) {
    const kind = data[kindKey]
    for (const res of kind) {
      processLinks(res)
    }
  }

  layout()
}

/**
 * When the user changes the namespace, we need to reset the graph
 * This is called by HTMX, which is why it's in the global scope
 */
globalThis.reset = function () {
  console.log('🔄 Resetting namespace')

  Alpine.store('open', false)
  Alpine.store('namespace', '')
  Alpine.store('error', '')

  if (cy !== null) {
    cy.destroy()
    cy = null
  }

  document.getElementById('mainView').innerHTML = ''
}

/**
 * This is called when the page is loaded for the first time
 * It is called from the server side template, hx-on::after-settle
 */
globalThis.firstLoad = function () {
  // This is used when the page is loaded with a namespace in the URL
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('ns')) {
    const urlNamespace = urlParams.get('ns')
    Alpine.store('namespace', urlNamespace)

    if (urlNamespace) {
      const event = new Event('change')
      const select = document.getElementById('namespaceSelect').firstChild
      select.value = urlNamespace
      select.dispatchEvent(event)
    }
  }
}

/**
 * Show an error message in the UI
 * This is used when HTMX encounters an error, which is why it's in the global scope
 */
window.showError = function (event) {
  console.log('💥 Error from HTMX:', event.detail.errorInfo)
  const info = event.detail.errorInfo
  const errorMessage = `${info.error}, METHOD: ${info.requestConfig.verb}, PATH:${info.pathInfo.finalRequestPath}`

  Alpine.store('error', errorMessage)
}

/**
 * Show the side info panel for a resource
 * This will populate the panel with the resource data and show it
 * @param {string} id - The ID of the resource to show
 */
export function showPanel(id) {
  // Find the resource in the resMap
  const res = resMap[id]
  if (!res) return

  const props = {
    name: res.metadata.name,
    created: res.metadata.creationTimestamp,
  }

  if (res.status?.podIP) props.podIP = res.status.podIP
  if (res.status?.hostIP) props.hostIP = res.status.hostIP
  if (res.status?.phase) props.phase = res.status.phase
  if (res.spec?.nodeName) props.nodeName = res.spec.nodeName
  if (res.spec?.replicas) props.replicas = res.spec.replicas
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

  // Labels
  const labels = {}
  if (res.metadata?.labels) {
    for (const [key, value] of Object.entries(res.metadata.labels)) {
      labels[key] = value
    }
  }

  const containers = {}
  if (res.status?.containerStatuses) {
    for (const c of res.status.containerStatuses) {
      containers[c.name] = {
        image: c.image,
        ready: c.ready ? 'Yes' : 'No',
        restarts: c.restartCount,
        started: c.started ? 'Yes' : 'No',
      }
    }
  }

  Alpine.store('res', {
    kind: res.kind,
    id: res.metadata.uid,
    icon: res.kind.toLowerCase(),
    props,
    containers,
    labels,
  })

  Alpine.store('open', true)
}

/**
 * Hide the side info panel
 */
export function hidePanel() {
  Alpine.store('open', false)
}
