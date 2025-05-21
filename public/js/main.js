// ==========================================================================================
// Main JavaScript entry point for KubeView
// Handles the main cytoscape graph and data load from the server
// Provides functions to add, update, and remove resources from the graph
// ==========================================================================================
import cytoscape from '../ext/cytoscape/cytoscape.esm.mjs'
import { initEventStreaming } from './events.js'
import { nodeStyle } from './styles.js'

let cy = null
let namespace = null

// Set up the event streaming for live updates once the DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  initEventStreaming()
})

//
// Global function to load the namespace data
// This function is called from the server side template when the namespace is loaded
//
globalThis.namespaceLoaded = function (ns, data) {
  console.log(`📚 Namespace '${ns}' data loaded`)
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

  window.addEventListener('resize', function () {
    if (cy) {
      cy.resize()
    }

    layout()
  })

  // Debug only
  console.log('🐞 DEBUG! Received data:')
  console.dir(data)

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

//
// When the user changes the namespace, we need to reset the graph
//
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
}

window.firstLoad = function () {
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

//
// This function is used to add a resource to the graph
//
export function addResource(res) {
  if (!cy) return

  cy.add(makeNode(res))
}

export function updateResource(res) {
  if (!cy) return

  const node = cy.getElementById(res.metadata.uid)
  if (node.length === 0) return

  const n = makeNode(res)

  node.data(n.data)
}

//
// This function is used to remove a resource from the graph
//
export function removeResource(res) {
  if (!cy) return
  cy.remove('#' + res.metadata.uid)
}

//
// Link two nodes together
//
export function addEdge(sourceId, targetId) {
  try {
    // This is the syntax Cytoscape uses for creating edges
    // We form a compound ID from the source and target IDs
    cy.add({ data: { id: `${sourceId}.${targetId}`, source: sourceId, target: targetId } })
  } catch (e) {
    console.warn(`### Unable to add link: ${sourceId} to ${targetId}`)
  }
}

//
// This function is used to create a node object for Cytoscape from the k8s resource
//
function makeNode(res) {
  return {
    data: {
      resource: true,
      statusColour: statusColour(res),
      id: res.metadata.uid,
      label: res.metadata.name,
      icon: res.kind.toLowerCase(),
      kind: res.kind,
    },
  }
}

//
// This function is used to calculate the status colour of the resource
//
function statusColour(res) {
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

  return null
}

export function activeNamespace() {
  return namespace
}

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
