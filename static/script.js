function stfuncdoesntwork() {
	console.log("teest");
}
off();
document.getElementById('input-message').addEventListener('input', function() {
	const textarea = document.getElementById('input-message');
	textarea.style.height = 'auto';
	if (textarea.scrollHeight <= 90) { // Allowing it to expand up to 5 lines
		textarea.style.height = textarea.scrollHeight + 'px';
	} else {
		textarea.style.height = '90px'; // After 5 lines, restrict to 90px
	}
});
async function on() {
	document.getElementById("overlay").style.display = "block";
	await new Promise(r => setTimeout(r, 2500));
	document.getElementById("overlay").click();
}
async function on2() {
	document.getElementById("overlay2").style.display = "block";
	await new Promise(r => setTimeout(r, 2500));
	off2();
}
on();
let cy = null; // global cy variable
let clr = null;
async function sendMessage() {
	document.getElementById("text").innerText = "Generating concept map now. Please wait...";
	await on();
	// Add color picker library
	const colorPicker = new iro.ColorPicker("#color-picker");
	// Add event listener to color picker
	colorPicker.on('color:change', function(color) {
		/*const selectedNode = cy.$('node:selected');
		if (selectedNode.length) {
			selectedNode.data('color', color.hexString);
			selectedNode.connectedEdges().data('color', color.hexString);
		}*/
		clr = color.hexString;
	});
	const inputElement = document.getElementById('input-message');
	const message = inputElement.value;
	const message2 = message.replace(/(?:\r\n|\r|\n)/g, ' <br> ');
	inputElement.value = '';

	// Display the user's message
	const chatMessages = document.getElementById('chat-messages');
	chatMessages.innerHTML = '';
	const userMessageDiv = document.createElement('div');
	userMessageDiv.className = 'message';
	userMessageDiv.textContent = `User: ${message}`; // Secure by using textContent instead of innerHTML
	chatMessages.appendChild(userMessageDiv);



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
	// Fix color coding function
	function colorDescendants(nodeId, color, edges, nodes, nodeColorMapping) {
		let childEdges = edges.filter(edge => edge.data.source === nodeId);

		for (let edge of childEdges) {
			edge.data.color = color;

			let targetNode = nodes.find(node => node.data.id === edge.data.target);
			if (targetNode) {
				targetNode.data.color = color;
				nodeColorMapping[targetNode.data.id] = color;

				// Call colorDescendants for all child nodes, not just the first one
				for (let childNode of nodes.filter(node => node.data.id === edge.data.target)) {
					colorDescendants(childNode.data.id, color, edges, nodes, nodeColorMapping);
				}
			} else {
				console.error('Target node not found for edge:', edge);
			}
		}
	}
	let colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33FF", "#FF8333"]; // Example colors
	// Add refresh function
	function refreshColorCoding() {
		// In your sendMessage function:
		let parentNode = graphData.nodes[0]; // Assuming the 1st node is the main node
	
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
	}
	refreshColorCoding()

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
			name: 'elk',
			elk: {
				animated: true,
				zoomToFit: true,
				algorithm: 'mrtree',
				'spacing.nodeNode': 40,
				'spacing.edgeNode': 20,
				separateConnectedComponents: false,
			},
		}
	});
	// Node Context Menu
	cy.cxtmenu({
		selector: 'node',
		openMenuEvents: 'taphold',
		commands: [{
				content: 'Delete',
				select: function(ele) {
					ele.connectedEdges().remove();
					ele.remove();
				}
			},
			{
				content: 'Link to',
				select: async function(ele) {
					const sourceNode = ele;
					// Secure version: Validate the input before using it
					const targetNodeId = prompt("Enter the label of the node to connect:");
					if (validateNodeId(targetNodeId)) {
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
								document.getElementById("text").innerText = "Link between nodes already exists!";
								await on();
							}
						} else {
							document.getElementById("text").innerText = "Invalid node label. Please enter a mix of just alphanumeric characters, dashes, and underscores.";
							await on();
						}
					} else {
						document.getElementById("text").innerText = "Invalid node ID. Please enter a mix of just alphanumeric characters, dashes, and underscores";
						await on();
					}

					// Implement the validation function
					function validateNodeId(nodeId) {
						// Add your validation logic here (for example, check if nodeId matches a specific pattern)
						return /^[a-zA-Z0-9-_]+$/.test(nodeId); // This is a basic example that allows alphanumeric characters, dashes, and underscores.
					}

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
							document.getElementById("text").innerText = "Link between nodes already exists!";
							await on();
						}
					} else {
						document.getElementById("text").innerText = "Invalid node label. Please enter a mix of just alphanumeric characters, dashes, and underscores.";
						await on();
					}
				}
			},
			{
				content: 'Change text',
				select: function(ele) {
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
			},
         {
            content: 'Change color',
            select: async function (ele) {
		await on2();
                ele.data('color', color);
            }
         },
		]
	});

	// Edge Context Menu
	cy.cxtmenu({
		selector: 'edge',
		openMenuEvents: 'taphold',
		commands: [{
			content: 'Delete',
			select: function(ele) {
				ele.remove();
			}
		}]
	});

	// Core Context Menu
	cy.cxtmenu({
		selector: 'core',
		openMenuEvents: 'taphold',
		commands: [{
				content: 'Concept map',
				select: function() {
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
				select: function() {
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
			    	content: 'Refresh colors',
		            	select: refreshColorCoding
		        },
			[{
	        		content: 'File operations',
				submenu: [
					{
						content: 'Save as PNG file (not editable)',
						select: savePNG
					},
					{
						content: 'Save to config file',
						select: saveToFile
					},
					{
						content: 'Load from config file',
						select: loadFromFile
					}
			 	],
	                }]
		]
	});

	cy.on('grab', 'node', function(event) {
		event.target.addClass('grabbing');
	});

	cy.on('free', 'node', function(event) {
		event.target.removeClass('grabbing');
	});

	const edgehandlesDefaults = {
		preview: true,
		handleNodes: 'node',
		handleSize: 10,
		edgeType: function() {
			return 'flat';
		},
		complete: function(sourceNode, targetNodes, addedEntities) {
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
		const nodeId = prompt("Enter a unique node ID:", "Example node ID");
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

	async function removeSelectedNode() {
		if (cy) {
			const selectedNode = cy.$('node:selected');
			if (selectedNode.length) {
				selectedNode.connectedEdges().remove();
				selectedNode.remove();
			} else {
				document.getElementById("text").innerText = "Select a node first to remove it!";
				await on();
			}
		}
	}

	cy.on('shiftTap', 'node', function(evt) {
		evt.target.selected(!evt.target.selected());
	});


	// Function to handle PNG export
	function savePNG() {
		var png64 = cy.png({
			output: 'base64',
			scale: 8 // Increasing the scale to 8 times the original size
		});

		// Get the label of the first node
		var firstNodeLabel = cy.nodes().first().data('label');
		// Replace any characters that are not suitable for filenames
		var safeLabel = firstNodeLabel.replace(/[^a-z0-9]/gi, '_').toLowerCase();

		// Create a link and trigger the download
		var link = document.createElement('a');
		link.download = safeLabel + ".png"; // Set the download attribute to the safe label
		link.href = "data:image/png;base64," + png64;
		document.body.appendChild(link); // Append the link to the body
		link.click(); // Simulate click to trigger download
		document.body.removeChild(link); // Remove the link after triggering the download
	}
	// Function to save the current diagram state to a file
	async function saveToFile() {
		const data = {
			elements: {
				nodes: cy.nodes().map(node => ({
					data: node.data()
				})),
				edges: cy.edges().map(edge => ({
					data: edge.data()
				}))
			}
		};
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);

		// Create a link and trigger the download
		const downloadLink = document.createElement('a');
		downloadLink.href = url;
		downloadLink.download = 'diagram.json';
		document.body.appendChild(downloadLink);
		downloadLink.click();
		document.body.removeChild(downloadLink);
		URL.revokeObjectURL(url);
	}
	async function loadFromFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.onchange = async function e() {
			const file = e.target.files[0];
			const reader = new FileReader();
			reader.onload = async function(event) {
				try {
					const data = JSON.parse(event.target.result);
					cy.json(data); // Load the data directly
					cy.layout({
						name: 'preset'
					}).run(); // Reapply layout if necessary
				} catch (error) {
					console.error('Error loading file:', error);
					document.getElementById("text").innerText = "Failed to load file. Please ensure it is a valid .json file.";
					await on();
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}


	document.getElementById('regenerate-btn').style.display = 'block';
	// Store the original message in the cy instance's data
	cy.data('originalMessage', message);

}

document.getElementById('regenerate-btn').addEventListener('click', async function() {
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
			document.getElementById("text").innerText = "Original message to regenerate not found.";
			await on();
		}
	} else {
		document.getElementById("text").innerText = "Concept map not found. May be due to blocker of sorts.";
		await on();
	}
});

// Service worker registration should be secure
if ("serviceWorker" in navigator) {
	// Check if the page is served over HTTPS
	if (window.location.protocol === 'https:') {
		navigator.serviceWorker.register("/generate-sw.js");
	} else {
		console.error("Service worker registration failed. The page must be served over HTTPS.");
	}
}
