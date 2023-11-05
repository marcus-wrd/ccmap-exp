function stfuncdoesntwork() {
   console.log("teest");
}

document.getElementById('input-message').addEventListener('input', function() {
   const textarea = document.getElementById('input-message');
   textarea.style.height = 'auto';
   if (textarea.scrollHeight <= 90) { // Allowing it to expand up to 5 lines
      textarea.style.height = textarea.scrollHeight + 'px';
   } else {
      textarea.style.height = '90px'; // After 5 lines, restrict to 90px
   }
});

let cy = null; // global cy variable
async function sendMessage() {
   const inputElement = document.getElementById('input-message');
   const message = inputElement.value;
   const message2 = message.replace(/(?:\r\n|\r|\n)/g, ' <br> ');
   inputElement.value = '';

   // Display the user's message
   const chatMessages = document.getElementById('chat-messages');
   chatMessages.innerHTML = '';
   chatMessages.innerHTML += `<div class="message">User: ${message2}</div>`;

   const cyContainer = document.createElement('div');
   cyContainer.className = 'cy-container';
   chatMessages.appendChild(cyContainer);

   // Fetch data from the backend
   const response = await fetch('/generate', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json'
      },
      body: JSON.stringify({
         prompt: message
      })
   });

   const graphData = await response.json();
   // Check if the graphData has nodes and edges
   if (!graphData || !graphData.nodes || !graphData.edges) {
      console.error('Invalid graph data:', graphData);
      return; // Exit the function if the data is not valid
   }

   // Filter out edges that do not have a target node or the target node is an empty string
   graphData.edges = graphData.edges.filter(edge => {
      const targetNodeExists = graphData.nodes.some(node => node.data.id === edge.data.target);
      if (!targetNodeExists || edge.data.target === "") {
         console.error('Target node not found for edge, removing edge:', edge);
         return false; // Do not include this edge in the new array
      }
      return true; // Include this edge in the new array
   });
   
   for (let node of graphData.nodes) {
      if (node.data.id == "") {
         node.data.id = "null"
      }
      if (!node.data.label) {
         node.data.label = node.data.id;
      }
   }

   // A recursive function to color nodes and their descendants
   function colorDescendants(nodeId, color, edges, nodes, nodeColorMapping) {
      // Find all edges where this node is the source
      let childEdges = edges.filter(edge => edge.data.source === nodeId);

      for (let edge of childEdges) {
         edge.data.color = color; // Color the edge

         let targetNode = nodes.find(node => node.data.id === edge.data.target);
         if (targetNode) { // Check if targetNode is not undefined
            targetNode.data.color = color; // Color the target node
            nodeColorMapping[targetNode.data.id] = color; // Store color mapping
            // Recursively color the descendants of the target node
            colorDescendants(targetNode.data.id, color, edges, nodes, nodeColorMapping);
         } else {
            console.error('Target node not found for edge:', edge);
         }

      }
   }

   // In your sendMessage function:
   let parentNode = graphData.nodes[0]; // Assuming the 1st node is the main node
   const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33FF", "#FF8333"]; // Example colors

   // Dictionary to store node-color mappings
   let nodeColorMapping = {};

   for (let i = 0; i < graphData.edges.length; i++) {
      let edge = graphData.edges[i];

      // If this edge starts at the parent node
      if (edge.data.source === parentNode.data.id) {
         let color = colors[i % colors.length];

         // Color the edge and target node
         edge.data.color = color;
         let targetNode = graphData.nodes.find(node => node.data.id === edge.data.target);
         if (targetNode) { // Check if targetNode is not undefined
            targetNode.data.color = color;
            nodeColorMapping[targetNode.data.id] = color;
            // Recursively color the descendants of this target node
            colorDescendants(targetNode.data.id, color, graphData.edges, graphData.nodes, nodeColorMapping);
         } else {
            console.error('Target node not found for edge:', edge);
         }
      }
   }


   cy = cytoscape({
      container: cyContainer,
      elements: graphData,
      style: [{
            selector: 'node',
            style: {
               'shape': 'round-rectangle',
               'background-color': 'data(color)', // dynamic color
               'label': 'data(label)',
               'text-wrap': 'wrap',
               'text-max-width': '150px',
               'font-size': '15.5px',
               'text-valign': 'center',
               'width': 'label',
               'height': 'label',
               'padding': '5px'
            }
         },
         {
            selector: 'edge',
            style: {
               'width': 2,
               'line-color': 'data(color)', // dynamic color for edge
               'target-arrow-color': 'data(color)', // dynamic color for arrow
               'target-arrow-shape': 'triangle',
               'curve-style': 'bezier'
            }
         }
      ],
      layout: {
         name: 'dagre',
         fit: true,
         padding: 13,
         spacingFactor: 1.2 // Adjust this value to find the desired edge length
      }
   });
   // Node Context Menu
   cy.cxtmenu({
      selector: 'node',
      commands: [{
            content: 'Delete',
            select: function (ele) {
               ele.connectedEdges().remove();
               ele.remove();
            }
         },
         {
            content: 'Link to',
            select: function (ele) {
               const sourceNode = ele;
               const targetNodeId = prompt("Enter the label of the node to connect:");
               const targetNode = cy.getElementById(targetNodeId);
               if (targetNode && sourceNode.id() !== targetNodeId) {
                  if (cy.$(`edge[source="${sourceNode.id()}"][target="${targetNodeId}"]`).length === 0) {
                     cy.add({
                        group: 'edges',
                        data: {
                           id: sourceNode.id() + "->" + targetNodeId,
                           source: sourceNode.id(),
                           target: targetNodeId,
                           color: sourceNode.data('color') || '#FF5733'
                        }
                     });
                  } else {
                     alert("Link already exists!");
                  }
               } else {
                  alert("Invalid node label!");
               }
            }
         },
         {
            content: 'Change text',
            select: function (ele) {
               const oldLabel = ele.data('label');
               const newLabel = prompt("Edit node label:", oldLabel);
               if (newLabel && newLabel !== oldLabel) {
                  ele.data('label', newLabel);
                  ele.style({
                     'width': 'label',
                     'height': 'label'
                  });
               }
            }
         }
      ]
   });

   // Edge Context Menu
   cy.cxtmenu({
      selector: 'edge',
      commands: [{
         content: 'Delete',
         select: function (ele) {
            ele.remove();
         }
      }]
   });

   // Core Context Menu
   cy.cxtmenu({
      selector: 'core',
      commands: [{
            content: 'Concept map 1',
            select: function () {
               cy.layout({
                  animated: true,
                  name: 'dagre',
               }).run();
            }
         },
         {
            content: 'Concept map 2',
            select: function () {
               cy.layout({
                 name: 'elk',
                 elk: {
                   animated: true,
                   zoomToFit: true,
                   algorithm: 'mrtree',
                   'spacing.nodeNode': 40,
                   'spacing.edgeNode': 20,
                   separateConnectedComponents: false,
                 },
               }).run();
            }
         },
         {
            content: 'Mind map',
            select: function () {
               cy.layout({
                 name: 'fcose',
                 nodeRepulsion: 15000,
                 idealEdgeLength: 75,
                 edgeElasticity: 0.34,
                 numIter: 50000,
                 gravity: 0.2,
               }).run();
            }
         },
         {
            content: 'Add node',
            select: addManualNode
         },
         {
            content: 'Save as PNG',
            select: savePNG
         }
      ]
   });

   cy.on('grab', 'node', function (event) {
      event.target.addClass('grabbing');
   });

   cy.on('free', 'node', function (event) {
      event.target.removeClass('grabbing');
   });

   const edgehandlesDefaults = {
      preview: true,
      handleNodes: 'node',
      handleSize: 10,
      edgeType: function () {
         return 'flat';
      },
      complete: function (sourceNode, targetNodes, addedEntities) {
         if (cy.$(`edge[source="${sourceNode.id()}"][target="${targetNodes[0].id()}"]`).length === 0) {
            addedEntities[0].data({
               id: sourceNode.id() + '->' + targetNodes[0].id(),
               color: '#FF5733'
            });
         } else {
            addedEntities.remove(); // if edge already exists, remove the duplicate
         }
      }
   };

   cy.edgehandles(edgehandlesDefaults);
   // New function to add manual nodes
   function addManualNode() {
      const nodeId = prompt("Enter a unique node ID:", "Edit me by double-clicking...");
      if (nodeId && cy) {
         cy.add({
            group: 'nodes',
            data: {
               id: nodeId,
               label: nodeId,
               color: '#FF5733'
            }
         });
      }
   }

   // New function to add manual edges
   function addManualEdge() {
      const sourceNode = prompt("Enter the source node ID:");
      const targetNode = prompt("Enter the target node ID:");
      if (sourceNode && targetNode && cy) {
         cy.add({
            group: 'edges',
            data: {
               id: sourceNode + "->" + targetNode,
               source: sourceNode,
               target: targetNode,
               color: '#FF5733'
            }
         });
      }
   }

   function removeSelectedNode() {
      if (cy) {
         const selectedNode = cy.$('node:selected');
         if (selectedNode.length) {
            selectedNode.connectedEdges().remove();
            selectedNode.remove();
         } else {
            alert("Select a node first to remove it!");
         }
      }
   }

   cy.on('shiftTap', 'node', function (evt) {
      evt.target.selected(!evt.target.selected());
   });


   // Function to handle PNG export
   function savePNG() {
      var png64 = cy.png({
         output: 'base64',
         scale: 60
      }); // Increasing the scale to 3 times the original size
      var link = document.createElement('a');
      link.download = "data:image/png;base64," + png64;
      link.href = "data:image/png;base64," + png64;
      link.click();
   }
   document.getElementById('regenerate-btn').style.display = 'block';
   // Store the original message in the cy instance's data
   cy.data('originalMessage', message);

}

document.getElementById('regenerate-btn').addEventListener('click', function() {
      document.getElementById('chat-messages').innerHTML = '';
      if (cy) {
         // If cy is defined, get the original message from the cy instance
         const originalMessage = cy.data('originalMessage');
         if (originalMessage) {
            // Set the value of the input element to the original message
            document.getElementById('input-message').value = originalMessage;
            // Call the sendMessage function
            sendMessage();
         } else {
            alert('Original message not found.');
         }
      } else {
         alert('Concept map not found.');
      }
});

if ("serviceWorker" in navigator) {
   navigator.serviceWorker.register("static/generate-sw.js");
}
