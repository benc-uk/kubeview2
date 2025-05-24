// ==========================================================================================
// Main JavaScript entry point for KubeView
// Handles the main cytoscape graph and data load from the server
// Provides functions to add, update, and remove resources from the graph
// ==========================================================================================
import cytoscape from '../ext/cytoscape.esm.min.mjs'
import { getConfig } from './config.js'
import { initEventStreaming } from './events.js'
import { nodeStyle } from './styles.js'

let cy = null
let namespace = null
let resMap = {}

// Alpine.js store to hold the currently selected resource data
document.addEventListener('alpine:init', () => {
  Alpine.store('res', { kind: 'default', id: '', icon: 'default', props: {}, containers: {}, labels: {} })
})

// Set up the event streaming for live updates once the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  // Makes sure the config singleton is initialized
  getConfig()
  initEventStreaming()
})

/**
 * Global function to load the namespace data
 * This function is called from the server side template when the namespace is loaded
 */
globalThis.namespaceLoaded = function (ns, data) {
  console.log(`📚 Data for namespace '${ns}' received`)
  namespace = ns
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
      // Add the resource to the graph
      addResource(res)
    }
  }

  // Pass 2 - Add links between using metadata.ownerReferences
  for (const kindKey in data) {
    const kind = data[kindKey]
    for (const res of kind) {
      if (res.metadata.ownerReferences) {
        for (const ownerRef of res.metadata.ownerReferences) {
          addEdge(ownerRef.uid, res.metadata.uid)
        }
      }
    }
  }

  layout()
}

/**
 * When the user changes the namespace, we need to reset the graph
 * This is called by HTMX, which is why it's in the global scope
 */
globalThis.reset = function () {
  namespace = null

  console.log('🔄 Resetting namespace')
  if (cy !== null) {
    cy.destroy()
    cy = null
  }

  const mv = document.getElementById('mainView')
  if (mv) {
    mv.innerHTML = ''
  }

  document.getElementById('error').classList.add('is-hidden')
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
    namespace = urlNamespace

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
  console.error('💥 HTMX ERROR')
  console.dir(event)
  let errorMessage =
    event.detail.errorInfo.error + ' ' + event.detail.errorInfo.requestConfig.verb + ' -> ' + event.detail.errorInfo.pathInfo.finalRequestPath

  document.getElementById('errMsg').innerText = errorMessage
  document.getElementById('error').classList.remove('is-hidden')
}

/**
 * Used to add a resource to the graph
 */
export function addResource(res) {
  if (!cy) return

  // Hide resources that are not in the filter
  if (getConfig().resFilter && !getConfig().resFilter.includes(res.kind)) {
    if (getConfig().debug) console.warn(`🍇 Skipping resource of kind ${res.kind} as it is not in the filter`)
    return
  }

  cy.add(makeNode(res))
  resMap[res.metadata.uid] = res
}

/**
 * Used to update a resource in the graph
 * It will update the node data and the status colour
 */
export function updateResource(res) {
  if (!cy) return

  const node = cy.getElementById(res.metadata.uid)
  if (node.length === 0) {
    // If the node does not exist, we add it
    if (getConfig().debug) {
      console.warn(`🍒 Node with ID ${res.metadata.uid} not found, adding it`)
    }
    addResource(res)
    return
  }

  node.data(makeNode(res).data)
  resMap[res.metadata.uid] = res
  if (Alpine.store('res').id === res.metadata.uid) {
    // If the updated resource is the one currently displayed in the panel, update the panel
    showPanel(res.metadata.uid)
  }
}

/**
 * Used remove a resource from the graph
 */
export function removeResource(res) {
  if (!cy) return

  cy.remove('#' + res.metadata.uid)

  delete resMap[res.metadata.uid]

  if (Alpine.store('res').id === res.metadata.uid) {
    // If the removed resource is the one currently displayed in the panel, hide the panel
    hidePanel()
  }
}

/**
 * Link two nodes together
 */
export function addEdge(sourceId, targetId) {
  try {
    // This is the syntax Cytoscape uses for creating edges
    // We form a compound ID from the source and target IDs
    cy.add({ data: { id: `${sourceId}.${targetId}`, source: sourceId, target: targetId } })
    // eslint-disable-next-line
  } catch (e) {
    if (getConfig().debug) {
      console.warn(`🚸 Unable to add link: ${sourceId} to ${targetId}`)
    }
  }
}

/**
 * Create a node object for Cytoscape from the k8s resource
 */
function makeNode(res) {
  let label = res.metadata.name

  // Shorten the name if configured to do so
  if (getConfig().shortenNames && res.metadata && res.metadata.labels) {
    if (res.metadata.labels['pod-template-hash']) {
      label = label.split('-' + res.metadata.labels['pod-template-hash'])[0]
    }
  }

  return {
    data: {
      resource: true,
      statusColour: statusColour(res),
      id: res.metadata.uid,
      label: label,
      icon: res.kind.toLowerCase(),
      kind: res.kind,
    },
  }
}

/**
 * Used to calculate the status colour of the resource based on its state
 */
function statusColour(res) {
  try {
    if (res.kind === 'Deployment') {
      if (res.status == {} || !res.status.conditions) return 'grey'

      const availCond = res.status.conditions.find((c) => c.type == 'Available') || null
      if (availCond && availCond.status == 'True') return 'green'
      return 'red'
    }

    if (res.kind === 'ReplicaSet') {
      if (res.status.replicas == 0) return 'grey'
      if (res.status.replicas == res.status.readyReplicas) return 'green'
      return 'red'
    }

    if (res.kind === 'StatefulSet') {
      if (res.status.replicas == 0) return 'grey'
      if (res.status.replicas == res.status.readyReplicas) return 'green'
      return 'red'
    }

    if (res.kind === 'DaemonSet') {
      if (res.status.numberReady == res.status.desiredNumberScheduled) return 'green'
      if (res.status.desiredNumberScheduled == 0) return 'grey'
      return 'red'
    }

    if (res.kind === 'Pod') {
      // Weird way to check for terminaing pods, it's not anywhere else!
      if (res.metadata.deletionTimestamp) return 'red'

      if (res.status && res.status.conditions) {
        const readyCond = res.status.conditions.find((c) => c.type == 'Ready')
        if (readyCond && readyCond.status == 'True') return 'green'
      }

      if (res.status.phase == 'Failed') return 'red'
      if (res.status.phase == 'Succeeded') return 'green'
      if (res.status.phase == 'Pending') return 'grey'

      return 'grey'
    }
  } catch (e) {
    console.error('💥 Error calculating status colour:', e)
    return null
  }

  return null
}

/**
 * Get the currently active namespace user is viewing
 */
export function activeNamespace() {
  return namespace
}
globalThis.activeNamespace = activeNamespace

/**
 * Layout the graph
 */
export function layout() {
  if (!cy) return

  // Use breadthfirst with Deployments or DaemonSets or StatefulSets at the root
  cy.layout({
    name: 'breadthfirst',
    roots: cy.nodes('[kind = "Deployment"],[kind = "DaemonSet"],[kind = "StatefulSet"]'),
    nodeDimensionsIncludeLabels: true,
    spacingFactor: 1,
  }).run()
}

/**
 * Show the side info panel for a resource
 * This will populate the panel with the resource data and show it
 * @param {string} id - The ID of the resource to show
 */
function showPanel(id) {
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
    for (const cond of res.status?.conditions) {
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
function hidePanel() {
  Alpine.store('open', false)
}
