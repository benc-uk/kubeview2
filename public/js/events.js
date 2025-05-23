// ==========================================================================================
// Event streaming for Kubernetes resources
// Handles events from the server and updates the graph accordingly
// ==========================================================================================
import { activeNamespace, layout, removeResource, addResource, updateResource, addEdge } from './main.js'
import { getConfig } from './config.js'

getConfig().debug

export function initEventStreaming() {
  // Generate or fetch random client token, to identify the client
  localStorage.getItem('clientId') || localStorage.setItem('clientId', Math.random().toString(36).substring(2, 15))
  const clientId = localStorage.getItem('clientId')
  console.log('🆔 Client ID:', clientId)

  console.log('🌐 Opening event stream...')
  const updateStream = new EventSource(`/updates?clientID=${clientId}`, {})

  // Handle resource add events from the server
  updateStream.addEventListener('add', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return

    if (getConfig().debug) console.log('⬆️ Add resource:', res.kind, res.metadata.name)

    addResource(res)
    if (res.metadata.ownerReferences) {
      for (const ownerRef of res.metadata.ownerReferences) {
        addEdge(ownerRef.uid, res.metadata.uid)
      }
    }

    layout()
  })

  // Handle resource delete events from the server
  updateStream.addEventListener('delete', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return

    if (getConfig().debug) console.log('☠️ Delete resource:', res.kind, res.metadata.name)

    removeResource(res)
    layout()
  })

  // Handle resource update events from the server
  updateStream.addEventListener('update', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return

    if (getConfig().debug) console.log('⬆️ Update resource:', res.kind, res.metadata.name)

    updateResource(res)
  })

  // Notify when the stream is connected
  updateStream.onopen = function () {
    console.log('📚 Event stream ready:', updateStream.readyState === 1)
    if (updateStream.readyState === 1) {
      document.getElementById('eventStatusIcon').classList.remove('is-warning')
      document.getElementById('eventStatusIcon').classList.add('is-success')
    }
  }
}
