import cytoscape from "../ext/cytoscape/cytoscape.esm.mjs";

let cy;

// Define this function in the global scope
// Not a fan of this, but I can find no other option with the HTML/templ approach
window.namespaceLoaded = function (data) {
  console.log("namespaceUpdate", data);

  cy = cytoscape({
    container: document.getElementById("mainView"),

    layout: {
      name: "grid",
      cols: 3,
    },

    style: [
      {
        selector: "node",
        style: {
          height: 60,
          width: 60,
          "background-color": "#326CE5",
          label: "data(label)",
          color: "#fff",
        },
      },
    ],
  });

  if (data === null || data.length === 0) {
    console.log("No data found for this namespace");
    return;
  }

  for (let i = 0; i < data.length; i++) {
    cy.add({
      data: { id: data[i].metadata.uid, label: data[i].metadata.name },
    });
  }

  cy.layout({
    name: "grid",
  }).run();
};

window.addEventListener("resize", function () {
  if (cy) {
    cy.resize();
    cy.layout({
      name: "grid",
    }).run();
  }
});
