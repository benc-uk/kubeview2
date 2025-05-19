import cytoscape from "../ext/cytoscape/cytoscape.esm.mjs";

// Define this function in the global scope
// Not a fan of this, but I can find no other option with the HTML/templ approach
window.namespaceLoaded = function (data) {
  console.log("Namespace loaded: ", data);

  // Replace null values with empty arrays, to simplify the code later
  for (const k of Object.keys(data)) {
    if (data[k] === null) data[k] = [];
  }

  const cy = cytoscape({
    container: document.getElementById("mainView"),

    style: [
      {
        selector: "node",
        style: {
          height: 60,
          width: 60,
          "background-color": "data(bgColour)",
          label: "data(label)",
          color: "#fff",
        },
      },
    ],
  });

  const updateStream = new EventSource("/updates", {});

  updateStream.onmessage = (event) => {
    console.log("Event: ", event.data);
  };

  window.addEventListener("resize", function () {
    if (cy) {
      cy.resize();
      cy.layout({
        name: "grid",
      }).run();
    }
  });

  for (const pod of data.pods) {
    cy.add({
      data: {
        id: pod.metadata.uid,
        label: pod.metadata.name,
        bgColour: "#326CE5",
      },
    });
  }

  for (const svc of data.services) {
    cy.add({
      data: {
        id: svc.metadata.uid,
        label: svc.metadata.name,
        bgColour: "#38a832",
      },
    });
  }

  for (const deployment of data.deployments) {
    cy.add({
      data: {
        id: deployment.metadata.uid,
        label: deployment.metadata.name,
        bgColour: "#9e43ba",
      },
    });
  }

  cy.layout({
    name: "grid",
  }).run();
};
