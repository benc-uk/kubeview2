import cytoscape from '../ext/cytoscape/cytoscape.esm.mjs'
import nodeStyle from './cyto-styles/node.js'

let cy = null
let namespace = null

// Generate or fetch random client token
localStorage.getItem('clientId') || localStorage.setItem('clientId', Math.random().toString(36).substring(2, 15))
const clientId = localStorage.getItem('clientId')
console.log('🆔 Client ID:', clientId)

console.log('🌐 Opening event stream...')
const updateStream = new EventSource(`/updates?clientID=${clientId}`, {})

updateStream.addEventListener('add', function (event) {
  if (!cy) return
  const res = JSON.parse(event.data)
  if (res.metadata.namespace !== namespace) return

  console.log('⬆️ Add object:', res.kind, res.metadata.name)

  if (res.kind === 'Pod') addResource(res)
  if (res.kind === 'Service') addResource(res)
  if (res.kind === 'Deployment') addResource(res)

  cy.layout({
    name: 'grid',
  }).run()
})

updateStream.addEventListener('delete', function (event) {
  if (!cy) return
  const data = JSON.parse(event.data)
  if (data.metadata.namespace !== namespace) return
  console.log('☠️ Delete object:', data.kind, data.metadata.name)

  if (data.kind === 'Pod') {
    cy.remove('#' + data.metadata.uid)
  } else if (data.kind === 'Service') {
    cy.remove('#' + data.metadata.uid)
  } else if (data.kind === 'Deployment') {
    cy.remove('#' + data.metadata.uid)
  }

  cy.layout({
    name: 'grid',
  }).run()
})

updateStream.onopen = function () {
  console.log('📚 Event stream ready:', updateStream.readyState === 1)
}

// Define this function in the global scope
// Not a fan of this, but I can find no other option with the HTML/templ approach
window.namespaceLoaded = function (ns, data) {
  console.log(`📚 Namespace '${ns}' data loaded`)
  namespace = ns

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

window.reset = function () {
  console.log('🔄 Resetting namespace')
  if (cy !== null) {
    cy.destroy()
    cy = null
  }
  document.getElementById('mainView').innerHTML = ''
}

function addResource(res) {
  console.log(' > Add', res.kind, res.metadata.name)

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

//
// This function is used to calculate the status colour of the resource
// Used to set the colour of the icon of certain resources
//
function statusColour(res) {
  if (res.kind === 'Deployment') {
    const availCond = res.status.conditions.find((c) => c.type == 'Available') || null
    if (availCond && availCond.status == 'True') return 'green'
    return red
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
  }

  return null
}
