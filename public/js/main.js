import cytoscape from '../ext/cytoscape/cytoscape.esm.mjs'
import { initEventStreaming } from './events.js'
import { nodeStyle } from './styles.js'

let cy = null
let namespace = null

window.addEventListener('DOMContentLoaded', () => {
  initEventStreaming()
})

// Define this function in the global scope
// Not a fan of this, but I can find no other option with the HTML/templ approach
window.namespaceLoaded = function (ns, data) {
  console.log(`📚 Namespace '${ns}' data loaded`)
  namespace = ns

  window.history.replaceState({}, '', `?ns=${ns}`)

  // Replace null values with empty arrays, to simplify the code later
  for (const k of Object.keys(data)) {
    if (data[k] === null) data[k] = []
  }

  // This is why we are here, Cytoscape will be used to render all the data
  cy = cytoscape({
    container: document.getElementById('mainView'),
  })

  cy.style().selector('node[resource]').style(nodeStyle)
  cy.style()
    .selector('node[resource]')
    .style('background-image', function (ele) {
      return ele.data('statusColour')
        ? `public/img/res/${ele.data('icon')}-${ele.data('statusColour')}.svg`
        : `public/img/res/${ele.data('icon')}.svg`
    })

  window.addEventListener('resize', function () {
    if (cy) {
      cy.resize()
      cy.layout({
        name: 'grid',
      }).run()
    }
  })

  // Add all the resources to the graph
  for (const resTypeKey of Object.keys(data)) {
    const resList = data[resTypeKey]
    if (resList.length === 0) continue

    console.log(`🔄 Adding ${resList.length} ${resTypeKey}`)
    for (const res of resList) {
      addResource(res)
    }
  }

  cy.layout({
    name: 'grid',
  }).run()
}

//
// When the user changes the namespace, we need to reset the graph
//
window.reset = function () {
  console.log('🔄 Resetting namespace')
  if (cy !== null) {
    cy.destroy()
    cy = null
  }

  namespace = null
  document.getElementById('mainView').innerHTML = ''

  // This is used when the page is loaded with a namespace in the URL
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('ns')) {
    const urlNamespace = urlParams.get('ns')

    if (urlNamespace) {
      // This is used to trigger the change event on the select element
      // It's hacky, but it works
      setTimeout(() => {
        const event = new Event('change')
        const select = document.getElementById('namespaceSelect').firstChild
        select.value = urlNamespace
        select.dispatchEvent(event)
      }, 100)
    }
  }
}

//
// This function is used to add a resource to the graph
//
export function addResource(res) {
  if (!cy) return

  cy.add({
    data: {
      resource: true,
      statusColour: statusColour(res),
      id: res.metadata.uid,
      label: res.metadata.name,
      icon: res.kind.toLowerCase(),
    },
  })
}

export function updateResource(res) {
  if (!cy) return

  const node = cy.getElementById(res.metadata.uid)
  if (node.length === 0) return

  node.data({
    resource: true,
    statusColour: statusColour(res),
    id: res.metadata.uid,
    label: res.metadata.name,
    icon: res.kind.toLowerCase(),
  })
}

//
// This function is used to remove a resource from the graph
//
export function removeResource(res) {
  if (!cy) return
  cy.remove('#' + res.metadata.uid)
}

//
// This function is used to calculate the status colour of the resource
//
export function statusColour(res) {
  if (res.kind === 'Deployment') {
    const availCond = res.status.conditions.find((c) => c.type == 'Available') || null
    if (availCond && availCond.status == 'True') return 'green'
    return 'red'
  }

  if (res.kind === 'ReplicaSet') {
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
  if (cy) {
    cy.layout({
      name: 'grid',
    }).run()
  }
}
