Please carefully analyze these two files, it seems that much our application is actually persisting properly and we are able to fetch and display the nodes correctly in the treemap but for some reason we keep getting these timeouts in fromID, why is that? is there an issue with fromID!

client:743 [vite] connecting...
chunk-VUNV25KB.js:9 Hello wonderful person! :) Thanks for using GUN, please ask for help on http://chat.gun.eco if anything takes you longer than 5min to figure out!
Gun.ts:11 Initializing Gun with peer: ['http://127.0.0.1:5500/gun']
main.ts:435 DOM fully loaded
main.ts:13 Attempting to recall user session
client:866 [vite] connected.
main.ts:51 Auth handler started
Gun.ts:67 Auth successful
main.ts:57 Login successful
main.ts:70 Auth container hidden
App.ts:30 [App] Constructor started
App.ts:48 [App] User information: {name: 'ruzgar', rootId: 'JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE'}
App.ts:51 [App] App instance attached to window.app
App.ts:60 [App] Starting initialization
App.ts:64 [App] Attempting to load existing root node from path: (2) ['users', 'JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE']
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:698 [TreeNode.fromId] Found node in users path: JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:573 [TreeNode] Received data update for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE: {_: {…}, children: {…}}
TreeNode.ts:593 [TreeNode] Setting up children subscription for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhwpn4E0v4kqNjWtr and ID m8ohhwpn4E0v4kqNjWtr for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhxqgfJvFd1jEIyHV and ID m8ohhxqgfJvFd1jEIyHV for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhy8fL9BVHCwBHqNJ and ID m8ohhy8fL9BVHCwBHqNJ for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhycbkSfPhsWJuj2h and ID m8ohhycbkSfPhsWJuj2h for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhycbkSfPhsWJuj2h
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhycbkSfPhsWJuj2h
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyfsDjCg51Qw3J2g and ID m8ohhyfsDjCg51Qw3J2g for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyivW08mKiecprfB and ID m8ohhyivW08mKiecprfB for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyivW08mKiecprfB
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyivW08mKiecprfB
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhylzLadjmLqyPW1f and ID m8ohhylzLadjmLqyPW1f for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhylzLadjmLqyPW1f
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhylzLadjmLqyPW1f
TreeNode.ts:626 [TreeNode] Setting up types subscription for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:672 [TreeNode] All subscriptions set up for node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
App.ts:94 [App] Existing root node loaded successfully: {id: 'JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE', name: 'ruzgar', childrenCount: 0}
App.ts:106 [App] Root node setup complete, initializing UI
App.ts:116 [App] Container dimensions: {width: 543, height: 761}
App.ts:118 [App] Root node ready: ruzgar ID: JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
App.ts:121 [App] Waiting for children to load from Gun...
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhycbkSfPhsWJuj2h
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyivW08mKiecprfB
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhylzLadjmLqyPW1f
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhwpn4E0v4kqNjWtr: {_: {…}, children: {…}, manualFulfillment: null, name: 'Space & Environment', points: 25}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Space & Environment" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhwpn4E0v4kqNjWtr: {_: {…}, children: {…}, manualFulfillment: null, name: 'Space & Environment', points: 25}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhwsq3T3qpNl6pmAv and ID m8ohhwsq3T3qpNl6pmAv for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhwsq3T3qpNl6pmAv
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhwsq3T3qpNl6pmAv
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhwvtQFZSrsNoxDLc and ID m8ohhwvtQFZSrsNoxDLc for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhwvtQFZSrsNoxDLc
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhwvtQFZSrsNoxDLc
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhwyqRWVhDMDb68ki and ID m8ohhwyqRWVhDMDb68ki for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhwyqRWVhDMDb68ki
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhwyqRWVhDMDb68ki
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhx1w2oFs3O6wZ1cO and ID m8ohhx1w2oFs3O6wZ1cO for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhx1w2oFs3O6wZ1cO
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhx1w2oFs3O6wZ1cO
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhx5yxqowi9hvoHN6 and ID m8ohhx5yxqowi9hvoHN6 for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhx5yxqowi9hvoHN6
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhx5yxqowi9hvoHN6
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhx9doatepcUwMrpk and ID m8ohhx9doatepcUwMrpk for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhx9doatepcUwMrpk
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhx9doatepcUwMrpk
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhxci3XRlx4eC3MVl and ID m8ohhxci3XRlx4eC3MVl for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhxci3XRlx4eC3MVl
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhxci3XRlx4eC3MVl
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhxg1y2e10LAOUnTV and ID m8ohhxg1y2e10LAOUnTV for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhxg1y2e10LAOUnTV
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhxg1y2e10LAOUnTV
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Space & Environment" (ID: m8ohhwpn4E0v4kqNjWtr)
TreeNode.ts:615 [TreeNode] Child m8ohhwpn4E0v4kqNjWtr (Space & Environment) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhxqgfJvFd1jEIyHV: {_: {…}, children: {…}, manualFulfillment: null, name: 'Subverse 🌌', points: 25}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Subverse 🌌" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhxqgfJvFd1jEIyHV: {_: {…}, children: {…}, manualFulfillment: null, name: 'Subverse 🌌', points: 25}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhxu5FbZI6DVgSsgM and ID m8ohhxu5FbZI6DVgSsgM for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhxxmaFqsCWouUA49 and ID m8ohhxxmaFqsCWouUA49 for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhxxmaFqsCWouUA49
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhxxmaFqsCWouUA49
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhy13UdJzbrIsuURx and ID m8ohhy13UdJzbrIsuURx for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhy13UdJzbrIsuURx
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhy13UdJzbrIsuURx
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhy49yvtNjlsx8Otd and ID m8ohhy49yvtNjlsx8Otd for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhy49yvtNjlsx8Otd
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhy49yvtNjlsx8Otd
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Subverse 🌌" (ID: m8ohhxqgfJvFd1jEIyHV)
TreeNode.ts:615 [TreeNode] Child m8ohhxqgfJvFd1jEIyHV (Subverse 🌌) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Money" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyw0i1MoW78ALbix and ID m8ohhyw0i1MoW78ALbix for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyw0i1MoW78ALbix
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyw0i1MoW78ALbix
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyzh3qh4BMwVCUbe and ID m8ohhyzh3qh4BMwVCUbe for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Money" (ID: m8ohhy8fL9BVHCwBHqNJ)
TreeNode.ts:615 [TreeNode] Child m8ohhy8fL9BVHCwBHqNJ (Money) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhycbkSfPhsWJuj2h: {_: {…}, children: {…}, manualFulfillment: null, name: 'Free Association', points: 15.513282159785156}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Free Association" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhycbkSfPhsWJuj2h
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhycbkSfPhsWJuj2h
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhycbkSfPhsWJuj2h: {_: {…}, children: {…}, manualFulfillment: null, name: 'Free Association', points: 15.513282159785156}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhycbkSfPhsWJuj2h
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhz30ppN1ZTnZVRQR and ID m8ohhz30ppN1ZTnZVRQR for node m8ohhycbkSfPhsWJuj2h
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhz6i9RSoKpMd40hT and ID m8ohhz6i9RSoKpMd40hT for node m8ohhycbkSfPhsWJuj2h
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhz6i9RSoKpMd40hT
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhz6i9RSoKpMd40hT
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhycbkSfPhsWJuj2h
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhycbkSfPhsWJuj2h
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Free Association" (ID: m8ohhycbkSfPhsWJuj2h)
TreeNode.ts:615 [TreeNode] Child m8ohhycbkSfPhsWJuj2h (Free Association) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyfsDjCg51Qw3J2g: {_: {…}, manualFulfillment: null, name: 'Automation of Useful-repetitive Tasks', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Automation of Useful-repetitive Tasks" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyfsDjCg51Qw3J2g: {_: {…}, manualFulfillment: null, name: 'Automation of Useful-repetitive Tasks', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyfsDjCg51Qw3J2g
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Automation of Useful-repetitive Tasks" (ID: m8ohhyfsDjCg51Qw3J2g)
TreeNode.ts:615 [TreeNode] Child m8ohhyfsDjCg51Qw3J2g (Automation of Useful-repetitive Tasks) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyivW08mKiecprfB: {_: {…}, manualFulfillment: null, name: 'Socialization of Land & Means of Production', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Socialization of Land & Means of Production" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhyivW08mKiecprfB
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyivW08mKiecprfB
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyivW08mKiecprfB: {_: {…}, manualFulfillment: null, name: 'Socialization of Land & Means of Production', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyivW08mKiecprfB
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyivW08mKiecprfB
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyivW08mKiecprfB
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Socialization of Land & Means of Production" (ID: m8ohhyivW08mKiecprfB)
TreeNode.ts:615 [TreeNode] Child m8ohhyivW08mKiecprfB (Socialization of Land & Means of Production) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhylzLadjmLqyPW1f: {_: {…}, children: {…}, manualFulfillment: null, name: 'Maintaining Personal Property Relations', points: 14.0710042265625}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Maintaining Personal Property Relations" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhylzLadjmLqyPW1f
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhylzLadjmLqyPW1f
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhylzLadjmLqyPW1f: {_: {…}, children: {…}, manualFulfillment: null, name: 'Maintaining Personal Property Relations', points: 14.0710042265625}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhylzLadjmLqyPW1f
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyp8ZqOcaEyfXQWz and ID m8ohhyp8ZqOcaEyfXQWz for node m8ohhylzLadjmLqyPW1f
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhysi4InVlILPU9wr and ID m8ohhysi4InVlILPU9wr for node m8ohhylzLadjmLqyPW1f
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhysi4InVlILPU9wr
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhysi4InVlILPU9wr
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhylzLadjmLqyPW1f
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhylzLadjmLqyPW1f
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Maintaining Personal Property Relations" (ID: m8ohhylzLadjmLqyPW1f)
TreeNode.ts:615 [TreeNode] Child m8ohhylzLadjmLqyPW1f (Maintaining Personal Property Relations) loaded successfully for JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhwsq3T3qpNl6pmAv
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhwvtQFZSrsNoxDLc
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhwyqRWVhDMDb68ki
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhx1w2oFs3O6wZ1cO
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhx5yxqowi9hvoHN6
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhx9doatepcUwMrpk
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxci3XRlx4eC3MVl
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxg1y2e10LAOUnTV
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxxmaFqsCWouUA49
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhy13UdJzbrIsuURx
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhy49yvtNjlsx8Otd
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyw0i1MoW78ALbix
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyzh3qh4BMwVCUbe
 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhz30ppN1ZTnZVRQR
 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhz6i9RSoKpMd40hT
 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyp8ZqOcaEyfXQWz
 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhysi4InVlILPU9wr
 [TreeNode.fromId] Raw data from Gun for node m8ohhwsq3T3qpNl6pmAv: {_: {…}, children: {…}, manualFulfillment: null, name: 'Indoor/Outdoor Space', points: 15}
 [TreeNode.fromId] Node name from Gun: "Indoor/Outdoor Space" (string)
 [TreeNode] Creating new Gun reference for node m8ohhwsq3T3qpNl6pmAv
 [TreeNode] Setting up subscriptions for node m8ohhwsq3T3qpNl6pmAv
 [TreeNode] Received data update for node m8ohhwsq3T3qpNl6pmAv: {_: {…}, children: {…}, manualFulfillment: null, name: 'Indoor/Outdoor Space', points: 15}
 [TreeNode] Setting up children subscription for m8ohhwsq3T3qpNl6pmAv
 [TreeNode] Detected child with key m8ohhxjmOV20TeKwasiv and ID m8ohhxjmOV20TeKwasiv for node m8ohhwsq3T3qpNl6pmAv
 [TreeNode] Loading new child with ID m8ohhxjmOV20TeKwasiv
 [TreeNode] Attempting to load node with ID: m8ohhxjmOV20TeKwasiv
 [TreeNode] Detected child with key m8ohhxn3cur6ieIuRtsm and ID m8ohhxn3cur6ieIuRtsm for node m8ohhwsq3T3qpNl6pmAv
 [TreeNode] Loading new child with ID m8ohhxn3cur6ieIuRtsm
 [TreeNode] Attempting to load node with ID: m8ohhxn3cur6ieIuRtsm
 [TreeNode] Setting up types subscription for m8ohhwsq3T3qpNl6pmAv
 [TreeNode] All subscriptions set up for node m8ohhwsq3T3qpNl6pmAv
 [TreeNode.fromId] Created node with name: "Indoor/Outdoor Space" (ID: m8ohhwsq3T3qpNl6pmAv)
 [TreeNode] Child m8ohhwsq3T3qpNl6pmAv (Indoor/Outdoor Space) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhwvtQFZSrsNoxDLc: {_: {…}, manualFulfillment: null, name: 'Comfortable Seating', points: 15}
 [TreeNode.fromId] Node name from Gun: "Comfortable Seating" (string)
 [TreeNode] Creating new Gun reference for node m8ohhwvtQFZSrsNoxDLc
 [TreeNode] Setting up subscriptions for node m8ohhwvtQFZSrsNoxDLc
 [TreeNode] Received data update for node m8ohhwvtQFZSrsNoxDLc: {_: {…}, manualFulfillment: null, name: 'Comfortable Seating', points: 15}
 [TreeNode] Setting up children subscription for m8ohhwvtQFZSrsNoxDLc
 [TreeNode] Setting up types subscription for m8ohhwvtQFZSrsNoxDLc
 [TreeNode] All subscriptions set up for node m8ohhwvtQFZSrsNoxDLc
 [TreeNode.fromId] Created node with name: "Comfortable Seating" (ID: m8ohhwvtQFZSrsNoxDLc)
 [TreeNode] Child m8ohhwvtQFZSrsNoxDLc (Comfortable Seating) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhwyqRWVhDMDb68ki: {_: {…}, manualFulfillment: null, name: 'Lighting', points: 12}
 [TreeNode.fromId] Node name from Gun: "Lighting" (string)
 [TreeNode] Creating new Gun reference for node m8ohhwyqRWVhDMDb68ki
 [TreeNode] Setting up subscriptions for node m8ohhwyqRWVhDMDb68ki
 [TreeNode] Received data update for node m8ohhwyqRWVhDMDb68ki: {_: {…}, manualFulfillment: null, name: 'Lighting', points: 12}
 [TreeNode] Setting up children subscription for m8ohhwyqRWVhDMDb68ki
 [TreeNode] Setting up types subscription for m8ohhwyqRWVhDMDb68ki
 [TreeNode] All subscriptions set up for node m8ohhwyqRWVhDMDb68ki
 [TreeNode.fromId] Created node with name: "Lighting" (ID: m8ohhwyqRWVhDMDb68ki)
 [TreeNode] Child m8ohhwyqRWVhDMDb68ki (Lighting) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhx1w2oFs3O6wZ1cO: {_: {…}, manualFulfillment: null, name: 'Temperature Control', points: 12}
 [TreeNode.fromId] Node name from Gun: "Temperature Control" (string)
 [TreeNode] Creating new Gun reference for node m8ohhx1w2oFs3O6wZ1cO
 [TreeNode] Setting up subscriptions for node m8ohhx1w2oFs3O6wZ1cO
 [TreeNode] Received data update for node m8ohhx1w2oFs3O6wZ1cO: {_: {…}, manualFulfillment: null, name: 'Temperature Control', points: 12}
 [TreeNode] Setting up children subscription for m8ohhx1w2oFs3O6wZ1cO
 [TreeNode] Setting up types subscription for m8ohhx1w2oFs3O6wZ1cO
 [TreeNode] All subscriptions set up for node m8ohhx1w2oFs3O6wZ1cO
 [TreeNode.fromId] Created node with name: "Temperature Control" (ID: m8ohhx1w2oFs3O6wZ1cO)
 [TreeNode] Child m8ohhx1w2oFs3O6wZ1cO (Temperature Control) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhx5yxqowi9hvoHN6: {_: {…}, manualFulfillment: null, name: 'Bathroom Access', points: 12}
 [TreeNode.fromId] Node name from Gun: "Bathroom Access" (string)
 [TreeNode] Creating new Gun reference for node m8ohhx5yxqowi9hvoHN6
 [TreeNode] Setting up subscriptions for node m8ohhx5yxqowi9hvoHN6
 [TreeNode] Received data update for node m8ohhx5yxqowi9hvoHN6: {_: {…}, manualFulfillment: null, name: 'Bathroom Access', points: 12}
 [TreeNode] Setting up children subscription for m8ohhx5yxqowi9hvoHN6
 [TreeNode] Setting up types subscription for m8ohhx5yxqowi9hvoHN6
 [TreeNode] All subscriptions set up for node m8ohhx5yxqowi9hvoHN6
 [TreeNode.fromId] Created node with name: "Bathroom Access" (ID: m8ohhx5yxqowi9hvoHN6)
 [TreeNode] Child m8ohhx5yxqowi9hvoHN6 (Bathroom Access) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhx9doatepcUwMrpk: {_: {…}, manualFulfillment: null, name: 'Water Access', points: 12}
 [TreeNode.fromId] Node name from Gun: "Water Access" (string)
 [TreeNode] Creating new Gun reference for node m8ohhx9doatepcUwMrpk
 [TreeNode] Setting up subscriptions for node m8ohhx9doatepcUwMrpk
 [TreeNode] Received data update for node m8ohhx9doatepcUwMrpk: {_: {…}, manualFulfillment: null, name: 'Water Access', points: 12}
 [TreeNode] Setting up children subscription for m8ohhx9doatepcUwMrpk
 [TreeNode] Setting up types subscription for m8ohhx9doatepcUwMrpk
 [TreeNode] All subscriptions set up for node m8ohhx9doatepcUwMrpk
 [TreeNode.fromId] Created node with name: "Water Access" (ID: m8ohhx9doatepcUwMrpk)
 [TreeNode] Child m8ohhx9doatepcUwMrpk (Water Access) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhxci3XRlx4eC3MVl: {_: {…}, manualFulfillment: null, name: 'Cleaning Supplies', points: 11}
 [TreeNode.fromId] Node name from Gun: "Cleaning Supplies" (string)
 [TreeNode] Creating new Gun reference for node m8ohhxci3XRlx4eC3MVl
 [TreeNode] Setting up subscriptions for node m8ohhxci3XRlx4eC3MVl
 [TreeNode] Received data update for node m8ohhxci3XRlx4eC3MVl: {_: {…}, manualFulfillment: null, name: 'Cleaning Supplies', points: 11}
 [TreeNode] Setting up children subscription for m8ohhxci3XRlx4eC3MVl
 [TreeNode] Setting up types subscription for m8ohhxci3XRlx4eC3MVl
 [TreeNode] All subscriptions set up for node m8ohhxci3XRlx4eC3MVl
 [TreeNode.fromId] Created node with name: "Cleaning Supplies" (ID: m8ohhxci3XRlx4eC3MVl)
 [TreeNode] Child m8ohhxci3XRlx4eC3MVl (Cleaning Supplies) loaded successfully for m8ohhwpn4E0v4kqNjWtr
 [TreeNode.fromId] Raw data from Gun for node m8ohhxg1y2e10LAOUnTV: {_: {…}, manualFulfillment: null, name: 'Trash/Recycling', points: 11}
 [TreeNode.fromId] Node name from Gun: "Trash/Recycling" (string)
 [TreeNode] Creating new Gun reference for node m8ohhxg1y2e10LAOUnTV
 [TreeNode] Setting up subscriptions for node m8ohhxg1y2e10LAOUnTV
 [TreeNode] Received data update for node m8ohhxg1y2e10LAOUnTV: {_: {…}, manualFulfillment: null, name: 'Trash/Recycling', points: 11}
 [TreeNode] Setting up children subscription for m8ohhxg1y2e10LAOUnTV
 [TreeNode] Setting up types subscription for m8ohhxg1y2e10LAOUnTV
 [TreeNode] All subscriptions set up for node m8ohhxg1y2e10LAOUnTV
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Trash/Recycling" (ID: m8ohhxg1y2e10LAOUnTV)
TreeNode.ts:615 [TreeNode] Child m8ohhxg1y2e10LAOUnTV (Trash/Recycling) loaded successfully for m8ohhwpn4E0v4kqNjWtr
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhxu5FbZI6DVgSsgM: {_: {…}, manualFulfillment: null, name: 'Magical Technologies & Systems', points: 25}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Magical Technologies & Systems" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhxu5FbZI6DVgSsgM: {_: {…}, manualFulfillment: null, name: 'Magical Technologies & Systems', points: 25}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhxu5FbZI6DVgSsgM
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Magical Technologies & Systems" (ID: m8ohhxu5FbZI6DVgSsgM)
TreeNode.ts:615 [TreeNode] Child m8ohhxu5FbZI6DVgSsgM (Magical Technologies & Systems) loaded successfully for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhxxmaFqsCWouUA49: {_: {…}, manualFulfillment: null, name: 'Transformative Substances', points: 20}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Transformative Substances" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhxxmaFqsCWouUA49
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhxxmaFqsCWouUA49
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhxxmaFqsCWouUA49: {_: {…}, manualFulfillment: null, name: 'Transformative Substances', points: 20}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhxxmaFqsCWouUA49
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhxxmaFqsCWouUA49
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhxxmaFqsCWouUA49
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Transformative Substances" (ID: m8ohhxxmaFqsCWouUA49)
TreeNode.ts:615 [TreeNode] Child m8ohhxxmaFqsCWouUA49 (Transformative Substances) loaded successfully for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhy13UdJzbrIsuURx: {_: {…}, manualFulfillment: null, name: 'Reality Hacking & Manifestation', points: 20}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Reality Hacking & Manifestation" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhy13UdJzbrIsuURx
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhy13UdJzbrIsuURx
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhy13UdJzbrIsuURx: {_: {…}, manualFulfillment: null, name: 'Reality Hacking & Manifestation', points: 20}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhy13UdJzbrIsuURx
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhy13UdJzbrIsuURx
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhy13UdJzbrIsuURx
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Reality Hacking & Manifestation" (ID: m8ohhy13UdJzbrIsuURx)
TreeNode.ts:615 [TreeNode] Child m8ohhy13UdJzbrIsuURx (Reality Hacking & Manifestation) loaded successfully for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhy49yvtNjlsx8Otd: {_: {…}, manualFulfillment: null, name: 'Lore & Knowledge Systems', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Lore & Knowledge Systems" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhy49yvtNjlsx8Otd
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhy49yvtNjlsx8Otd
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhy49yvtNjlsx8Otd: {_: {…}, manualFulfillment: null, name: 'Lore & Knowledge Systems', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhy49yvtNjlsx8Otd
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhy49yvtNjlsx8Otd
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhy49yvtNjlsx8Otd
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Lore & Knowledge Systems" (ID: m8ohhy49yvtNjlsx8Otd)
TreeNode.ts:615 [TreeNode] Child m8ohhy49yvtNjlsx8Otd (Lore & Knowledge Systems) loaded successfully for m8ohhxqgfJvFd1jEIyHV
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Playnet Open Collective" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Playnet Open Collective" (ID: m8ohhyw0i1MoW78ALbix)
TreeNode.ts:615 [TreeNode] Child m8ohhyw0i1MoW78ALbix (Playnet Open Collective) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Personal Donations" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Personal Donations" (ID: m8ohhyzh3qh4BMwVCUbe)
TreeNode.ts:615 [TreeNode] Child m8ohhyzh3qh4BMwVCUbe (Personal Donations) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Development" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Development" (ID: m8ohhz30ppN1ZTnZVRQR)
TreeNode.ts:615 [TreeNode] Child m8ohhz30ppN1ZTnZVRQR (Development) loaded successfully for m8ohhycbkSfPhsWJuj2h
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhz6i9RSoKpMd40hT: {_: {…}, manualFulfillment: null, name: 'Communications', points: 10, types: {…}}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Communications" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhz6i9RSoKpMd40hT
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhz6i9RSoKpMd40hT
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhz6i9RSoKpMd40hT: {_: {…}, manualFulfillment: null, name: 'Communications', points: 10, types: {…}}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhz6i9RSoKpMd40hT
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhz6i9RSoKpMd40hT
TreeNode.ts:638 [TreeNode] Detected type with key m8ohhy8fL9BVHCwBHqNJ and ID m8ohhy8fL9BVHCwBHqNJ for node m8ohhz6i9RSoKpMd40hT
TreeNode.ts:647 [TreeNode] Loading new type with ID m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:638 [TreeNode] Detected type with key m8ohhz30ppN1ZTnZVRQR and ID m8ohhz30ppN1ZTnZVRQR for node m8ohhz6i9RSoKpMd40hT
TreeNode.ts:647 [TreeNode] Loading new type with ID m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhz6i9RSoKpMd40hT
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Communications" (ID: m8ohhz6i9RSoKpMd40hT)
TreeNode.ts:615 [TreeNode] Child m8ohhz6i9RSoKpMd40hT (Communications) loaded successfully for m8ohhycbkSfPhsWJuj2h
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyp8ZqOcaEyfXQWz: {_: {…}, manualFulfillment: null, name: 'Securing my Laptop', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Securing my Laptop" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyp8ZqOcaEyfXQWz: {_: {…}, manualFulfillment: null, name: 'Securing my Laptop', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyp8ZqOcaEyfXQWz
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Securing my Laptop" (ID: m8ohhyp8ZqOcaEyfXQWz)
TreeNode.ts:615 [TreeNode] Child m8ohhyp8ZqOcaEyfXQWz (Securing my Laptop) loaded successfully for m8ohhylzLadjmLqyPW1f
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhysi4InVlILPU9wr: {_: {…}, manualFulfillment: null, name: 'Securing my Backpack', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Securing my Backpack" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhysi4InVlILPU9wr
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhysi4InVlILPU9wr
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhysi4InVlILPU9wr: {_: {…}, manualFulfillment: null, name: 'Securing my Backpack', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhysi4InVlILPU9wr
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhysi4InVlILPU9wr
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhysi4InVlILPU9wr
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Securing my Backpack" (ID: m8ohhysi4InVlILPU9wr)
TreeNode.ts:615 [TreeNode] Child m8ohhysi4InVlILPU9wr (Securing my Backpack) loaded successfully for m8ohhylzLadjmLqyPW1f
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxjmOV20TeKwasiv
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhxn3cur6ieIuRtsm
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:773 [TreeNode] Node m8ohhz6i9RSoKpMd40hT has types: m8ohhy8fL9BVHCwBHqNJ, m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhxjmOV20TeKwasiv: {_: {…}, manualFulfillment: null, name: 'Space Providers/Hosts', points: 14}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Space Providers/Hosts" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhxjmOV20TeKwasiv
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhxjmOV20TeKwasiv
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhxjmOV20TeKwasiv: {_: {…}, manualFulfillment: null, name: 'Space Providers/Hosts', points: 14}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhxjmOV20TeKwasiv
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhxjmOV20TeKwasiv
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhxjmOV20TeKwasiv
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Space Providers/Hosts" (ID: m8ohhxjmOV20TeKwasiv)
TreeNode.ts:615 [TreeNode] Child m8ohhxjmOV20TeKwasiv (Space Providers/Hosts) loaded successfully for m8ohhwsq3T3qpNl6pmAv
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhxn3cur6ieIuRtsm: {_: {…}, manualFulfillment: null, name: 'Infra(de)structure & Bottom-secret Spaces', points: 25}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Infra(de)structure & Bottom-secret Spaces" (string)
TreeNode.ts:44 [TreeNode] Creating new Gun reference for node m8ohhxn3cur6ieIuRtsm
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhxn3cur6ieIuRtsm
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhxn3cur6ieIuRtsm: {_: {…}, manualFulfillment: null, name: 'Infra(de)structure & Bottom-secret Spaces', points: 25}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhxn3cur6ieIuRtsm
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhxn3cur6ieIuRtsm
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhxn3cur6ieIuRtsm
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Infra(de)structure & Bottom-secret Spaces" (ID: m8ohhxn3cur6ieIuRtsm)
TreeNode.ts:615 [TreeNode] Child m8ohhxn3cur6ieIuRtsm (Infra(de)structure & Bottom-secret Spaces) loaded successfully for m8ohhwsq3T3qpNl6pmAv
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Money" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyw0i1MoW78ALbix and ID m8ohhyw0i1MoW78ALbix for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyw0i1MoW78ALbix
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyw0i1MoW78ALbix
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyzh3qh4BMwVCUbe and ID m8ohhyzh3qh4BMwVCUbe for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Money" (ID: m8ohhy8fL9BVHCwBHqNJ)
TreeNode.ts:650 [TreeNode] Type m8ohhy8fL9BVHCwBHqNJ (Money) loaded successfully for m8ohhz6i9RSoKpMd40hT
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Development" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Development" (ID: m8ohhz30ppN1ZTnZVRQR)
TreeNode.ts:650 [TreeNode] Type m8ohhz30ppN1ZTnZVRQR (Development) loaded successfully for m8ohhz6i9RSoKpMd40hT
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyw0i1MoW78ALbix
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Playnet Open Collective" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Playnet Open Collective" (ID: m8ohhyw0i1MoW78ALbix)
TreeNode.ts:615 [TreeNode] Child m8ohhyw0i1MoW78ALbix (Playnet Open Collective) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Personal Donations" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Personal Donations" (ID: m8ohhyzh3qh4BMwVCUbe)
TreeNode.ts:615 [TreeNode] Child m8ohhyzh3qh4BMwVCUbe (Personal Donations) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Money" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhy8fL9BVHCwBHqNJ: {_: {…}, children: {…}, manualFulfillment: null, name: 'Money', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyw0i1MoW78ALbix and ID m8ohhyw0i1MoW78ALbix for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyw0i1MoW78ALbix
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyw0i1MoW78ALbix
TreeNode.ts:603 [TreeNode] Detected child with key m8ohhyzh3qh4BMwVCUbe and ID m8ohhyzh3qh4BMwVCUbe for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:612 [TreeNode] Loading new child with ID m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:692 [TreeNode] Attempting to load node with ID: m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Money" (ID: m8ohhy8fL9BVHCwBHqNJ)
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Development" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhz30ppN1ZTnZVRQR: {_: {…}, manualFulfillment: null, name: 'Development', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhz30ppN1ZTnZVRQR
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Development" (ID: m8ohhz30ppN1ZTnZVRQR)
TreeNode.ts:801 [TreeNode] Adding type m8ohhy8fL9BVHCwBHqNJ (Money) to node Communications
TreeNode.ts:801 [TreeNode] Adding type m8ohhz30ppN1ZTnZVRQR (Development) to node Communications
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyw0i1MoW78ALbix
TreeNode.ts:721 [TreeNode.fromId] Node not found in users path, trying nodes: m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Playnet Open Collective" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyw0i1MoW78ALbix: {_: {…}, manualFulfillment: null, name: 'Playnet Open Collective', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyw0i1MoW78ALbix
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyw0i1MoW78ALbix
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Playnet Open Collective" (ID: m8ohhyw0i1MoW78ALbix)
TreeNode.ts:615 [TreeNode] Child m8ohhyw0i1MoW78ALbix (Playnet Open Collective) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
TreeNode.ts:738 [TreeNode.fromId] Raw data from Gun for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:742 [TreeNode.fromId] Node name from Gun: "Personal Donations" (string)
TreeNode.ts:566 [TreeNode] Setting up subscriptions for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:573 [TreeNode] Received data update for node m8ohhyzh3qh4BMwVCUbe: {_: {…}, manualFulfillment: null, name: 'Personal Donations', points: 10}
TreeNode.ts:593 [TreeNode] Setting up children subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:626 [TreeNode] Setting up types subscription for m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:672 [TreeNode] All subscriptions set up for node m8ohhyzh3qh4BMwVCUbe
TreeNode.ts:755 [TreeNode.fromId] Created node with name: "Personal Donations" (ID: m8ohhyzh3qh4BMwVCUbe)
TreeNode.ts:615 [TreeNode] Child m8ohhyzh3qh4BMwVCUbe (Personal Donations) loaded successfully for m8ohhy8fL9BVHCwBHqNJ
App.ts:125 [App] Checking for children in Gun...
App.ts:129 [App] Children data in Gun: undefined
App.ts:143 [App] Children check result: {childrenCheck: undefined, localChildrenCount: 7}
App.ts:151 [App] Root node already has children, skipping example data
App.ts:155 [App] Waiting for data to stabilize before creating visualization
TreeNode.ts:831 [TreeNode] Timeout loading node JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhwpn4E0v4kqNjWtr, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxqgfJvFd1jEIyHV, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhy8fL9BVHCwBHqNJ, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhycbkSfPhsWJuj2h, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyfsDjCg51Qw3J2g, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyivW08mKiecprfB, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhylzLadjmLqyPW1f, assuming it doesn't exist
App.ts:158 [App] Creating treemap visualization
App.ts:165 [App] Treemap created successfully
App.ts:167 [App] Treemap added to container
App.ts:170 [App] Setting up reactive update system
App.ts:188 [App] Update interval set up
App.ts:191 [App] Initialization completed successfully
main.ts:76 App initialized: App {name: 'ruzgar', rootId: 'JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE', rootNode: TreeNode, initializing: false, treemap: {…}, …}
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhwsq3T3qpNl6pmAv, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhwvtQFZSrsNoxDLc, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhwyqRWVhDMDb68ki, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhx1w2oFs3O6wZ1cO, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhx5yxqowi9hvoHN6, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhx9doatepcUwMrpk, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxci3XRlx4eC3MVl, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxg1y2e10LAOUnTV, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxu5FbZI6DVgSsgM, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxxmaFqsCWouUA49, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhy13UdJzbrIsuURx, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhy49yvtNjlsx8Otd, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyw0i1MoW78ALbix, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyzh3qh4BMwVCUbe, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhz30ppN1ZTnZVRQR, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhz6i9RSoKpMd40hT, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyp8ZqOcaEyfXQWz, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhysi4InVlILPU9wr, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxjmOV20TeKwasiv, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhxn3cur6ieIuRtsm, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhy8fL9BVHCwBHqNJ, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhz30ppN1ZTnZVRQR, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyw0i1MoW78ALbix, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyzh3qh4BMwVCUbe, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhy8fL9BVHCwBHqNJ, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhz30ppN1ZTnZVRQR, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyw0i1MoW78ALbix, assuming it doesn't exist
TreeNode.ts:831 [TreeNode] Timeout loading node m8ohhyzh3qh4BMwVCUbe, assuming it doesn't exist
App.ts:178 [App] Update needed, refreshing treemap
App.ts:278 updateTreeMap called
App.ts:183 [App] Pie chart update needed, refreshing
App.ts:298 updatePieChart started
PieChart.ts:18 Creating pie chart for data: TreeNode {id: 'JZTi3uva9s01CHAzDozp5SPmdtcNLCCfHrkT-f9cPL4.Qv7nEDWi7aWozeTrlCyxnZ8TSDthFLJfTWElge3morE', _name: 'ruzgar', _points: 0, gunRef: Gun2, _parent: null, …}
PieChart.ts:20 mutualFulfillmentDistribution for pie: Map(0) {size: 0}
App.ts:69 [App] Timeout waiting for root node, will create a new one
App.ts:138 [App] Timeout checking for children, assuming none exist
