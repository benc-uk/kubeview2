/**
 * Config Object
 * @typedef {Object} Config
 * @property {boolean} debug - Enable debug mode
 * @property {boolean} shortenNames - Shorten names in the UI
 * @property {string[]} namespaceFilter - Filter for namespaces
 * @property {string[]} resKindFilter - Filter for resource types
 */

/** @type {Config}*/
let config = null

/**
 * Gets the configuration object from local storage.
 * @returns {Config} The configuration object.
 */
export function getConfig() {
  if (config !== null) return config

  // Set the default client ID to a random value
  if (!localStorage.getItem('kubeviewConfig')) {
    const c = {
      debug: false,
      shortenNames: true,
      namespaceFilter: [],
      resKindFilter: ['Pod', 'Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'],
    }

    localStorage.setItem('kubeviewConfig', JSON.stringify(c))

    config = c
    return config
  }

  // Get the config from local storage
  const c = JSON.parse(localStorage.getItem('kubeviewConfig'))
  config = c
  return config
}

export function saveConfig(newConfig) {
  // Set the config in local storage
  localStorage.setItem('kubeviewConfig', JSON.stringify(newConfig))
  config = newConfig
}

// Expose the config functions globally
globalThis.getConfig = getConfig
globalThis.saveConfig = saveConfig
