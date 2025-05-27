//@ts-check

// ==========================================================================================
// Event streaming for Kubernetes resources
// Handles SSE events from the server and updates the graph accordingly
// ==========================================================================================
import { layout, removeResource, addResource, updateResource } from './graph.js'
import { getConfig } from './config.js'
import { currentNamespace } from './main.js'

export function initEventStreaming() {
  // Generate or fetch random client token, to identify the client
  localStorage.getItem('clientId') || localStorage.setItem('clientId', Math.random().toString(36).substring(2, 15))
  const clientId = localStorage.getItem('clientId')
  console.log('🆔 Client ID:', clientId)

  console.log('🌐 Opening event stream...')
  const updateStream = new EventSource(`/updates?clientID=${clientId}`, {})

  // Handle resource add events from the server
  updateStream.addEventListener('add', function (event) {
    /** @type {Resource} */
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== currentNamespace) return

    if (getConfig().debug) console.log('⬆️ Add resource:', res.kind, res.metadata.name)

    addResource(res)
    layout()
  })

  // Handle resource delete events from the server
  updateStream.addEventListener('delete', function (event) {
    /** @type {Resource} */
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== currentNamespace) return

    if (getConfig().debug) console.log('☠️ Delete resource:', res.kind, res.metadata.name)

    removeResource(res)
    layout()
  })

  // Handle resource update events from the server
  updateStream.addEventListener('update', function (event) {
    /** @type {Resource} */
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== currentNamespace) return

    if (getConfig().debug) console.log('⬆️ Update resource:', res.kind, res.metadata.name)

    updateResource(res)
  })

  // Notify when the stream is connected
  updateStream.onopen = function () {
    console.log('📚 Event stream ready:', updateStream.readyState === 1)
    const statusIcon = document.getElementById('eventStatusIcon')

    if (updateStream.readyState === 1 && statusIcon) {
      statusIcon.classList.remove('is-warning')
      statusIcon.classList.add('is-success')
    } else if (statusIcon) {
      statusIcon.classList.remove('is-success')
      statusIcon.classList.add('is-warning')
    }
  }
}
