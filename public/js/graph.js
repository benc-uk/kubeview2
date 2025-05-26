import { getConfig } from './config.js'
import { cy, resMap, hidePanel } from './main.js'

import Alpine from '../ext/alpinejs.esm.min.js'

const ICON_PATH = 'public/img/res'

/**
 * Used to add a resource to the graph
 */
export function addResource(res) {
  if (!cy) return

  // Endpoints are stored in the resmap but not added to the graph
  if (res.kind === 'Endpoints') {
    resMap[res.metadata.uid] = res
    processLinks(res)
    return
  }

  // Hide resources that are not in the filter
  if (getConfig().resFilter && !getConfig().resFilter.includes(res.kind)) {
    if (getConfig().debug) console.warn(`🍇 Skipping resource of kind ${res.kind} as it is not in the filter`)
    return
  }

  cy.add(makeNode(res))
  processLinks(res)

  resMap[res.metadata.uid] = res
}

/**
 * Used to update a resource in the graph
 * It will update the node data and the status colour
 */
export function updateResource(res) {
  if (!cy) return

  // Endpoints are stored in the resmap but not added to the graph
  if (res.kind === 'Endpoints') {
    resMap[res.metadata.uid] = res
    processLinks(res)
    return
  }

  const node = cy.getElementById(res.metadata.uid)
  if (node.length === 0) {
    // If the node does not exist, we add it
    if (getConfig().debug) {
      console.warn(`🍒 Node with ID ${res.metadata.uid} not found, adding it`)
    }

    addResource(res)
    processLinks(res)

    return
  }

  // Actual update is here
  node.data(makeNode(res).data)
  resMap[res.metadata.uid] = res
  processLinks(res)

  // TODO: FIX THIS!!!!!!!! 🔥🔥🔥🔥🔥🔥
  // if (Alpine.store('res').id === res.metadata.uid && Alpine.store('open')) {
  //   // If the updated resource is the one currently displayed in the panel, update the panel
  //   showPanel(res.metadata.uid)
  // }
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
    cy.add({
      data: {
        id: `${sourceId}.${targetId}`,
        source: sourceId,
        target: targetId,
      },
    })
    // eslint-disable-next-line
  } catch (e) {
    if (getConfig().debug) {
      console.warn(`🚸 Unable to add link: ${sourceId} to ${targetId}`)
    }
  }
}

/**
 * Lots of nasty custom logic to link resources together
 * This is used to link Ingresses to Services and Services to Pods, etc.
 */
export function processLinks(res) {
  if (!cy) return

  if (res.metadata.ownerReferences) {
    for (const ownerRef of res.metadata.ownerReferences) {
      addEdge(ownerRef.uid, res.metadata.uid)
    }
  }

  // If the resource is a Ingress, we link it to the Service via the backend service name
  if (res.kind === 'Ingress' && res.spec?.rules) {
    for (const rule of res.spec.rules) {
      if (rule.http && rule.http.paths) {
        for (const path of rule.http.paths) {
          if (path.backend && path.backend.service && path.backend.service.name) {
            if (getConfig().debug) console.log(`🔗 Linking Ingress ${res.metadata.name} to Service ${path.backend.service.name}`)

            const serviceName = path.backend.service.name
            const service = cy.$(`node[kind = "Service"][label = "${serviceName}"]`)
            if (service.length > 0) {
              addEdge(res.metadata.uid, service.id())
            }
          }
        }
      }
    }
  }

  // If the resource is a Service, we link it to the Pods using endpoint subnet and podID
  if (res.kind === 'Service') {
    const ep = Object.values(resMap).find((r) => r.kind === 'Endpoints' && r.metadata.name === res.metadata.name)
    if (ep) {
      for (const subset of ep.subsets || []) {
        for (const addr of subset.addresses || []) {
          const pod = cy.$(`node[kind = "Pod"][ip = "${addr.ip}"]`)
          if (pod.length > 0) {
            if (getConfig().debug) console.log(`🔗 Linking Service ${res.metadata.name} to PodIP ${addr.ip} (${pod.data('label')})`)
            addEdge(res.metadata.uid, pod.id())
          }
        }
      }
    }
  }

  // If the resource is a endpoint, we find matching service and link it to the pods
  if (res.kind === 'Endpoints') {
    const service = cy.$(`node[kind = "Service"][label = "${res.metadata.name}"]`)
    if (service) {
      // find the pods in the endpoints and link them to the service
      for (const subset of res.subsets || []) {
        for (const addr of subset.addresses || []) {
          const pod = cy.$(`node[kind = "Pod"][ip = "${addr.ip}"]`)
          if (pod.length > 0) {
            if (getConfig().debug) console.log(`🔗 Linking Endpoints ${res.metadata.name} to PodIP ${addr.ip} (${pod.data('label')})`)
            addEdge(service.id(), pod.id())
          }
        }
      }
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

  let colourSuffix = statusColour(res)
  if (colourSuffix !== '') {
    colourSuffix = '-' + colourSuffix
  }

  return {
    data: {
      resource: true,
      id: res.metadata.uid,
      label: label,
      icon: `${ICON_PATH}/${res.kind.toLowerCase() + colourSuffix}.svg`,
      kind: res.kind,
      ip: res.status?.podIP || res.status?.hostIP || null,
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

    if (res.kind === 'PersistentVolumeClaim') {
      if (res.status.phase === 'Bound') return 'green'
      if (res.status.phase === 'Pending') return 'grey'
      return 'red'
    }
  } catch (e) {
    console.error('💥 Error calculating status colour:', e)
    return ''
  }

  return ''
}

/**
 * Layout the graph
 */
export function layout() {
  if (!cy) return

  // Use breadthfirst with roots set to the main resources
  // This will create a tree-like structure with the main resources at the top
  cy.layout({
    name: 'breadthfirst',
    directed: true,
    roots: cy.nodes('[kind = "Ingress"],[kind = "Deployment"],[kind = "DaemonSet"],[kind = "StatefulSet"]'),
    nodeDimensionsIncludeLabels: true,
    spacingFactor: 1,
  }).run()
}

globalThis.coseLayout = function () {
  cy.layout({
    name: 'cose',
    randomize: false,
    numIter: 5000,
    nodeDimensionsIncludeLabels: true,
  }).run()
}
