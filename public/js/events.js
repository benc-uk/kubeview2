import { activeNamespace, layout, removeResource, addResource, updateResource } from './main.js'

export function initEventStreaming() {
  // Generate or fetch random client token
  localStorage.getItem('clientId') || localStorage.setItem('clientId', Math.random().toString(36).substring(2, 15))
  const clientId = localStorage.getItem('clientId')
  console.log('🆔 Client ID:', clientId)

  console.log('🌐 Opening event stream...')
  const updateStream = new EventSource(`/updates?clientID=${clientId}`, {})

  updateStream.addEventListener('add', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return

    console.log('⬆️ Add resource:', res.kind, res.metadata.name)

    addResource(res)
    layout()
  })

  updateStream.addEventListener('delete', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return
    console.log('☠️ Delete resource:', res.kind, res.metadata.name)

    removeResource(res)
    layout()
  })

  updateStream.addEventListener('update', function (event) {
    let res
    try {
      res = JSON.parse(event.data)
    } catch (e) {
      console.error('💥 Error parsing event data:', e)
      return
    }

    if (res.metadata.namespace !== activeNamespace()) return

    console.log('⬆️ Update resource:', res.kind, res.metadata.name)

    updateResource(res)
    layout()
  })

  updateStream.onopen = function () {
    console.log('📚 Event stream ready:', updateStream.readyState === 1)
  }
}
