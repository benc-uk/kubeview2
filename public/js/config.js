/**
 * Config Object
 * @typedef {Object} Config
 * @property {boolean} debug - Enable debug mode
 * @property {boolean} shortenNames - Shorten names in the UI
 * @property {string[]} resKindFilter - Filter for resource types
 * @property {boolean} hideHelm - Hide Helm releases
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
    const cfg = {
      debug: false,
      shortenNames: true,

      resFilter: ['Pod', 'Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Service', 'Ingress'],
    }

    localStorage.setItem('kubeviewConfig', JSON.stringify(cfg))

    config = cfg
    return cfg
  }

  // Get the config from local storage
  const cfg = JSON.parse(localStorage.getItem('kubeviewConfig'))
  config = cfg
  return cfg
}

export function saveConfig(newConfig) {
  // Set the config in local storage
  localStorage.setItem('kubeviewConfig', JSON.stringify(newConfig))
  config = newConfig
}

// Expose the config functions globally
globalThis.getConfig = getConfig
globalThis.saveConfig = saveConfig
